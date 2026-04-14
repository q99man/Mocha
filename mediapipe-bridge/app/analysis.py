from __future__ import annotations

import json
import os
from hashlib import sha256
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from .schemas import AnalyzeRequest, AnalyzeResponse


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

    max_frames = max(8, min(24, total_frames if total_frames > 0 else 12))
    frame_step = max(1, total_frames // max_frames) if total_frames > 0 else 5

    model_path = resolve_pose_landmarker_model_path()
    if not model_path.exists():
        raise bridge_error(
            503,
            "POSE_LANDMARKER_MODEL_MISSING",
            "Pose landmarker model file is missing. Set MEDIAPIPE_BRIDGE_MODEL_PATH or place a .task model under "
            "mediapipe-bridge/models/pose_landmarker_lite.task.",
        )

    base_options = mp.tasks.BaseOptions(model_asset_path=str(model_path))
    options = PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=VisionTaskRunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_segmentation_masks=False,
    )

    sampled_landmarks: list[dict[str, Any]] = []
    processed_frames = 0
    frames_with_pose = 0

    with PoseLandmarker.create_from_options(options) as pose_landmarker:
        frame_index = 0
        while processed_frames < max_frames:
            ok, frame = cap.read()
            if not ok:
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
                        "phase": payload.analysisPhase,
                        "points": points,
                    }
                )
            processed_frames += 1
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

    return AnalyzeResponse(
        provider="mediapipe",
        analyzerName=analyzer_name,
        signature=signature,
        sampleCount=sample_count,
        durationMs=duration_ms,
        notes=[
            "Real MediaPipe Pose Landmarker extraction is active.",
            f"Processed frames: {processed_frames}",
            f"Frames with pose landmarks: {frames_with_pose}",
        ],
        landmarks=sampled_landmarks,
        extras={
            "bridgeMode": "FASTAPI",
            "analysisMode": "mediapipe",
            "bridgeVersion": "v1",
            "poseModel": "mediapipe-pose-landmarker",
            "schemaVersion": payload.schemaVersion,
            "analysisPhase": payload.analysisPhase,
            "storagePathEcho": payload.sourceVideo.storagePath,
            "modelPath": str(model_path),
            "fps": fps,
            "totalFrames": total_frames,
            "processedFrames": processed_frames,
            "framesWithPose": frames_with_pose,
        },
    )


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
    if configured_model_path:
        return Path(configured_model_path).resolve()

    project_root = Path(__file__).resolve().parents[1]
    return project_root.joinpath("models", "pose_landmarker_lite.task").resolve()


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
