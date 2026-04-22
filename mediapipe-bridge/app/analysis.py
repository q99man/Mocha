from __future__ import annotations

import json
import math
import os
import statistics
from hashlib import sha256
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from .schemas import AnalyzeRequest, AnalyzeResponse


DEFAULT_MODEL_CANDIDATES = (
    "pose_landmarker_active.task",
    "pose_landmarker_heavy.task",
    "pose_landmarker_full.task",
    "pose_landmarker_lite.task",
)

JOINT_SPECS = {
    "leftElbow": ("left_shoulder", "left_elbow", "left_wrist"),
    "rightElbow": ("right_shoulder", "right_elbow", "right_wrist"),
    "leftKnee": ("left_hip", "left_knee", "left_ankle"),
    "rightKnee": ("right_hip", "right_knee", "right_ankle"),
    "leftHip": ("left_shoulder", "left_hip", "left_knee"),
    "rightHip": ("right_shoulder", "right_hip", "right_knee"),
}

MOTION_KEYPOINTS = (
    "nose",
    "left_shoulder",
    "right_shoulder",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_ankle",
    "right_ankle",
)

FOCUS_POINT_TARGETS = {
    "leftWrist": "left_wrist",
    "rightWrist": "right_wrist",
    "leftAnkle": "left_ankle",
    "rightAnkle": "right_ankle",
}

SEGMENT_PHASE_NAMES = {
    3: ("opening", "impact", "finish"),
    4: ("opening", "build", "impact", "finish"),
    5: ("opening", "build", "impact", "release", "finish"),
}


def analyze_payload(payload: AnalyzeRequest) -> AnalyzeResponse:
    return analyze_with_mediapipe(payload)


def analyze_with_mediapipe(payload: AnalyzeRequest) -> AnalyzeResponse:
    try:
        import cv2  # type: ignore
        import mediapipe as mp  # type: ignore
        from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode  # type: ignore
        from mediapipe.tasks.python.vision.pose_landmarker import (  # type: ignore
            PoseLandmarker,
            PoseLandmarkerOptions,
        )
    except Exception as exc:  # pragma: no cover - environment specific
        raise bridge_error(
            503,
            "MEDIAPIPE_DEPENDENCY_MISSING",
            "MediaPipe bridge dependencies are not installed in this Python environment.",
        ) from exc

    video_path = resolve_video_path(payload.sourceVideo.storagePath)
    if not video_path.exists():
        raise bridge_error(
            400,
            "SOURCE_VIDEO_NOT_FOUND",
            f"Source video path does not exist: {video_path}",
        )

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise bridge_error(
            400,
            "VIDEO_OPEN_FAILED",
            f"Failed to open source video: {video_path}",
        )

    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_ms = (
        int((total_frames / fps) * 1000)
        if fps > 0 and total_frames > 0
        else max(4_000, min(90_000, payload.sourceVideo.size // 12))
    )

    model_path = resolve_pose_landmarker_model_path()
    if not model_path.exists():
        raise bridge_error(
            503,
            "POSE_LANDMARKER_MODEL_MISSING",
            "Pose landmarker model file is missing. "
            f"Resolved path: {model_path}. "
            "Set MEDIAPIPE_BRIDGE_MODEL_PATH or place an active .task model under "
            "mediapipe-bridge/models/.",
        )

    model_variant = detect_model_variant(model_path)
    analysis_budget_ms = max(5_000, int(payload.runtime.timeoutMillis))
    detail_multiplier = resolve_detail_multiplier(analysis_budget_ms, model_variant)
    target_fps = round(12.0 * detail_multiplier, 2)
    max_frames = max(24, min(int(round(96 * detail_multiplier)), total_frames if total_frames > 0 else int(round(42 * detail_multiplier))))
    if fps > 0:
        frame_step = max(1, int(round(fps / target_fps)))
    else:
        frame_step = max(1, total_frames // max_frames) if total_frames > 0 else 3
    target_frame_indices = resolve_target_frame_indices(
        total_frames,
        duration_ms,
        target_fps,
        max_frames,
    )

    base_options = mp.tasks.BaseOptions(model_asset_path=str(model_path))
    options = PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=VisionTaskRunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.55,
        min_pose_presence_confidence=0.55,
        min_tracking_confidence=0.60,
        output_segmentation_masks=False,
    )

    sampled_landmarks: list[dict[str, Any]] = []
    processed_frames = 0
    frames_with_pose = 0

    with PoseLandmarker.create_from_options(options) as pose_landmarker:
        frame_index = 0
        target_pointer = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if target_frame_indices:
                if target_pointer >= len(target_frame_indices):
                    break
                target_index = target_frame_indices[target_pointer]
                if frame_index < target_index:
                    frame_index += 1
                    continue
                while target_pointer < len(target_frame_indices) and target_frame_indices[target_pointer] < frame_index:
                    target_pointer += 1
                if target_pointer >= len(target_frame_indices):
                    break
                if frame_index != target_frame_indices[target_pointer]:
                    frame_index += 1
                    continue
            else:
                if processed_frames >= max_frames:
                    break
                if frame_index % frame_step != 0:
                    frame_index += 1
                    continue

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            timestamp_ms = int((frame_index / fps) * 1000) if fps > 0 else processed_frames * 33
            result = pose_landmarker.detect_for_video(mp_image, timestamp_ms)
            if result.pose_landmarks:
                frames_with_pose += 1
                points = [
                    {
                        "name": task_landmark_name(index),
                        "x": round(landmark.x, 6),
                        "y": round(landmark.y, 6),
                        "z": round(landmark.z, 6),
                        "visibility": round(getattr(landmark, "visibility", 0.0), 6),
                    }
                    for index, landmark in enumerate(result.pose_landmarks[0])
                ]
                sampled_landmarks.append(
                    {
                        "frameIndex": frame_index,
                        "timestampMs": timestamp_ms,
                        "phase": payload.analysisPhase,
                        "points": points,
                    }
                )
            processed_frames += 1
            if target_frame_indices:
                target_pointer += 1
            frame_index += 1

    cap.release()

    if not sampled_landmarks:
        raise bridge_error(
            422,
            "POSE_NOT_DETECTED",
            "MediaPipe could not detect pose landmarks from the provided video.",
        )

    signature = build_signature(payload, sampled_landmarks)
    sample_count = len(sampled_landmarks)
    analyzer_name = "mediapipe-fastapi-pose-v1"
    analysis_summary = summarize_landmarks(
        sampled_landmarks,
        processed_frames,
        frames_with_pose,
        duration_ms,
    )

    return AnalyzeResponse(
        provider="mediapipe",
        analyzerName=analyzer_name,
        signature=signature,
        sampleCount=sample_count,
        durationMs=duration_ms,
        notes=[
            "Real MediaPipe Pose Landmarker extraction is active.",
            f"Model variant: {model_variant}",
            f"Analysis budget: {analysis_budget_ms} ms",
            f"Detail multiplier: x{detail_multiplier:.2f}",
            f"Processed frames: {processed_frames}",
            f"Frames with pose landmarks: {frames_with_pose}",
        ],
        landmarks=sampled_landmarks,
        extras={
            "bridgeMode": "FASTAPI",
            "analysisMode": "mediapipe",
            "bridgeVersion": "v2",
            "poseModel": "mediapipe-pose-landmarker",
            "modelVariant": model_variant,
            "schemaVersion": payload.schemaVersion,
            "analysisPhase": payload.analysisPhase,
            "storagePathEcho": payload.sourceVideo.storagePath,
            "modelPath": str(model_path),
            "fps": fps,
            "analysisBudgetMs": analysis_budget_ms,
            "detailMultiplier": detail_multiplier,
            "samplingFpsTarget": target_fps,
            "samplingFrameStep": frame_step,
            "samplingMode": "full-span-targets" if target_frame_indices else "interval-fallback",
            "samplingFrameTargets": target_frame_indices,
            "totalFrames": total_frames,
            "processedFrames": processed_frames,
            "framesWithPose": frames_with_pose,
            "analysisSummary": analysis_summary,
        },
    )


def summarize_landmarks(
    sampled_landmarks: list[dict[str, Any]],
    processed_frames: int,
    frames_with_pose: int,
    duration_ms: int,
) -> dict[str, Any]:
    visibilities: list[float] = []
    torso_scales: list[float] = []
    center_line_offsets: list[float] = []
    motion_energies: list[float] = []
    center_drifts: list[float] = []
    upper_symmetry: list[float] = []
    lower_symmetry: list[float] = []
    joint_angle_series: dict[str, list[float]] = {name: [] for name in JOINT_SPECS}
    focus_samples: list[dict[str, Any]] = []

    previous_points: dict[str, dict[str, float]] | None = None
    previous_center: tuple[float, float] | None = None
    previous_scale: float | None = None
    previous_joint_values: dict[str, float] | None = None

    for frame in sampled_landmarks:
        points = {point["name"]: point for point in frame.get("points", [])}
        if not points:
            continue

        frame_visibilities = [
            clamp(float(point.get("visibility", 0.0)), 0.0, 1.0)
            for point in points.values()
        ]
        visibilities.extend(frame_visibilities)

        torso_scale = max(0.05, compute_torso_scale(points))
        torso_scales.append(torso_scale)

        center = compute_body_center(points)
        center_line_offsets.append(clamp(abs(center[0] - 0.5) / 0.5, 0.0, 2.0))

        frame_motion_energy = 0.0
        if previous_points is not None:
            frame_motion_energy = compute_motion_energy(previous_points, points, average(previous_scale, torso_scale))
            motion_energies.append(frame_motion_energy)
        if previous_center is not None:
            center_drifts.append(
                clamp(
                    distance_xy(previous_center[0], previous_center[1], center[0], center[1]) / average(previous_scale, torso_scale),
                    0.0,
                    2.0,
                )
            )

        current_joint_values: dict[str, float] = {}
        for joint_name, joint_spec in JOINT_SPECS.items():
            angle = compute_joint_angle(points, *joint_spec)
            if angle is None:
                continue
            normalized_angle = clamp(angle / math.pi, 0.0, 1.0)
            joint_angle_series[joint_name].append(normalized_angle)
            current_joint_values[joint_name] = normalized_angle

        upper_symmetry_value = compute_symmetry_score(
            current_joint_values.get("leftElbow"),
            current_joint_values.get("rightElbow"),
            normalized_distance(points, torso_scale, "left_wrist", "left_shoulder"),
            normalized_distance(points, torso_scale, "right_wrist", "right_shoulder"),
        )
        if upper_symmetry_value is not None:
            upper_symmetry.append(upper_symmetry_value)

        lower_symmetry_value = compute_symmetry_score(
            current_joint_values.get("leftKnee"),
            current_joint_values.get("rightKnee"),
            normalized_distance(points, torso_scale, "left_ankle", "left_hip"),
            normalized_distance(points, torso_scale, "right_ankle", "right_hip"),
        )
        if lower_symmetry_value is not None:
            lower_symmetry.append(lower_symmetry_value)

        focus_target_scores: dict[str, float] = {}
        if previous_joint_values is not None:
            focus_target_scores.update(
                compute_joint_activity_scores(previous_joint_values, current_joint_values)
            )
        if previous_points is not None:
            focus_target_scores.update(compute_focus_point_activity(previous_points, points, torso_scale))
        focus_samples.append(
            {
                "motionEnergy": round(frame_motion_energy, 6),
                "visibility": round(safe_mean(frame_visibilities), 6),
                "targets": focus_target_scores,
            }
        )

        previous_points = points
        previous_center = center
        previous_scale = torso_scale
        previous_joint_values = current_joint_values

    joint_metrics: dict[str, dict[str, float]] = {}
    joint_ranges: list[float] = []
    joint_stabilities: list[float] = []
    for joint_name, values in joint_angle_series.items():
        if not values:
            continue
        range_value = clamp(max(values) - min(values), 0.0, 1.0)
        stddev_value = clamp(safe_pstdev(values), 0.0, 1.0)
        joint_ranges.append(range_value)
        joint_stabilities.append(clamp(1.0 - stddev_value, 0.0, 1.0))
        joint_metrics[joint_name] = {
            "mean": round(safe_mean(values), 6),
            "range": round(range_value, 6),
            "stdDev": round(stddev_value, 6),
        }

    quality = {
        "detectionCoverage": round(clamp(frames_with_pose / max(processed_frames, 1), 0.0, 1.0), 6),
        "averageVisibility": round(safe_mean(visibilities), 6),
        "visibilitySpread": round(clamp(safe_pstdev(visibilities), 0.0, 1.0), 6),
        "torsoScaleMean": round(safe_mean(torso_scales), 6),
        "torsoScaleStdDev": round(clamp(safe_pstdev(torso_scales), 0.0, 1.0), 6),
        "centerLineOffsetMean": round(clamp(safe_mean(center_line_offsets), 0.0, 2.0), 6),
        "centerDriftMean": round(clamp(safe_mean(center_drifts), 0.0, 2.0), 6),
        "centerDriftPeak": round(clamp(max_or_zero(center_drifts), 0.0, 2.0), 6),
    }
    rhythm = {
        "motionEnergyMean": round(clamp(safe_mean(motion_energies), 0.0, 3.0), 6),
        "motionEnergyStdDev": round(clamp(safe_pstdev(motion_energies), 0.0, 3.0), 6),
        "motionEnergyPeak": round(clamp(max_or_zero(motion_energies), 0.0, 3.0), 6),
        "motionBurstCount": int(count_motion_bursts(motion_energies)),
    }
    symmetry = {
        "upperBodyMean": round(clamp(safe_mean(upper_symmetry), 0.0, 1.0), 6),
        "lowerBodyMean": round(clamp(safe_mean(lower_symmetry), 0.0, 1.0), 6),
        "fullBodyMean": round(clamp(safe_mean(upper_symmetry + lower_symmetry), 0.0, 1.0), 6),
    }
    kinematics = {
        "jointRangeMean": round(clamp(safe_mean(joint_ranges), 0.0, 1.0), 6),
        "jointRangePeak": round(clamp(max_or_zero(joint_ranges), 0.0, 1.0), 6),
        "jointStabilityMean": round(clamp(safe_mean(joint_stabilities), 0.0, 1.0), 6),
        "joints": joint_metrics,
    }
    focus_profile = build_focus_profile(sampled_landmarks, focus_samples)
    score_spots = build_score_spots(sampled_landmarks, focus_samples, focus_profile, duration_ms)

    return {
        "quality": quality,
        "rhythm": rhythm,
        "symmetry": symmetry,
        "kinematics": kinematics,
        "focusProfile": focus_profile,
        "scoreSpots": score_spots,
    }


def compute_motion_energy(
    previous_points: dict[str, dict[str, float]],
    current_points: dict[str, dict[str, float]],
    torso_scale: float,
) -> float:
    displacements: list[float] = []
    for point_name in MOTION_KEYPOINTS:
        previous_point = previous_points.get(point_name)
        current_point = current_points.get(point_name)
        if previous_point is None or current_point is None:
            continue
        displacement = distance_xy(
            float(previous_point.get("x", 0.0)),
            float(previous_point.get("y", 0.0)),
            float(current_point.get("x", 0.0)),
            float(current_point.get("y", 0.0)),
        )
        displacements.append(clamp(displacement / max(torso_scale, 0.05), 0.0, 3.0))

    return safe_mean(displacements)


def compute_joint_activity_scores(
    previous_joint_values: dict[str, float],
    current_joint_values: dict[str, float],
) -> dict[str, float]:
    activity_scores: dict[str, float] = {}
    for joint_name, current_value in current_joint_values.items():
        previous_value = previous_joint_values.get(joint_name)
        if previous_value is None:
            continue
        activity_scores[joint_name] = clamp(abs(current_value - previous_value) * 1.8, 0.0, 1.0)
    return activity_scores


def compute_focus_point_activity(
    previous_points: dict[str, dict[str, float]],
    current_points: dict[str, dict[str, float]],
    torso_scale: float,
) -> dict[str, float]:
    activity_scores: dict[str, float] = {}
    safe_scale = max(torso_scale, 0.05)
    for target_name, point_name in FOCUS_POINT_TARGETS.items():
        previous_point = previous_points.get(point_name)
        current_point = current_points.get(point_name)
        if previous_point is None or current_point is None:
            continue
        displacement = distance_points(previous_point, current_point) / safe_scale
        activity_scores[target_name] = clamp(displacement * 1.6, 0.0, 1.0)
    return activity_scores


def build_focus_profile(
    sampled_landmarks: list[dict[str, Any]],
    focus_samples: list[dict[str, Any]],
) -> dict[str, Any]:
    if not sampled_landmarks or not focus_samples:
        return {
            "version": "v1",
            "primaryJoints": default_focus_targets(),
            "segments": [],
        }

    aggregate_target_scores = average_focus_target_scores(focus_samples)
    primary_joints = build_weighted_focus_targets(aggregate_target_scores, limit=4)
    segment_count = resolve_focus_segment_count(len(sampled_landmarks))
    phase_names = SEGMENT_PHASE_NAMES.get(segment_count, SEGMENT_PHASE_NAMES[5])

    motion_peak = max_or_zero([float(sample.get("motionEnergy", 0.0)) for sample in focus_samples])
    score_peak = max(aggregate_target_scores.values(), default=0.0)

    segments: list[dict[str, Any]] = []
    for segment_index in range(segment_count):
        start_index = int(math.floor(segment_index * len(focus_samples) / segment_count))
        end_index = int(math.floor((segment_index + 1) * len(focus_samples) / segment_count))
        end_index = max(start_index + 1, end_index)
        segment_samples = focus_samples[start_index:end_index]
        if not segment_samples:
            continue

        segment_target_scores = average_focus_target_scores(segment_samples)
        weighted_targets = build_weighted_focus_targets(
            segment_target_scores,
            limit=4,
            fallback=primary_joints,
        )
        dominant_region = resolve_focus_region([target["name"] for target in weighted_targets])
        segment_motion_mean = safe_mean([float(sample.get("motionEnergy", 0.0)) for sample in segment_samples])
        segment_visibility_mean = safe_mean([float(sample.get("visibility", 0.0)) for sample in segment_samples])
        target_weight_mean = safe_mean([float(target["weight"]) for target in weighted_targets])
        segment_score_mean = safe_mean(list(segment_target_scores.values()))
        pose_weight = clamp(
            0.35
            + normalized_ratio(target_weight_mean, 1.0) * 0.45
            + normalized_ratio(segment_score_mean, score_peak) * 0.20,
            0.35,
            1.0,
        )
        timing_weight = clamp(
            0.30
            + normalized_ratio(segment_motion_mean, motion_peak) * 0.55
            + normalized_ratio(segment_visibility_mean, 1.0) * 0.15,
            0.30,
            1.0,
        )
        start_ratio = round(segment_index / segment_count, 4)
        end_ratio = round((segment_index + 1) / segment_count, 4)
        phase_name = phase_names[segment_index]
        segments.append(
            {
                "key": phase_name,
                "label": f"{phase_name} {dominant_region} focus",
                "startRatio": start_ratio,
                "endRatio": end_ratio,
                "poseWeight": round(pose_weight, 4),
                "timingWeight": round(timing_weight, 4),
                "jointWeights": {
                    target["name"]: target["weight"]
                    for target in weighted_targets
                },
                "dominantRegion": dominant_region,
            }
        )

    return {
        "version": "v1",
        "primaryJoints": primary_joints,
        "segments": segments,
    }


def build_score_spots(
    sampled_landmarks: list[dict[str, Any]],
    focus_samples: list[dict[str, Any]],
    focus_profile: dict[str, Any],
    duration_ms: int,
) -> list[dict[str, Any]]:
    if not sampled_landmarks:
        return []

    spot_count = resolve_score_spot_count(duration_ms)
    if spot_count <= 0:
        return []

    score_spots: list[dict[str, Any]] = []
    for second_index in range(spot_count):
        window_start_ms = int(round(second_index * duration_ms / spot_count))
        window_end_ms = int(round((second_index + 1) * duration_ms / spot_count))
        if second_index == spot_count - 1:
            window_end_ms = max(window_end_ms, duration_ms)

        candidate_indices = [
            index
            for index, frame in enumerate(sampled_landmarks)
            if window_start_ms <= int(frame.get("timestampMs", 0)) < window_end_ms
        ]
        if not candidate_indices:
            target_ms = int(round((window_start_ms + window_end_ms) / 2))
            fallback_index = min(
                range(len(sampled_landmarks)),
                key=lambda index: abs(int(sampled_landmarks[index].get("timestampMs", 0)) - target_ms),
            )
            candidate_indices = [fallback_index]

        selected_index = max(
            candidate_indices,
            key=lambda index: score_spot_candidate_quality(
                focus_samples[index] if index < len(focus_samples) else {},
                sampled_landmarks[index],
            ),
        )
        selected_frame = sampled_landmarks[selected_index]
        timestamp_ms = int(selected_frame.get("timestampMs", 0))
        ratio = (
            clamp(timestamp_ms / max(duration_ms, 1), 0.0, 1.0)
            if duration_ms > 0
            else clamp(second_index / max(spot_count - 1, 1), 0.0, 1.0)
        )
        segment = resolve_focus_segment_for_ratio(focus_profile, ratio)

        score_spots.append(
            {
                "secondIndex": second_index,
                "windowStartMs": window_start_ms,
                "windowEndMs": window_end_ms,
                "cueMs": timestamp_ms,
                "frameIndex": int(selected_frame.get("frameIndex", selected_index)),
                "focusRegion": str(segment.get("dominantRegion", "body")),
                "poseWeight": round(float(segment.get("poseWeight", 0.7)), 4),
                "timingWeight": round(float(segment.get("timingWeight", 0.7)), 4),
            }
        )

    return score_spots


def score_spot_candidate_quality(
    focus_sample: dict[str, Any],
    frame: dict[str, Any],
) -> float:
    motion_energy = clamp(float(focus_sample.get("motionEnergy", 0.0)), 0.0, 3.0) / 3.0
    visibility = clamp(float(focus_sample.get("visibility", 0.0)), 0.0, 1.0)
    points = frame.get("points", [])
    visible_point_ratio = 0.0
    if points:
        visible_points = sum(
            1 for point in points if clamp(float(point.get("visibility", 0.0)), 0.0, 1.0) >= 0.35
        )
        visible_point_ratio = visible_points / max(len(points), 1)
    return motion_energy * 0.62 + visibility * 0.24 + visible_point_ratio * 0.14


def resolve_score_spot_count(duration_ms: int) -> int:
    if duration_ms <= 0:
        return 1
    return max(1, min(30, int(round(duration_ms / 1000.0))))


def resolve_focus_segment_for_ratio(
    focus_profile: dict[str, Any],
    ratio: float,
) -> dict[str, Any]:
    segments = list(focus_profile.get("segments", [])) if focus_profile else []
    if not segments:
        return {
            "dominantRegion": "body",
            "poseWeight": 0.7,
            "timingWeight": 0.7,
        }

    normalized_ratio = clamp(ratio, 0.0, 1.0)
    for segment in segments:
        start_ratio = clamp(float(segment.get("startRatio", 0.0)), 0.0, 1.0)
        end_ratio = clamp(float(segment.get("endRatio", 1.0)), 0.0, 1.0)
        if start_ratio <= normalized_ratio < end_ratio:
            return segment
    return segments[-1]


def resolve_target_frame_indices(
    total_frames: int,
    duration_ms: int,
    target_fps: float,
    max_frames: int,
) -> list[int]:
    if total_frames <= 0:
        return []

    duration_seconds = max(duration_ms / 1000.0, 0.1)
    requested_samples = max(24, int(round(duration_seconds * max(target_fps, 1.0))))
    sample_count = max(1, min(total_frames, max_frames, requested_samples))
    if sample_count >= total_frames:
        return list(range(total_frames))
    if sample_count == 1:
        return [max(0, total_frames // 2)]

    return sorted(
        {
            int(round(index * (total_frames - 1) / (sample_count - 1)))
            for index in range(sample_count)
        }
    )


def average_focus_target_scores(samples: list[dict[str, Any]]) -> dict[str, float]:
    totals: dict[str, float] = {}
    for sample in samples:
        visibility_weight = 0.65 + clamp(float(sample.get("visibility", 0.0)), 0.0, 1.0) * 0.35
        for target_name, raw_score in dict(sample.get("targets", {})).items():
            totals[target_name] = totals.get(target_name, 0.0) + clamp(float(raw_score), 0.0, 1.0) * visibility_weight

    sample_count = max(len(samples), 1)
    return {
        target_name: round(total_score / sample_count, 6)
        for target_name, total_score in totals.items()
    }


def build_weighted_focus_targets(
    target_scores: dict[str, float],
    limit: int,
    fallback: list[dict[str, float | str]] | None = None,
) -> list[dict[str, float | str]]:
    if not target_scores:
        return fallback if fallback is not None else default_focus_targets()

    ranked_targets = sorted(
        target_scores.items(),
        key=lambda item: (-item[1], item[0]),
    )
    peak_score = ranked_targets[0][1]
    minimum_score = max(peak_score * 0.18, 0.025)

    weighted_targets: list[dict[str, float | str]] = []
    for target_name, raw_score in ranked_targets:
        if raw_score < minimum_score:
            continue
        weighted_targets.append(
            {
                "name": target_name,
                "weight": round(clamp(0.35 + normalized_ratio(raw_score, peak_score) * 0.65, 0.35, 1.0), 4),
            }
        )
        if len(weighted_targets) >= limit:
            break

    if weighted_targets:
        return weighted_targets
    return fallback if fallback is not None else default_focus_targets()


def resolve_focus_segment_count(frame_count: int) -> int:
    if frame_count <= 8:
        return 3
    if frame_count <= 20:
        return 4
    return 5


def resolve_focus_region(target_names: list[str]) -> str:
    arm_score = sum(1 for name in target_names if "Elbow" in name or "Wrist" in name)
    leg_score = sum(1 for name in target_names if "Knee" in name or "Ankle" in name)
    hip_score = sum(1 for name in target_names if "Hip" in name)

    if arm_score > leg_score and arm_score >= hip_score:
        return "arm"
    if leg_score > arm_score and leg_score >= hip_score:
        return "leg"
    if hip_score > 0:
        return "torso"
    return "body"


def default_focus_targets() -> list[dict[str, float | str]]:
    return [
        {"name": "leftElbow", "weight": 1.0},
        {"name": "rightElbow", "weight": 1.0},
        {"name": "leftKnee", "weight": 0.82},
        {"name": "rightKnee", "weight": 0.82},
    ]


def compute_symmetry_score(
    primary_left: float | None,
    primary_right: float | None,
    secondary_left: float | None,
    secondary_right: float | None,
) -> float | None:
    candidates: list[float] = []
    if primary_left is not None and primary_right is not None:
        candidates.append(clamp(1.0 - abs(primary_left - primary_right), 0.0, 1.0))
    if secondary_left is not None and secondary_right is not None:
        candidates.append(clamp(1.0 - abs(secondary_left - secondary_right), 0.0, 1.0))
    if not candidates:
        return None
    return safe_mean(candidates)


def normalized_distance(
    points: dict[str, dict[str, float]],
    torso_scale: float,
    first_name: str,
    second_name: str,
) -> float | None:
    first_point = points.get(first_name)
    second_point = points.get(second_name)
    if first_point is None or second_point is None:
        return None

    value = distance_xy(
        float(first_point.get("x", 0.0)),
        float(first_point.get("y", 0.0)),
        float(second_point.get("x", 0.0)),
        float(second_point.get("y", 0.0)),
    ) / max(torso_scale, 0.05)
    return clamp(value, 0.0, 2.0)


def compute_joint_angle(
    points: dict[str, dict[str, float]],
    start_name: str,
    joint_name: str,
    end_name: str,
) -> float | None:
    start = points.get(start_name)
    joint = points.get(joint_name)
    end = points.get(end_name)
    if start is None or joint is None or end is None:
        return None

    start_vector = (
        float(start.get("x", 0.0)) - float(joint.get("x", 0.0)),
        float(start.get("y", 0.0)) - float(joint.get("y", 0.0)),
    )
    end_vector = (
        float(end.get("x", 0.0)) - float(joint.get("x", 0.0)),
        float(end.get("y", 0.0)) - float(joint.get("y", 0.0)),
    )

    start_length = math.hypot(*start_vector)
    end_length = math.hypot(*end_vector)
    if start_length <= 1e-6 or end_length <= 1e-6:
        return None

    dot_product = start_vector[0] * end_vector[0] + start_vector[1] * end_vector[1]
    cosine_value = clamp(dot_product / (start_length * end_length), -1.0, 1.0)
    return math.acos(cosine_value)


def compute_torso_scale(points: dict[str, dict[str, float]]) -> float:
    left_shoulder = points.get("left_shoulder")
    right_shoulder = points.get("right_shoulder")
    left_hip = points.get("left_hip")
    right_hip = points.get("right_hip")
    if not left_shoulder or not right_shoulder or not left_hip or not right_hip:
        return 0.10

    shoulder_center = midpoint(left_shoulder, right_shoulder)
    hip_center = midpoint(left_hip, right_hip)
    shoulder_width = distance_points(left_shoulder, right_shoulder)
    hip_width = distance_points(left_hip, right_hip)
    torso_height = distance_xy(shoulder_center[0], shoulder_center[1], hip_center[0], hip_center[1])
    return max(0.05, shoulder_width, hip_width, torso_height)


def compute_body_center(points: dict[str, dict[str, float]]) -> tuple[float, float]:
    center_points = [
        points.get("left_shoulder"),
        points.get("right_shoulder"),
        points.get("left_hip"),
        points.get("right_hip"),
    ]
    valid_points = [point for point in center_points if point is not None]
    if not valid_points:
        valid_points = list(points.values())

    x_values = [float(point.get("x", 0.5)) for point in valid_points]
    y_values = [float(point.get("y", 0.5)) for point in valid_points]
    return safe_mean(x_values), safe_mean(y_values)


def detect_model_variant(model_path: Path) -> str:
    normalized_name = model_path.name.lower()
    if "heavy" in normalized_name:
        return "heavy"
    if "full" in normalized_name:
        return "full"
    if "lite" in normalized_name:
        return "lite"
    if "active" in normalized_name:
        return "active-alias"
    return "custom"


def resolve_detail_multiplier(analysis_budget_ms: int, model_variant: str) -> float:
    budget_multiplier = 1.0
    if analysis_budget_ms >= 20_000:
        budget_multiplier = 1.8
    elif analysis_budget_ms >= 12_000:
        budget_multiplier = 1.45
    elif analysis_budget_ms >= 8_000:
        budget_multiplier = 1.2

    model_bonus = 0.0
    if model_variant == "heavy":
        model_bonus = 0.15
    elif model_variant == "full":
        model_bonus = 0.08

    return clamp(budget_multiplier + model_bonus, 1.0, 2.0)


def build_signature(payload: AnalyzeRequest, landmarks: list[dict[str, Any]] | None = None) -> int:
    if landmarks:
        normalized_frames: list[dict[str, Any]] = []
        for frame in landmarks:
            points = sorted(frame.get("points", []), key=lambda point: point.get("name", ""))
            normalized_frames.append(
                {
                    "frameIndex": frame.get("frameIndex", 0),
                    "points": [
                        {
                            "name": point.get("name"),
                            "x": round(float(point.get("x", 0.0)), 4),
                            "y": round(float(point.get("y", 0.0)), 4),
                            "z": round(float(point.get("z", 0.0)), 4),
                            "visibility": round(float(point.get("visibility", 0.0)), 4),
                        }
                        for point in points
                    ],
                }
            )
        seed = json.dumps(normalized_frames, separators=(",", ":"), sort_keys=True)
    else:
        seed = f"{payload.sourceVideo.size}|{payload.runtime.timeoutMillis}"
    digest = sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 10_000


def bridge_error(status_code: int, error_code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "errorCode": error_code,
            "message": message,
        },
    )


POSE_LANDMARK_NAMES = {
    0: "nose",
    1: "left_eye_inner",
    2: "left_eye",
    3: "left_eye_outer",
    4: "right_eye_inner",
    5: "right_eye",
    6: "right_eye_outer",
    7: "left_ear",
    8: "right_ear",
    9: "mouth_left",
    10: "mouth_right",
    11: "left_shoulder",
    12: "right_shoulder",
    13: "left_elbow",
    14: "right_elbow",
    15: "left_wrist",
    16: "right_wrist",
    17: "left_pinky",
    18: "right_pinky",
    19: "left_index",
    20: "right_index",
    21: "left_thumb",
    22: "right_thumb",
    23: "left_hip",
    24: "right_hip",
    25: "left_knee",
    26: "right_knee",
    27: "left_ankle",
    28: "right_ankle",
    29: "left_heel",
    30: "right_heel",
    31: "left_foot_index",
    32: "right_foot_index",
}


def landmark_name(index: int) -> str:
    return POSE_LANDMARK_NAMES.get(index, f"landmark_{index}")


def task_landmark_name(index: int) -> str:
    return landmark_name(index)


def resolve_pose_landmarker_model_path() -> Path:
    configured_model_path = os.getenv("MEDIAPIPE_BRIDGE_MODEL_PATH", "").strip()
    project_root = Path(__file__).resolve().parents[1]
    models_root = project_root.joinpath("models").resolve()

    if configured_model_path:
        configured_path = Path(configured_model_path).resolve()
        if configured_path.exists():
            return configured_path

        print(
            "[bridge-model]",
            f"configuredPathMissing={configured_path}",
            f"modelsRoot={models_root}",
            flush=True,
        )

    for candidate_name in DEFAULT_MODEL_CANDIDATES:
        candidate_path = models_root.joinpath(candidate_name).resolve()
        if candidate_path.exists():
            return candidate_path

    return models_root.joinpath(DEFAULT_MODEL_CANDIDATES[-1]).resolve()


def resolve_video_path(storage_path: str) -> Path:
    path = Path(storage_path)
    if path.is_absolute():
        print("[bridge-path]", f"absolute={path}", flush=True)
        return path

    configured_backend_root = os.getenv("MOCHA_BACKEND_UPLOAD_ROOT", "").strip()
    if configured_backend_root:
        resolved = Path(configured_backend_root).joinpath(path).resolve()
        print("[bridge-path]", f"configuredRoot={configured_backend_root}", f"resolved={resolved}", flush=True)
        return resolved

    project_root = Path(__file__).resolve().parents[2]
    backend_upload_root = project_root.joinpath("backend", "uploads")
    resolved = backend_upload_root.joinpath(path).resolve()
    print("[bridge-path]", f"projectRoot={project_root}", f"resolved={resolved}", flush=True)
    return resolved


def midpoint(left: dict[str, float], right: dict[str, float]) -> tuple[float, float]:
    return (
        (float(left.get("x", 0.0)) + float(right.get("x", 0.0))) / 2.0,
        (float(left.get("y", 0.0)) + float(right.get("y", 0.0))) / 2.0,
    )


def distance_points(left: dict[str, float], right: dict[str, float]) -> float:
    return distance_xy(
        float(left.get("x", 0.0)),
        float(left.get("y", 0.0)),
        float(right.get("x", 0.0)),
        float(right.get("y", 0.0)),
    )


def distance_xy(left_x: float, left_y: float, right_x: float, right_y: float) -> float:
    return math.hypot(left_x - right_x, left_y - right_y)


def safe_mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return float(statistics.fmean(values))


def safe_pstdev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    return float(statistics.pstdev(values))


def average(left: float | None, right: float | None) -> float:
    values = [value for value in (left, right) if value is not None]
    return safe_mean(values) if values else 0.10


def max_or_zero(values: list[float]) -> float:
    return max(values) if values else 0.0


def normalized_ratio(value: float, maximum: float) -> float:
    if maximum <= 1e-6:
        return 0.0
    return clamp(value / maximum, 0.0, 1.0)


def count_motion_bursts(values: list[float]) -> int:
    if len(values) < 2:
        return 0
    threshold = safe_mean(values) + safe_pstdev(values)
    return sum(1 for value in values if value > threshold and value > 0.0)


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))
