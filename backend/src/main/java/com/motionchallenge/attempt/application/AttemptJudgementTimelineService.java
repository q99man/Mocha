package com.motionchallenge.attempt.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class AttemptJudgementTimelineService {

    private static final List<String> CORE_KEYPOINTS = List.of(
            "nose",
            "left_shoulder",
            "right_shoulder",
            "left_elbow",
            "right_elbow",
            "left_wrist",
            "right_wrist",
            "left_hip",
            "right_hip",
            "left_knee",
            "right_knee",
            "left_ankle",
            "right_ankle");

    private static final List<String> LEFT_ARM_POINTS = List.of("left_shoulder", "left_elbow", "left_wrist");
    private static final List<String> RIGHT_ARM_POINTS = List.of("right_shoulder", "right_elbow", "right_wrist");
    private static final List<String> LEFT_LEG_POINTS = List.of("left_hip", "left_knee", "left_ankle");
    private static final List<String> RIGHT_LEG_POINTS = List.of("right_hip", "right_knee", "right_ankle");
    private static final List<String> TORSO_LEFT_POINTS = List.of("nose", "left_shoulder", "left_hip");
    private static final List<String> TORSO_RIGHT_POINTS = List.of("nose", "right_shoulder", "right_hip");

    private final ObjectMapper objectMapper;

    public AttemptJudgementTimelineService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<AttemptJudgementCueResponse> buildTimeline(String referenceProfileData, String attemptProfileData) {
        ParsedProfile reference = parseProfile(referenceProfileData);
        ParsedProfile attempt = parseProfile(attemptProfileData);

        if (reference.frames().isEmpty() || attempt.frames().isEmpty()) {
            return List.of();
        }

        int cueCount = resolveCueCount(reference.frames().size(), attempt.frames().size());
        double referenceSpacingMs = cueCount <= 1
                ? Math.max(420.0, reference.durationMs())
                : reference.durationMs() / (double) (cueCount - 1);

        List<AttemptJudgementCueResponse> cues = new ArrayList<>();
        int combo = 0;

        for (int index = 0; index < cueCount; index++) {
            double ratio = cueCount == 1 ? 0.0 : index / (double) (cueCount - 1);
            FrameSnapshot referenceFrame = selectAlignedFrame(reference.frames(), index, cueCount);
            FrameSnapshot attemptFrame = selectAlignedFrame(attempt.frames(), index, cueCount);
            FrameSnapshot previousReferenceFrame = index > 0 ? selectAlignedFrame(reference.frames(), index - 1, cueCount) : null;

            int triggerMs = resolveTimestamp(referenceFrame.timestampMs(), ratio, reference.durationMs());
            int expectedAttemptMs = resolveExpectedAttemptTimestamp(ratio, attempt.durationMs());
            int actualAttemptMs = resolveTimestamp(attemptFrame.timestampMs(), ratio, attempt.durationMs());
            int offsetMs = clamp(actualAttemptMs - expectedAttemptMs, -220, 220);
            int windowMs = clamp((int) Math.round(referenceSpacingMs * 0.62), 120, 260);

            double poseDifference = comparePoseShape(referenceFrame.points(), attemptFrame.points());
            double referenceMotionAmount = previousReferenceFrame == null
                    ? 0.0
                    : computeFrameMotionAmount(previousReferenceFrame.points(), referenceFrame.points());
            double visibility = calculateAverageVisibility(attemptFrame.points());
            String verdict = resolveVerdict(poseDifference, offsetMs, visibility, referenceMotionAmount);
            double confidence = resolveConfidence(poseDifference, offsetMs, visibility);
            int lane = resolveLane(referenceFrame.points(), previousReferenceFrame != null ? previousReferenceFrame.points() : null, index);
            boolean accent = index % 4 == 0 || "PERFECT".equals(verdict) || "MISS".equals(verdict);

            combo = "MISS".equals(verdict) ? 0 : combo + 1;
            cues.add(new AttemptJudgementCueResponse(
                    index + 1,
                    index,
                    triggerMs / 1000,
                    triggerMs,
                    windowMs,
                    lane,
                    accent,
                    combo,
                    verdict,
                    "motion-analysis",
                    offsetMs,
                    round(confidence, 3)));
        }

        return cues;
    }

    public String serializeTimeline(List<AttemptJudgementCueResponse> timeline) {
        try {
            return objectMapper.writeValueAsString(timeline == null ? List.of() : timeline);
        } catch (JsonProcessingException exception) {
            return "[]";
        }
    }

    public List<AttemptJudgementCueResponse> readTimeline(String rawTimelineData) {
        if (rawTimelineData == null || rawTimelineData.isBlank()) {
            return List.of();
        }

        try {
            JsonNode root = objectMapper.readTree(rawTimelineData);
            if (!root.isArray()) {
                return List.of();
            }

            List<AttemptJudgementCueResponse> cues = new ArrayList<>();
            for (JsonNode cueNode : root) {
                cues.add(new AttemptJudgementCueResponse(
                        cueNode.path("id").asInt(),
                        cueNode.path("beatIndex").asInt(),
                        cueNode.path("second").asInt(),
                        cueNode.path("triggerMs").asInt(),
                        cueNode.path("windowMs").asInt(),
                        cueNode.path("lane").asInt(),
                        cueNode.path("accent").asBoolean(false),
                        cueNode.path("combo").asInt(),
                        cueNode.path("verdict").asText("MISS"),
                        cueNode.path("source").asText("motion-analysis"),
                        cueNode.path("offsetMs").asInt(),
                        cueNode.path("confidence").asDouble(0.0)));
            }
            return cues;
        } catch (IOException exception) {
            return List.of();
        }
    }

    private ParsedProfile parseProfile(String rawProfileData) {
        try {
            JsonNode root = objectMapper.readTree(rawProfileData);
            List<FrameSnapshot> frames = new ArrayList<>();
            for (JsonNode frameNode : root.path("landmarks")) {
                int frameIndex = frameNode.path("frameIndex").asInt(frames.size());
                int timestampMs = frameNode.path("timestampMs").asInt(frameIndex * 33);
                Map<String, LandmarkPoint> points = new LinkedHashMap<>();
                for (JsonNode pointNode : frameNode.path("points")) {
                    String name = pointNode.path("name").asText();
                    if (name == null || name.isBlank()) {
                        continue;
                    }
                    points.put(name, new LandmarkPoint(
                            pointNode.path("x").asDouble(),
                            pointNode.path("y").asDouble(),
                            pointNode.path("z").asDouble(),
                            pointNode.path("visibility").asDouble(0.0)));
                }
                if (!points.isEmpty()) {
                    frames.add(new FrameSnapshot(frameIndex, timestampMs, points));
                }
            }

            long durationMs = root.path("metrics").path("durationMs").asLong(Math.max(1, frames.size() * 33L));
            if (durationMs <= 0) {
                durationMs = Math.max(1, frames.size() * 33L);
            }
            return new ParsedProfile(frames, durationMs);
        } catch (IOException exception) {
            return new ParsedProfile(List.of(), 1L);
        }
    }

    private int resolveCueCount(int referenceFrameCount, int attemptFrameCount) {
        int availableFrames = Math.max(1, Math.min(referenceFrameCount, attemptFrameCount));
        return clamp(availableFrames, 6, 14);
    }

    private FrameSnapshot selectAlignedFrame(List<FrameSnapshot> frames, int index, int totalComparisons) {
        if (frames.size() == 1 || totalComparisons == 1) {
            return frames.get(0);
        }
        double ratio = index / (double) (totalComparisons - 1);
        int targetIndex = (int) Math.round(ratio * (frames.size() - 1));
        return frames.get(clamp(targetIndex, 0, frames.size() - 1));
    }

    private int resolveTimestamp(int timestampMs, double ratio, long durationMs) {
        if (timestampMs > 0) {
            return timestampMs;
        }
        return (int) Math.round(ratio * Math.max(durationMs, 1L));
    }

    private int resolveExpectedAttemptTimestamp(double ratio, long attemptDurationMs) {
        return (int) Math.round(ratio * Math.max(attemptDurationMs, 1L));
    }

    private double comparePoseShape(Map<String, LandmarkPoint> referencePoints, Map<String, LandmarkPoint> attemptPoints) {
        LandmarkAnchor referenceAnchor = buildAnchor(referencePoints);
        LandmarkAnchor attemptAnchor = buildAnchor(attemptPoints);

        List<Double> distances = new ArrayList<>();
        for (String pointName : CORE_KEYPOINTS) {
            LandmarkPoint referencePoint = referencePoints.get(pointName);
            LandmarkPoint attemptPoint = attemptPoints.get(pointName);
            if (referencePoint == null || attemptPoint == null) {
                continue;
            }

            double referenceNormalizedX = (referencePoint.x() - referenceAnchor.centerX()) / referenceAnchor.scale();
            double referenceNormalizedY = (referencePoint.y() - referenceAnchor.centerY()) / referenceAnchor.scale();
            double attemptNormalizedX = (attemptPoint.x() - attemptAnchor.centerX()) / attemptAnchor.scale();
            double attemptNormalizedY = (attemptPoint.y() - attemptAnchor.centerY()) / attemptAnchor.scale();

            distances.add(Math.hypot(referenceNormalizedX - attemptNormalizedX, referenceNormalizedY - attemptNormalizedY));
        }

        double jointDifference = average(
                compareJointAngle(referencePoints, attemptPoints, "left_shoulder", "left_elbow", "left_wrist"),
                compareJointAngle(referencePoints, attemptPoints, "right_shoulder", "right_elbow", "right_wrist"),
                compareJointAngle(referencePoints, attemptPoints, "left_hip", "left_knee", "left_ankle"),
                compareJointAngle(referencePoints, attemptPoints, "right_hip", "right_knee", "right_ankle"));

        double pointDifference = distances.stream().mapToDouble(Double::doubleValue).average().orElse(1.0);
        return pointDifference * 0.72 + jointDifference * 0.28;
    }

    private double compareJointAngle(
            Map<String, LandmarkPoint> referencePoints,
            Map<String, LandmarkPoint> attemptPoints,
            String startName,
            String jointName,
            String endName) {
        Optional<Double> referenceAngle = computeJointAngle(referencePoints, startName, jointName, endName);
        Optional<Double> attemptAngle = computeJointAngle(attemptPoints, startName, jointName, endName);
        if (referenceAngle.isEmpty() || attemptAngle.isEmpty()) {
            return 0.0;
        }
        return Math.abs(referenceAngle.get() - attemptAngle.get()) / Math.PI;
    }

    private Optional<Double> computeJointAngle(
            Map<String, LandmarkPoint> points,
            String startName,
            String jointName,
            String endName) {
        LandmarkPoint start = points.get(startName);
        LandmarkPoint joint = points.get(jointName);
        LandmarkPoint end = points.get(endName);
        if (start == null || joint == null || end == null) {
            return Optional.empty();
        }

        double firstX = start.x() - joint.x();
        double firstY = start.y() - joint.y();
        double secondX = end.x() - joint.x();
        double secondY = end.y() - joint.y();
        double firstLength = Math.hypot(firstX, firstY);
        double secondLength = Math.hypot(secondX, secondY);
        if (firstLength <= 1e-6 || secondLength <= 1e-6) {
            return Optional.empty();
        }

        double cosine = clampDouble((firstX * secondX + firstY * secondY) / (firstLength * secondLength), -1.0, 1.0);
        return Optional.of(Math.acos(cosine));
    }

    private double computeFrameMotionAmount(Map<String, LandmarkPoint> previousPoints, Map<String, LandmarkPoint> currentPoints) {
        LandmarkAnchor currentAnchor = buildAnchor(currentPoints);
        List<Double> motions = new ArrayList<>();
        for (String pointName : CORE_KEYPOINTS) {
            LandmarkPoint previousPoint = previousPoints.get(pointName);
            LandmarkPoint currentPoint = currentPoints.get(pointName);
            if (previousPoint == null || currentPoint == null) {
                continue;
            }
            motions.add(Math.hypot(previousPoint.x() - currentPoint.x(), previousPoint.y() - currentPoint.y()) / currentAnchor.scale());
        }
        return motions.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private String resolveVerdict(double poseDifference, int offsetMs, double visibility, double referenceMotionAmount) {
        double absOffset = Math.abs(offsetMs);
        if (visibility < 0.34 || poseDifference > 0.28) {
            return "MISS";
        }
        if (referenceMotionAmount < 0.05 && poseDifference <= 0.12 && absOffset <= 65.0) {
            return "HOLD";
        }
        if (poseDifference <= 0.07 && absOffset <= 28.0) {
            return "PERFECT";
        }
        if (poseDifference <= 0.13 && absOffset <= 60.0) {
            return "GOOD";
        }
        if (offsetMs <= -45 && poseDifference <= 0.20) {
            return "EARLY";
        }
        if (offsetMs >= 45 && poseDifference <= 0.20) {
            return "LATE";
        }
        if (poseDifference <= 0.18 && visibility >= 0.55) {
            return "GOOD";
        }
        return "MISS";
    }

    private double resolveConfidence(double poseDifference, int offsetMs, double visibility) {
        double offsetPenalty = Math.min(1.0, Math.abs(offsetMs) / 210.0);
        double posePenalty = Math.min(1.0, poseDifference / 0.3);
        return clampDouble((visibility * 0.5) + ((1.0 - posePenalty) * 0.3) + ((1.0 - offsetPenalty) * 0.2), 0.18, 0.99);
    }

    private int resolveLane(Map<String, LandmarkPoint> currentPoints, Map<String, LandmarkPoint> previousPoints, int fallbackIndex) {
        if (previousPoints == null || previousPoints.isEmpty()) {
            return fallbackIndex % 6;
        }

        Map<Integer, Double> laneScores = new HashMap<>();
        laneScores.put(0, computeRegionMotion(previousPoints, currentPoints, LEFT_LEG_POINTS));
        laneScores.put(1, computeRegionMotion(previousPoints, currentPoints, LEFT_ARM_POINTS));
        laneScores.put(2, computeRegionMotion(previousPoints, currentPoints, TORSO_LEFT_POINTS));
        laneScores.put(3, computeRegionMotion(previousPoints, currentPoints, TORSO_RIGHT_POINTS));
        laneScores.put(4, computeRegionMotion(previousPoints, currentPoints, RIGHT_ARM_POINTS));
        laneScores.put(5, computeRegionMotion(previousPoints, currentPoints, RIGHT_LEG_POINTS));

        int bestLane = fallbackIndex % 6;
        double bestScore = 0.0;
        for (Map.Entry<Integer, Double> entry : laneScores.entrySet()) {
            if (entry.getValue() > bestScore) {
                bestScore = entry.getValue();
                bestLane = entry.getKey();
            }
        }
        return bestLane;
    }

    private double computeRegionMotion(
            Map<String, LandmarkPoint> previousPoints,
            Map<String, LandmarkPoint> currentPoints,
            List<String> regionPointNames) {
        LandmarkAnchor currentAnchor = buildAnchor(currentPoints);
        List<Double> motions = new ArrayList<>();
        for (String pointName : regionPointNames) {
            LandmarkPoint previousPoint = previousPoints.get(pointName);
            LandmarkPoint currentPoint = currentPoints.get(pointName);
            if (previousPoint == null || currentPoint == null) {
                continue;
            }
            motions.add(Math.hypot(previousPoint.x() - currentPoint.x(), previousPoint.y() - currentPoint.y()) / currentAnchor.scale());
        }
        return motions.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private double calculateAverageVisibility(Map<String, LandmarkPoint> points) {
        return points.values().stream().mapToDouble(LandmarkPoint::visibility).average().orElse(0.0);
    }

    private LandmarkAnchor buildAnchor(Map<String, LandmarkPoint> points) {
        LandmarkPoint leftShoulder = points.get("left_shoulder");
        LandmarkPoint rightShoulder = points.get("right_shoulder");
        LandmarkPoint leftHip = points.get("left_hip");
        LandmarkPoint rightHip = points.get("right_hip");

        if (leftShoulder != null && rightShoulder != null && leftHip != null && rightHip != null) {
            double shoulderCenterX = (leftShoulder.x() + rightShoulder.x()) / 2.0;
            double shoulderCenterY = (leftShoulder.y() + rightShoulder.y()) / 2.0;
            double hipCenterX = (leftHip.x() + rightHip.x()) / 2.0;
            double hipCenterY = (leftHip.y() + rightHip.y()) / 2.0;
            double centerX = (shoulderCenterX + hipCenterX) / 2.0;
            double centerY = (shoulderCenterY + hipCenterY) / 2.0;
            double shoulderWidth = Math.hypot(leftShoulder.x() - rightShoulder.x(), leftShoulder.y() - rightShoulder.y());
            double hipWidth = Math.hypot(leftHip.x() - rightHip.x(), leftHip.y() - rightHip.y());
            double torsoHeight = Math.hypot(shoulderCenterX - hipCenterX, shoulderCenterY - hipCenterY);
            return new LandmarkAnchor(centerX, centerY, Math.max(0.08, Math.max(torsoHeight, Math.max(shoulderWidth, hipWidth))));
        }

        double centerX = points.values().stream().mapToDouble(LandmarkPoint::x).average().orElse(0.5);
        double centerY = points.values().stream().mapToDouble(LandmarkPoint::y).average().orElse(0.5);
        double minX = points.values().stream().mapToDouble(LandmarkPoint::x).min().orElse(centerX - 0.1);
        double maxX = points.values().stream().mapToDouble(LandmarkPoint::x).max().orElse(centerX + 0.1);
        double minY = points.values().stream().mapToDouble(LandmarkPoint::y).min().orElse(centerY - 0.1);
        double maxY = points.values().stream().mapToDouble(LandmarkPoint::y).max().orElse(centerY + 0.1);
        return new LandmarkAnchor(centerX, centerY, Math.max(0.08, Math.hypot(maxX - minX, maxY - minY)));
    }

    private double average(double... values) {
        double total = 0.0;
        int count = 0;
        for (double value : values) {
            total += value;
            count += 1;
        }
        return count == 0 ? 0.0 : total / count;
    }

    private double round(double value, int precision) {
        double multiplier = Math.pow(10, precision);
        return Math.round(value * multiplier) / multiplier;
    }

    private int clamp(int value, int minValue, int maxValue) {
        return Math.max(minValue, Math.min(maxValue, value));
    }

    private double clampDouble(double value, double minValue, double maxValue) {
        return Math.max(minValue, Math.min(maxValue, value));
    }

    private record ParsedProfile(List<FrameSnapshot> frames, long durationMs) {
    }

    private record FrameSnapshot(int frameIndex, int timestampMs, Map<String, LandmarkPoint> points) {
    }

    private record LandmarkPoint(double x, double y, double z, double visibility) {
    }

    private record LandmarkAnchor(double centerX, double centerY, double scale) {
    }
}
