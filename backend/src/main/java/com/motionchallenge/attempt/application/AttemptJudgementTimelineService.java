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
        List<CueAnchor> cueAnchors = buildCueAnchors(reference, cueCount);

        List<JudgementSample> samples = new ArrayList<>();

        for (int index = 0; index < cueCount; index++) {
            CueAnchor cueAnchor = cueAnchors.get(index);
            double ratio = cueAnchor.ratio();
            FrameSnapshot referenceFrame = reference.frames().get(cueAnchor.frameIndex());
            FrameSnapshot previousReferenceFrame = cueAnchor.frameIndex() > 0
                    ? reference.frames().get(cueAnchor.frameIndex() - 1)
                    : null;

            int triggerMs = resolveTimestamp(referenceFrame.timestampMs(), ratio, reference.durationMs());
            int expectedAttemptMs = resolveExpectedAttemptTimestamp(ratio, attempt.durationMs());
            int windowMs = resolveCueWindowMs(cueAnchors, index, reference.durationMs());
            FrameSnapshot attemptFrame = selectBestAlignedAttemptFrame(
                    attempt.frames(),
                    referenceFrame,
                    reference.focusProfile(),
                    ratio,
                    windowMs);
            int actualAttemptMs = resolveTimestamp(attemptFrame.timestampMs(), ratio, attempt.durationMs());
            int offsetMs = clamp(actualAttemptMs - expectedAttemptMs, -220, 220);

            double poseDifference = comparePoseShape(referenceFrame.points(), attemptFrame.points(), reference.focusProfile(), ratio);
            double referenceMotionAmount = previousReferenceFrame == null
                    ? 0.0
                    : computeFrameMotionAmount(previousReferenceFrame.points(), referenceFrame.points());
            double visibility = calculateAverageVisibility(attemptFrame.points());
            JudgementThresholds thresholds = resolveJudgementThresholds(
                    referenceMotionAmount,
                    visibility,
                    reference.focusProfile(),
                    ratio);
            String verdict = resolveVerdict(poseDifference, offsetMs, visibility, thresholds);
            double confidence = resolveConfidence(poseDifference, offsetMs, visibility, thresholds);
            int lane = resolveLane(
                    referenceFrame.points(),
                    previousReferenceFrame != null ? previousReferenceFrame.points() : null,
                    index,
                    reference.focusProfile(),
                    ratio);
            boolean accent = cueAnchor.accent() || "PERFECT".equals(verdict) || "MISS".equals(verdict);

            samples.add(new JudgementSample(
                    index + 1,
                    index,
                    triggerMs / 1000,
                    triggerMs,
                    windowMs,
                    lane,
                    accent,
                    offsetMs,
                    verdict,
                    poseDifference,
                    visibility,
                    confidence,
                    thresholds));
        }

        return finalizeJudgements(samples);
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
            JsonNode analysisSummary = root.path("extras").path("analysisSummary");
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
            return new ParsedProfile(frames, durationMs, parseFocusProfile(analysisSummary.path("focusProfile")));
        } catch (IOException exception) {
            return new ParsedProfile(List.of(), 1L, FocusProfile.empty());
        }
    }

    private FocusProfile parseFocusProfile(JsonNode focusProfileNode) {
        if (!focusProfileNode.isObject()) {
            return FocusProfile.empty();
        }

        List<WeightedFocusTarget> primaryJoints = new ArrayList<>();
        for (JsonNode jointNode : focusProfileNode.path("primaryJoints")) {
            String name = jointNode.path("name").asText();
            if (name == null || name.isBlank()) {
                continue;
            }
            primaryJoints.add(new WeightedFocusTarget(
                    name,
                    clampDouble(jointNode.path("weight").asDouble(0.0), 0.0, 1.0)));
        }

        List<FocusSegment> segments = new ArrayList<>();
        for (JsonNode segmentNode : focusProfileNode.path("segments")) {
            String key = segmentNode.path("key").asText();
            if (key == null || key.isBlank()) {
                continue;
            }

            Map<String, Double> jointWeights = new LinkedHashMap<>();
            JsonNode jointWeightsNode = segmentNode.path("jointWeights");
            if (jointWeightsNode.isObject()) {
                jointWeightsNode.fields().forEachRemaining(entry -> jointWeights.put(
                        entry.getKey(),
                        clampDouble(entry.getValue().asDouble(0.0), 0.0, 1.0)));
            }

            segments.add(new FocusSegment(
                    key,
                    clampDouble(segmentNode.path("startRatio").asDouble(0.0), 0.0, 1.0),
                    clampDouble(segmentNode.path("endRatio").asDouble(1.0), 0.0, 1.0),
                    clampDouble(segmentNode.path("poseWeight").asDouble(0.0), 0.0, 1.0),
                    clampDouble(segmentNode.path("timingWeight").asDouble(0.0), 0.0, 1.0),
                    segmentNode.path("dominantRegion").asText("body"),
                    Map.copyOf(jointWeights)));
        }

        return new FocusProfile(List.copyOf(primaryJoints), List.copyOf(segments));
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

    private FrameSnapshot selectAlignedFrameByRatio(List<FrameSnapshot> frames, double ratio) {
        if (frames.size() == 1) {
            return frames.get(0);
        }
        int targetIndex = (int) Math.round(clampDouble(ratio, 0.0, 1.0) * (frames.size() - 1));
        return frames.get(clamp(targetIndex, 0, frames.size() - 1));
    }

    private FrameSnapshot selectBestAlignedAttemptFrame(
            List<FrameSnapshot> frames,
            FrameSnapshot referenceFrame,
            FocusProfile focusProfile,
            double ratio,
            int windowMs) {
        if (frames.size() == 1) {
            return frames.get(0);
        }

        int targetIndex = (int) Math.round(clampDouble(ratio, 0.0, 1.0) * (frames.size() - 1));
        int frameRadius = Math.max(2, Math.min(18, (int) Math.round(frames.size() * 0.08)));
        int startIndex = Math.max(0, targetIndex - frameRadius);
        int endIndex = Math.min(frames.size() - 1, targetIndex + frameRadius);

        FrameSnapshot bestFrame = frames.get(targetIndex);
        double bestScore = alignmentScore(referenceFrame, bestFrame, focusProfile, ratio, targetIndex, targetIndex, windowMs);
        for (int candidateIndex = startIndex; candidateIndex <= endIndex; candidateIndex++) {
            FrameSnapshot candidate = frames.get(candidateIndex);
            double candidateScore = alignmentScore(
                    referenceFrame,
                    candidate,
                    focusProfile,
                    ratio,
                    candidateIndex,
                    targetIndex,
                    windowMs);
            if (candidateScore < bestScore) {
                bestScore = candidateScore;
                bestFrame = candidate;
            }
        }
        return bestFrame;
    }

    private double alignmentScore(
            FrameSnapshot referenceFrame,
            FrameSnapshot attemptFrame,
            FocusProfile focusProfile,
            double ratio,
            int candidateIndex,
            int targetIndex,
            int windowMs) {
        double poseDifference = comparePoseShape(referenceFrame.points(), attemptFrame.points(), focusProfile, ratio);
        double visibilityPenalty = Math.max(0.0, 0.78 - calculateAverageVisibility(attemptFrame.points())) * 0.18;
        double indexPenalty = Math.abs(candidateIndex - targetIndex) / (double) Math.max(1, Math.abs(targetIndex) + 3);
        double windowPenalty = Math.max(0.0, 0.18 - (windowMs / 1000.0)) * 0.03;
        return poseDifference + visibilityPenalty + (indexPenalty * 0.10) + windowPenalty;
    }

    private List<CueAnchor> buildCueAnchors(ParsedProfile reference, int cueCount) {
        List<FrameSnapshot> frames = reference.frames();
        if (frames.isEmpty()) {
            return List.of();
        }

        if (frames.size() == 1) {
            return buildFallbackCueAnchors(reference.durationMs(), cueCount);
        }

        List<CueCandidate> candidates = new ArrayList<>();
        for (int index = 0; index < frames.size(); index++) {
            FrameSnapshot currentFrame = frames.get(index);
            FrameSnapshot previousFrame = index > 0 ? frames.get(index - 1) : null;
            double ratio = index / (double) (frames.size() - 1);
            double motionAmount = previousFrame == null
                    ? computeFrameMotionAmount(currentFrame.points(), frames.get(Math.min(index + 1, frames.size() - 1)).points())
                    : computeFrameMotionAmount(previousFrame.points(), currentFrame.points());
            double visibility = calculateAverageVisibility(currentFrame.points());
            FocusSegment segment = resolveFocusSegment(reference.focusProfile(), ratio);
            double timingWeight = segment != null ? segment.timingWeight() : 0.0;
            double poseWeight = segment != null ? segment.poseWeight() : 0.0;
            double segmentBonus = segment != null && "impact".equalsIgnoreCase(segment.key()) ? 0.16 : 0.0;
            double score = motionAmount * (0.82 + timingWeight * 0.72 + poseWeight * 0.14)
                    + visibility * 0.10
                    + segmentBonus;
            boolean accent = segment != null && ("impact".equalsIgnoreCase(segment.key()) || timingWeight >= 0.82);

            candidates.add(new CueCandidate(
                    index,
                    ratio,
                    resolveTimestamp(currentFrame.timestampMs(), ratio, reference.durationMs()),
                    score,
                    accent));
        }

        List<CueCandidate> selected = new ArrayList<>();
        int minSpacing = Math.max(1, (int) Math.round(frames.size() / (double) Math.max(cueCount, 1) * 0.55));
        if (!candidates.isEmpty()) {
            selected.add(candidates.get(0));
            selected.add(candidates.get(candidates.size() - 1));
        }

        List<CueCandidate> rankedCandidates = new ArrayList<>(candidates);
        rankedCandidates.sort((left, right) -> Double.compare(right.score(), left.score()));
        for (CueCandidate candidate : rankedCandidates) {
            if (selected.size() >= cueCount) {
                break;
            }
            if (isSeparatedCandidate(candidate, selected, minSpacing)) {
                selected.add(candidate);
            }
        }

        for (int index = 0; selected.size() < cueCount; index++) {
            double ratio = cueCount == 1 ? 0.0 : index / (double) (cueCount - 1);
            CueCandidate fallbackCandidate = candidateForRatio(reference, ratio);
            selected.add(fallbackCandidate);
        }

        selected.sort((left, right) -> {
            int ratioCompare = Double.compare(left.ratio(), right.ratio());
            if (ratioCompare != 0) {
                return ratioCompare;
            }
            return Integer.compare(left.frameIndex(), right.frameIndex());
        });

        if (selected.size() > cueCount) {
            selected = new ArrayList<>(selected.subList(0, cueCount));
        }

        List<CueAnchor> anchors = new ArrayList<>();
        for (CueCandidate candidate : selected) {
            anchors.add(new CueAnchor(candidate.frameIndex(), candidate.ratio(), candidate.timestampMs(), candidate.accent()));
        }
        return anchors;
    }

    private List<CueAnchor> buildFallbackCueAnchors(long durationMs, int cueCount) {
        List<CueAnchor> anchors = new ArrayList<>();
        for (int index = 0; index < cueCount; index++) {
            double ratio = cueCount == 1 ? 0.0 : index / (double) (cueCount - 1);
            anchors.add(new CueAnchor(
                    0,
                    ratio,
                    resolveTimestamp(0, ratio, durationMs),
                    index % 4 == 0));
        }
        return anchors;
    }

    private CueCandidate candidateForRatio(ParsedProfile reference, double ratio) {
        FrameSnapshot frame = selectAlignedFrameByRatio(reference.frames(), ratio);
        int frameIndex = reference.frames().indexOf(frame);
        FocusSegment segment = resolveFocusSegment(reference.focusProfile(), ratio);
        return new CueCandidate(
                frameIndex,
                ratio,
                resolveTimestamp(frame.timestampMs(), ratio, reference.durationMs()),
                0.0,
                segment != null && "impact".equalsIgnoreCase(segment.key()));
    }

    private boolean isSeparatedCandidate(CueCandidate candidate, List<CueCandidate> selected, int minSpacing) {
        for (CueCandidate existing : selected) {
            if (Math.abs(existing.frameIndex() - candidate.frameIndex()) < minSpacing) {
                return false;
            }
        }
        return true;
    }

    private int resolveCueWindowMs(List<CueAnchor> anchors, int index, long durationMs) {
        if (anchors.size() <= 1) {
            return clamp((int) Math.round(Math.max(420.0, durationMs) * 0.62), 120, 260);
        }

        CueAnchor current = anchors.get(index);
        int previousGap = index > 0
                ? Math.max(60, current.timestampMs() - anchors.get(index - 1).timestampMs())
                : Integer.MAX_VALUE;
        int nextGap = index + 1 < anchors.size()
                ? Math.max(60, anchors.get(index + 1).timestampMs() - current.timestampMs())
                : Integer.MAX_VALUE;
        int localGap = Math.min(previousGap, nextGap);
        if (localGap == Integer.MAX_VALUE) {
            localGap = (int) Math.max(420.0, durationMs / (double) Math.max(anchors.size(), 1));
        }
        return clamp((int) Math.round(localGap * 0.62), 120, 260);
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

    private double comparePoseShape(
            Map<String, LandmarkPoint> referencePoints,
            Map<String, LandmarkPoint> attemptPoints,
            FocusProfile focusProfile,
            double ratio) {
        LandmarkAnchor referenceAnchor = buildAnchor(referencePoints);
        LandmarkAnchor attemptAnchor = buildAnchor(attemptPoints);
        Map<String, Double> focusJointWeights = aggregateFocusJointWeights(focusProfile, ratio);

        double weightedPointTotal = 0.0;
        double pointWeightTotal = 0.0;
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

            double weight = resolvePointWeight(pointName, focusJointWeights);
            weightedPointTotal += Math.hypot(referenceNormalizedX - attemptNormalizedX, referenceNormalizedY - attemptNormalizedY) * weight;
            pointWeightTotal += weight;
        }

        double weightedJointTotal = 0.0;
        double jointWeightTotal = 0.0;
        weightedJointTotal += compareJointAngle(referencePoints, attemptPoints, "left_shoulder", "left_elbow", "left_wrist")
                * resolveJointWeight("leftElbow", focusJointWeights);
        jointWeightTotal += resolveJointWeight("leftElbow", focusJointWeights);
        weightedJointTotal += compareJointAngle(referencePoints, attemptPoints, "right_shoulder", "right_elbow", "right_wrist")
                * resolveJointWeight("rightElbow", focusJointWeights);
        jointWeightTotal += resolveJointWeight("rightElbow", focusJointWeights);
        weightedJointTotal += compareJointAngle(referencePoints, attemptPoints, "left_hip", "left_knee", "left_ankle")
                * resolveJointWeight("leftKnee", focusJointWeights);
        jointWeightTotal += resolveJointWeight("leftKnee", focusJointWeights);
        weightedJointTotal += compareJointAngle(referencePoints, attemptPoints, "right_hip", "right_knee", "right_ankle")
                * resolveJointWeight("rightKnee", focusJointWeights);
        jointWeightTotal += resolveJointWeight("rightKnee", focusJointWeights);

        double pointDifference = pointWeightTotal > 0.0 ? weightedPointTotal / pointWeightTotal : 1.0;
        double jointDifference = jointWeightTotal > 0.0 ? weightedJointTotal / jointWeightTotal : 1.0;
        return (pointDifference * 0.72 + jointDifference * 0.28) * resolvePoseSensitivity(focusProfile, ratio);
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

    private JudgementThresholds resolveJudgementThresholds(
            double referenceMotionAmount,
            double visibility,
            FocusProfile focusProfile,
            double ratio) {
        double timingStrictness = resolveTimingStrictness(focusProfile, ratio);
        double poseSensitivity = resolvePoseSensitivity(focusProfile, ratio);
        double motionScale = clampDouble(referenceMotionAmount / 0.18, 0.0, 1.0);
        double lowVisibilityPenalty = visibility < 0.55 ? (0.55 - visibility) * 0.15 : 0.0;

        double perfectPoseThreshold = clampDouble((0.070 + motionScale * 0.020) / poseSensitivity, 0.048, 0.102);
        double goodPoseThreshold = clampDouble((0.148 + motionScale * 0.038) / poseSensitivity, 0.098, 0.192);
        double missPoseThreshold = clampDouble((0.292 + motionScale * 0.028) / poseSensitivity, 0.24, 0.34);
        double holdPoseThreshold = clampDouble((0.105 - motionScale * 0.020) / poseSensitivity, 0.065, 0.12);

        double perfectOffsetThreshold = clampDouble((30.0 - motionScale * 5.0) / timingStrictness, 15.0, 34.0);
        double goodOffsetThreshold = clampDouble((66.0 - motionScale * 8.0) / timingStrictness, 38.0, 74.0);
        double holdOffsetThreshold = clampDouble((68.0 + (1.0 - motionScale) * 10.0) / timingStrictness, 44.0, 82.0);
        double earlyLateThreshold = clampDouble((48.0 - motionScale * 7.0) / timingStrictness, 26.0, 56.0);

        return new JudgementThresholds(
                perfectPoseThreshold + lowVisibilityPenalty,
                goodPoseThreshold + lowVisibilityPenalty,
                holdPoseThreshold + lowVisibilityPenalty,
                missPoseThreshold + lowVisibilityPenalty,
                perfectOffsetThreshold,
                goodOffsetThreshold,
                holdOffsetThreshold,
                earlyLateThreshold,
                referenceMotionAmount < 0.05);
    }

    private String resolveVerdict(
            double poseDifference,
            int offsetMs,
            double visibility,
            JudgementThresholds thresholds) {
        double absOffset = Math.abs(offsetMs);

        if (visibility < 0.34 || poseDifference > thresholds.missPoseThreshold()) {
            return "MISS";
        }
        if (thresholds.holdEligible()
                && poseDifference <= thresholds.holdPoseThreshold()
                && absOffset <= thresholds.holdOffsetThreshold()) {
            return "HOLD";
        }
        if (poseDifference <= thresholds.perfectPoseThreshold() && absOffset <= thresholds.perfectOffsetThreshold()) {
            return "PERFECT";
        }
        if (poseDifference <= thresholds.goodPoseThreshold() && absOffset <= thresholds.goodOffsetThreshold()) {
            return "GOOD";
        }
        if (offsetMs <= -thresholds.earlyLateThreshold() && poseDifference <= thresholds.goodPoseThreshold() + 0.08) {
            return "EARLY";
        }
        if (offsetMs >= thresholds.earlyLateThreshold() && poseDifference <= thresholds.goodPoseThreshold() + 0.08) {
            return "LATE";
        }
        if (poseDifference <= thresholds.goodPoseThreshold() + 0.06 && visibility >= 0.52) {
            return "GOOD";
        }
        return "MISS";
    }

    private double resolveConfidence(
            double poseDifference,
            int offsetMs,
            double visibility,
            JudgementThresholds thresholds) {
        double offsetPenalty = Math.min(1.0, Math.abs(offsetMs) / 210.0);
        double posePenalty = Math.min(1.0, poseDifference / Math.max(thresholds.missPoseThreshold(), 1e-6));
        double baseConfidence = (visibility * 0.48) + ((1.0 - posePenalty) * 0.34) + ((1.0 - offsetPenalty) * 0.18);
        if (thresholds.holdEligible() && poseDifference <= thresholds.holdPoseThreshold()) {
            baseConfidence += 0.04;
        }
        return clampDouble(baseConfidence, 0.18, 0.99);
    }

    private List<AttemptJudgementCueResponse> finalizeJudgements(List<JudgementSample> samples) {
        if (samples.isEmpty()) {
            return List.of();
        }

        List<Integer> perfectIndexes = resolvePerfectIndexes(samples);
        List<Integer> recoverableIndexes = resolveRecoverableIndexes(samples);
        List<AttemptJudgementCueResponse> cues = new ArrayList<>();
        int combo = 0;

        for (int index = 0; index < samples.size(); index++) {
            JudgementSample sample = samples.get(index);
            boolean perfectCandidate = perfectIndexes.contains(index);
            boolean recoverableCandidate = recoverableIndexes.contains(index);
            String calibratedVerdict = calibrateVerdict(samples, index, perfectCandidate, recoverableCandidate);
            double calibratedConfidence = calibrateConfidence(sample, calibratedVerdict, perfectCandidate, recoverableCandidate);
            combo = "MISS".equals(calibratedVerdict) ? 0 : combo + 1;
            cues.add(new AttemptJudgementCueResponse(
                    sample.id(),
                    sample.beatIndex(),
                    sample.second(),
                    sample.triggerMs(),
                    sample.windowMs(),
                    sample.lane(),
                    sample.accent() || "PERFECT".equals(calibratedVerdict) || "MISS".equals(calibratedVerdict),
                    combo,
                    calibratedVerdict,
                    "motion-analysis",
                    sample.offsetMs(),
                    round(calibratedConfidence, 3)));
        }

        return cues;
    }

    private List<Integer> resolvePerfectIndexes(List<JudgementSample> samples) {
        List<RankedCueQuality> candidates = new ArrayList<>();
        for (int index = 0; index < samples.size(); index++) {
            JudgementSample sample = samples.get(index);
            if ("MISS".equals(sample.rawVerdict()) || "HOLD".equals(sample.rawVerdict())) {
                continue;
            }
            if ("EARLY".equals(sample.rawVerdict()) || "LATE".equals(sample.rawVerdict())) {
                continue;
            }

            double quality = computeCueQuality(sample);
            if (quality < 0.78) {
                continue;
            }
            candidates.add(new RankedCueQuality(index, quality));
        }

        candidates.sort((left, right) -> Double.compare(right.quality(), left.quality()));
        int quota = clamp((int) Math.round(samples.size() * 0.24), 1, Math.max(1, samples.size() / 2));
        List<Integer> perfectIndexes = new ArrayList<>();
        for (int index = 0; index < Math.min(quota, candidates.size()); index++) {
            perfectIndexes.add(candidates.get(index).index());
        }
        return perfectIndexes;
    }

    private List<Integer> resolveRecoverableIndexes(List<JudgementSample> samples) {
        List<RankedCueQuality> candidates = new ArrayList<>();
        double signalTotal = 0.0;

        for (int index = 0; index < samples.size(); index++) {
            JudgementSample sample = samples.get(index);
            double quality = computeCueQuality(sample);
            double signal = computeRecoverySignal(sample, quality);
            signalTotal += signal;

            if (isHardMiss(sample, quality)) {
                continue;
            }
            if (signal < 0.40) {
                continue;
            }
            candidates.add(new RankedCueQuality(index, signal));
        }

        if (candidates.isEmpty()) {
            return List.of();
        }

        candidates.sort((left, right) -> Double.compare(right.quality(), left.quality()));
        double averageSignal = signalTotal / samples.size();
        double strongestSignal = candidates.get(0).quality();
        int quota = clamp(
                (int) Math.round(samples.size() * clampDouble((averageSignal - 0.34) * 1.75, 0.0, 0.36)),
                0,
                Math.max(1, samples.size() / 3));
        if (quota == 0 && strongestSignal >= 0.50) {
            quota = 1;
        }

        List<Integer> recoverableIndexes = new ArrayList<>();
        for (int index = 0; index < Math.min(quota, candidates.size()); index++) {
            recoverableIndexes.add(candidates.get(index).index());
        }
        return recoverableIndexes;
    }

    private String calibrateVerdict(
            List<JudgementSample> samples,
            int index,
            boolean perfectCandidate,
            boolean recoverableCandidate) {
        JudgementSample sample = samples.get(index);
        double quality = computeCueQuality(sample);

        if ("MISS".equals(sample.rawVerdict())) {
            if (isRecoverableMiss(samples, index, quality)) {
                return "GOOD";
            }
            if (recoverableCandidate) {
                return resolvePlayableVerdict(sample);
            }
            return "MISS";
        }

        if ("HOLD".equals(sample.rawVerdict())) {
            return quality >= 0.62 ? "HOLD" : "GOOD";
        }

        if (("EARLY".equals(sample.rawVerdict()) || "LATE".equals(sample.rawVerdict()))
                && isRecoverableTimingSlip(samples, index, quality)) {
            return "GOOD";
        }

        if ("EARLY".equals(sample.rawVerdict()) || "LATE".equals(sample.rawVerdict())) {
            if (isMildTimingSlip(sample, quality)) {
                return "GOOD";
            }
            if (recoverableCandidate && quality >= 0.44) {
                return "GOOD";
            }
            return sample.rawVerdict();
        }

        if (perfectCandidate && quality >= 0.82) {
            return "PERFECT";
        }

        return quality >= 0.54 ? "GOOD" : "MISS";
    }

    private boolean isRecoverableMiss(List<JudgementSample> samples, int index, double quality) {
        JudgementSample sample = samples.get(index);
        if (sample.visibility() < 0.70 || quality < 0.56) {
            return false;
        }
        if (Math.abs(sample.offsetMs()) > sample.thresholds().goodOffsetThreshold() * 1.1) {
            return false;
        }
        return hasStableNeighbor(samples, index, -1) && hasStableNeighbor(samples, index, 1);
    }

    private boolean isRecoverableTimingSlip(List<JudgementSample> samples, int index, double quality) {
        JudgementSample sample = samples.get(index);
        if (quality < 0.70) {
            return false;
        }
        if (Math.abs(sample.offsetMs()) > sample.thresholds().earlyLateThreshold() * 1.2) {
            return false;
        }
        return hasStableNeighbor(samples, index, -1) || hasStableNeighbor(samples, index, 1);
    }

    private boolean isMildTimingSlip(JudgementSample sample, double quality) {
        if (quality < 0.38) {
            return false;
        }
        if (sample.visibility() < 0.58) {
            return false;
        }
        return Math.abs(sample.offsetMs()) <= sample.thresholds().earlyLateThreshold() * 1.22;
    }

    private boolean hasStableNeighbor(List<JudgementSample> samples, int index, int direction) {
        int neighborIndex = index + direction;
        if (neighborIndex < 0 || neighborIndex >= samples.size()) {
            return false;
        }
        JudgementSample neighbor = samples.get(neighborIndex);
        double neighborQuality = computeCueQuality(neighbor);
        return !"MISS".equals(neighbor.rawVerdict()) && neighborQuality >= 0.68;
    }

    private String resolvePlayableVerdict(JudgementSample sample) {
        if (Math.abs(sample.offsetMs()) <= sample.thresholds().earlyLateThreshold() * 1.15) {
            return "GOOD";
        }
        if (sample.offsetMs() <= -sample.thresholds().earlyLateThreshold() * 0.95) {
            return "EARLY";
        }
        if (sample.offsetMs() >= sample.thresholds().earlyLateThreshold() * 0.95) {
            return "LATE";
        }
        return "GOOD";
    }

    private boolean isHardMiss(JudgementSample sample, double quality) {
        if (sample.visibility() < 0.52) {
            return true;
        }
        if (quality < 0.26) {
            return true;
        }
        if (sample.poseDifference() > sample.thresholds().missPoseThreshold() * 1.12) {
            return true;
        }
        return Math.abs(sample.offsetMs()) > sample.thresholds().holdOffsetThreshold() * 1.35;
    }

    private double computeRecoverySignal(JudgementSample sample, double quality) {
        double offsetWindow = clampDouble(
                1.0 - (Math.abs(sample.offsetMs()) / Math.max(sample.thresholds().holdOffsetThreshold() * 1.25, 1.0)),
                0.0,
                1.0);
        double poseWindow = clampDouble(
                1.0 - (sample.poseDifference() / Math.max(sample.thresholds().missPoseThreshold() * 1.05, 1e-6)),
                0.0,
                1.0);
        double verdictBias = switch (sample.rawVerdict()) {
            case "PERFECT" -> 0.12;
            case "GOOD", "HOLD" -> 0.10;
            case "EARLY", "LATE" -> 0.06;
            default -> 0.0;
        };
        return clampDouble(
                quality * 0.48
                        + sample.rawConfidence() * 0.22
                        + offsetWindow * 0.18
                        + poseWindow * 0.12
                        + verdictBias,
                0.0,
                1.0);
    }

    private double calibrateConfidence(
            JudgementSample sample,
            String calibratedVerdict,
            boolean perfectCandidate,
            boolean recoverableCandidate) {
        double quality = computeCueQuality(sample);
        double baseConfidence = Math.max(sample.rawConfidence(), quality);

        if ("MISS".equals(calibratedVerdict)) {
            return clampDouble(Math.min(baseConfidence, 0.58), 0.18, 0.72);
        }
        if ("EARLY".equals(calibratedVerdict) || "LATE".equals(calibratedVerdict)) {
            return clampDouble(baseConfidence * 0.92, 0.42, 0.88);
        }
        if ("HOLD".equals(calibratedVerdict)) {
            return clampDouble(Math.max(baseConfidence, 0.74), 0.58, 0.94);
        }
        if ("PERFECT".equals(calibratedVerdict) && perfectCandidate) {
            return clampDouble(Math.max(baseConfidence, 0.90), 0.82, 0.99);
        }
        if (recoverableCandidate) {
            return clampDouble(Math.max(baseConfidence, 0.72), 0.56, 0.92);
        }
        return clampDouble(Math.max(baseConfidence, 0.66), 0.52, 0.95);
    }

    private double computeCueQuality(JudgementSample sample) {
        double poseRatio = sample.poseDifference() / Math.max(sample.thresholds().missPoseThreshold(), 1e-6);
        double offsetRatio = Math.abs(sample.offsetMs()) / Math.max(sample.thresholds().goodOffsetThreshold(), 1.0);
        double visibilityPenalty = Math.max(0.0, 0.78 - sample.visibility()) / 0.44;
        return clampDouble(1.0 - (poseRatio * 0.54) - (offsetRatio * 0.28) - (visibilityPenalty * 0.18), 0.0, 1.0);
    }

    private int resolveLane(
            Map<String, LandmarkPoint> currentPoints,
            Map<String, LandmarkPoint> previousPoints,
            int fallbackIndex,
            FocusProfile focusProfile,
            double ratio) {
        if (previousPoints == null || previousPoints.isEmpty()) {
            List<Integer> preferredLanes = resolvePreferredLanes(resolveFocusSegment(focusProfile, ratio));
            return preferredLanes.isEmpty() ? fallbackIndex % 6 : preferredLanes.get(0);
        }

        Map<Integer, Double> laneScores = new HashMap<>();
        laneScores.put(0, computeRegionMotion(previousPoints, currentPoints, LEFT_LEG_POINTS));
        laneScores.put(1, computeRegionMotion(previousPoints, currentPoints, LEFT_ARM_POINTS));
        laneScores.put(2, computeRegionMotion(previousPoints, currentPoints, TORSO_LEFT_POINTS));
        laneScores.put(3, computeRegionMotion(previousPoints, currentPoints, TORSO_RIGHT_POINTS));
        laneScores.put(4, computeRegionMotion(previousPoints, currentPoints, RIGHT_ARM_POINTS));
        laneScores.put(5, computeRegionMotion(previousPoints, currentPoints, RIGHT_LEG_POINTS));

        List<Integer> preferredLanes = resolvePreferredLanes(resolveFocusSegment(focusProfile, ratio));
        if (!preferredLanes.isEmpty()) {
            int bestPreferredLane = preferredLanes.get(0);
            double bestPreferredScore = -1.0;
            for (Integer preferredLane : preferredLanes) {
                double preferredScore = laneScores.getOrDefault(preferredLane, 0.0);
                if (preferredScore > bestPreferredScore) {
                    bestPreferredLane = preferredLane;
                    bestPreferredScore = preferredScore;
                }
            }
            return bestPreferredLane;
        }

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

    private Map<String, Double> aggregateFocusJointWeights(FocusProfile focusProfile, double ratio) {
        if (focusProfile == null) {
            return Map.of();
        }

        Map<String, Double> weights = new LinkedHashMap<>();
        for (WeightedFocusTarget target : focusProfile.primaryJoints()) {
            weights.merge(target.name(), target.weight(), Math::max);
        }

        FocusSegment segment = resolveFocusSegment(focusProfile, ratio);
        if (segment != null) {
            segment.jointWeights().forEach((name, weight) -> weights.merge(name, weight, Math::max));
        }
        return weights;
    }

    private FocusSegment resolveFocusSegment(FocusProfile focusProfile, double ratio) {
        if (focusProfile == null || focusProfile.segments().isEmpty()) {
            return null;
        }

        for (FocusSegment segment : focusProfile.segments()) {
            boolean inRange = ratio >= segment.startRatio()
                    && (ratio < segment.endRatio() || Math.abs(ratio - segment.endRatio()) < 1e-6 || segment.endRatio() >= 1.0);
            if (inRange) {
                return segment;
            }
        }
        return focusProfile.segments().get(focusProfile.segments().size() - 1);
    }

    private double resolvePointWeight(String pointName, Map<String, Double> focusJointWeights) {
        return switch (pointName) {
            case "left_elbow" -> 1.0 + focusJointWeights.getOrDefault("leftElbow", 0.0) * 1.1;
            case "right_elbow" -> 1.0 + focusJointWeights.getOrDefault("rightElbow", 0.0) * 1.1;
            case "left_wrist" -> 1.0 + focusJointWeights.getOrDefault("leftWrist", 0.0) * 1.15;
            case "right_wrist" -> 1.0 + focusJointWeights.getOrDefault("rightWrist", 0.0) * 1.15;
            case "left_knee" -> 1.0 + focusJointWeights.getOrDefault("leftKnee", 0.0) * 0.95;
            case "right_knee" -> 1.0 + focusJointWeights.getOrDefault("rightKnee", 0.0) * 0.95;
            case "left_ankle" -> 1.0 + focusJointWeights.getOrDefault("leftAnkle", 0.0) * 0.90;
            case "right_ankle" -> 1.0 + focusJointWeights.getOrDefault("rightAnkle", 0.0) * 0.90;
            case "left_shoulder" -> 1.0 + averageWeight(focusJointWeights, "leftElbow", "leftWrist") * 0.42;
            case "right_shoulder" -> 1.0 + averageWeight(focusJointWeights, "rightElbow", "rightWrist") * 0.42;
            case "left_hip" -> 1.0 + averageWeight(focusJointWeights, "leftKnee", "leftAnkle", "leftHip") * 0.36;
            case "right_hip" -> 1.0 + averageWeight(focusJointWeights, "rightKnee", "rightAnkle", "rightHip") * 0.36;
            case "nose" -> 1.0 + averageWeight(
                    focusJointWeights,
                    "leftElbow",
                    "rightElbow",
                    "leftWrist",
                    "rightWrist",
                    "leftHip",
                    "rightHip") * 0.18;
            default -> 1.0;
        };
    }

    private double resolveJointWeight(String jointName, Map<String, Double> focusJointWeights) {
        return 1.0 + (focusJointWeights.getOrDefault(jointName, 0.0) * 1.15);
    }

    private double resolvePoseSensitivity(FocusProfile focusProfile, double ratio) {
        FocusSegment segment = resolveFocusSegment(focusProfile, ratio);
        if (segment == null) {
            return 1.0;
        }
        return 0.94 + (segment.poseWeight() * 0.18);
    }

    private double resolveTimingStrictness(FocusProfile focusProfile, double ratio) {
        FocusSegment segment = resolveFocusSegment(focusProfile, ratio);
        if (segment == null) {
            return 1.0;
        }
        return 0.92 + (segment.timingWeight() * 0.20);
    }

    private List<Integer> resolvePreferredLanes(FocusSegment segment) {
        if (segment == null) {
            return List.of();
        }

        double leftArmWeight = averageWeight(segment.jointWeights(), "leftElbow", "leftWrist");
        double rightArmWeight = averageWeight(segment.jointWeights(), "rightElbow", "rightWrist");
        double leftLegWeight = averageWeight(segment.jointWeights(), "leftKnee", "leftAnkle", "leftHip");
        double rightLegWeight = averageWeight(segment.jointWeights(), "rightKnee", "rightAnkle", "rightHip");

        return switch (segment.dominantRegion().toLowerCase()) {
            case "arm" -> preferredSideLanes(leftArmWeight, rightArmWeight, 1, 4);
            case "leg" -> preferredSideLanes(leftLegWeight, rightLegWeight, 0, 5);
            case "torso", "core", "body" -> List.of(2, 3);
            default -> List.of();
        };
    }

    private List<Integer> preferredSideLanes(double leftWeight, double rightWeight, int leftLane, int rightLane) {
        if (leftWeight <= 0.0 && rightWeight <= 0.0) {
            return List.of(leftLane, rightLane);
        }
        if (leftWeight > rightWeight + 0.05) {
            return List.of(leftLane);
        }
        if (rightWeight > leftWeight + 0.05) {
            return List.of(rightLane);
        }
        return List.of(leftLane, rightLane);
    }

    private double averageWeight(Map<String, Double> weights, String... keys) {
        double total = 0.0;
        int count = 0;
        for (String key : keys) {
            Double value = weights.get(key);
            if (value == null) {
                continue;
            }
            total += value;
            count += 1;
        }
        return count == 0 ? 0.0 : total / count;
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

    private record ParsedProfile(List<FrameSnapshot> frames, long durationMs, FocusProfile focusProfile) {
    }

    private record FrameSnapshot(int frameIndex, int timestampMs, Map<String, LandmarkPoint> points) {
    }

    private record LandmarkPoint(double x, double y, double z, double visibility) {
    }

    private record LandmarkAnchor(double centerX, double centerY, double scale) {
    }

    private record FocusProfile(List<WeightedFocusTarget> primaryJoints, List<FocusSegment> segments) {
        static FocusProfile empty() {
            return new FocusProfile(List.of(), List.of());
        }
    }

    private record WeightedFocusTarget(String name, double weight) {
    }

    private record FocusSegment(
            String key,
            double startRatio,
            double endRatio,
            double poseWeight,
            double timingWeight,
            String dominantRegion,
            Map<String, Double> jointWeights) {
    }

    private record JudgementThresholds(
            double perfectPoseThreshold,
            double goodPoseThreshold,
            double holdPoseThreshold,
            double missPoseThreshold,
            double perfectOffsetThreshold,
            double goodOffsetThreshold,
            double holdOffsetThreshold,
            double earlyLateThreshold,
            boolean holdEligible) {
    }

    private record JudgementSample(
            int id,
            int beatIndex,
            int second,
            int triggerMs,
            int windowMs,
            int lane,
            boolean accent,
            int offsetMs,
            String rawVerdict,
            double poseDifference,
            double visibility,
            double rawConfidence,
            JudgementThresholds thresholds) {
    }

    private record RankedCueQuality(int index, double quality) {
    }

    private record CueCandidate(
            int frameIndex,
            double ratio,
            int timestampMs,
            double score,
            boolean accent) {
    }

    private record CueAnchor(
            int frameIndex,
            double ratio,
            int timestampMs,
            boolean accent) {
    }
}
