package com.motionchallenge.scoring.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.ToDoubleFunction;
import org.springframework.stereotype.Service;

@Service
public class DefaultScoringService implements ScoringService {

    private static final String AREA_POSE = "pose shape";
    private static final String AREA_TIMING = "pose timing";
    private static final String AREA_QUALITY = "detection quality";

    private final ObjectMapper objectMapper;

    public DefaultScoringService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public ScoringResult calculateScore(ChallengeMotionProfile referenceProfile, MotionAnalysisResult attemptAnalysis) {
        ParsedMotionProfile reference = parseProfile(referenceProfile.getProfileData());
        ParsedMotionProfile attempt = parseProfile(attemptAnalysis.rawProfileData());

        if (reference.hasLandmarks() && attempt.hasLandmarks()) {
            return calculateLandmarkScore(reference, attempt);
        }

        return calculateFallbackScore(referenceProfile, attemptAnalysis);
    }

    private ScoringResult calculateLandmarkScore(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        double poseDifference = calculatePoseShapeDifference(reference, attempt);
        double timingDifference = calculateTimingDifference(reference, attempt);
        double stabilityDifference = calculateDetectionQualityDifference(reference, attempt);

        int poseSimilarity = convertDifferenceToSimilarity(poseDifference, 130.0, 100);
        int timingSimilarity = convertDifferenceToSimilarity(timingDifference, 155.0, 100);
        int stabilitySimilarity = convertDifferenceToSimilarity(stabilityDifference, 135.0, 100);

        double weightedScore = poseSimilarity * 0.48 + timingSimilarity * 0.34 + stabilitySimilarity * 0.18;
        int score = clamp((int) Math.round(weightedScore), 0, 100);
        score = applyPrimaryAxisCap(score, poseSimilarity, timingSimilarity);
        score = applyDiscriminationCurve(score, poseSimilarity, timingSimilarity);
        String strongestArea = resolveStrongestArea(poseSimilarity, timingSimilarity, stabilitySimilarity);
        String weakestArea = resolveWeakestArea(poseSimilarity, timingSimilarity, stabilitySimilarity);
        String summary = buildSummary(
                score,
                strongestArea,
                weakestArea,
                poseSimilarity,
                timingSimilarity,
                stabilitySimilarity,
                reference,
                attempt);

        return new ScoringResult(
                score,
                summary,
                poseSimilarity,
                timingSimilarity,
                stabilitySimilarity,
                strongestArea,
                weakestArea);
    }

    private ScoringResult calculateFallbackScore(ChallengeMotionProfile referenceProfile, MotionAnalysisResult attemptAnalysis) {
        double poseDifferenceRatio = ratioGap(referenceProfile.getSignature(), attemptAnalysis.signature());
        double timingDifferenceRatio = ratioGap(referenceProfile.getDurationMs(), attemptAnalysis.durationMs());
        double stabilityDifferenceRatio = ratioGap(referenceProfile.getSampleCount(), attemptAnalysis.sampleCount());

        int poseSimilarity = convertDifferenceToSimilarity(poseDifferenceRatio, 120.0, 72);
        int timingSimilarity = convertDifferenceToSimilarity(timingDifferenceRatio, 140.0, 82);
        int stabilitySimilarity = convertDifferenceToSimilarity(stabilityDifferenceRatio, 90.0, 86);

        double weightedScore = poseSimilarity * 0.45 + timingSimilarity * 0.40 + stabilitySimilarity * 0.15;
        int score = clamp((int) Math.round(weightedScore), 0, 100);
        score = applyPrimaryAxisCap(score, poseSimilarity, timingSimilarity);
        score = applyDiscriminationCurve(score, poseSimilarity, timingSimilarity);
        String strongestArea = resolveStrongestArea(poseSimilarity, timingSimilarity, stabilitySimilarity);
        String weakestArea = resolveWeakestArea(poseSimilarity, timingSimilarity, stabilitySimilarity);
        String summary = buildFallbackSummary(score, strongestArea, weakestArea, poseSimilarity, timingSimilarity, stabilitySimilarity);

        return new ScoringResult(
                score,
                summary,
                poseSimilarity,
                timingSimilarity,
                stabilitySimilarity,
                strongestArea,
                weakestArea);
    }

    private ParsedMotionProfile parseProfile(String rawProfileData) {
        try {
            JsonNode root = objectMapper.readTree(rawProfileData);
            JsonNode metrics = root.path("metrics");
            JsonNode extras = root.path("extras");

            List<FrameLandmarkSet> frames = new ArrayList<>();
            for (JsonNode frameNode : root.path("landmarks")) {
                int frameIndex = frameNode.path("frameIndex").asInt(frames.size());
                Map<String, LandmarkPoint> points = new HashMap<>();
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
                    frames.add(new FrameLandmarkSet(frameIndex, points, calculateFrameQuality(points)));
                }
            }

            int processedFrames = extras.path("processedFrames")
                    .asInt(Math.max(frames.size(), metrics.path("sampleCount").asInt(frames.size())));
            int framesWithPose = extras.path("framesWithPose").asInt(frames.size());
            double averageVisibility = calculateAverageVisibility(frames);
            double detectionCoverage = processedFrames <= 0
                    ? (frames.isEmpty() ? 0.0 : 1.0)
                    : Math.min(1.0, framesWithPose / (double) processedFrames);

            JsonNode analysisSummary = extras.path("analysisSummary");
            JsonNode quality = analysisSummary.path("quality");
            JsonNode rhythm = analysisSummary.path("rhythm");
            JsonNode symmetry = analysisSummary.path("symmetry");
            JsonNode kinematics = analysisSummary.path("kinematics");
            FocusProfile focusProfile = parseFocusProfile(analysisSummary.path("focusProfile"));

            Map<String, JointSignal> joints = new HashMap<>();
            JsonNode jointsNode = kinematics.path("joints");
            if (jointsNode.isObject()) {
                jointsNode.fields().forEachRemaining(entry -> joints.put(
                        entry.getKey(),
                        new JointSignal(
                                readDouble(entry.getValue().path("mean"), 0.0),
                                readDouble(entry.getValue().path("range"), 0.0),
                                readDouble(entry.getValue().path("stdDev"), 0.0))));
            }

            MotionSignals signals = new MotionSignals(
                    readDouble(quality.path("detectionCoverage"), detectionCoverage),
                    readDouble(quality.path("averageVisibility"), averageVisibility),
                    readDouble(quality.path("visibilitySpread"), 0.0),
                    readDouble(quality.path("torsoScaleStdDev"), 0.0),
                    readDouble(quality.path("centerLineOffsetMean"), 0.0),
                    readDouble(quality.path("centerDriftMean"), 0.0),
                    readDouble(quality.path("centerDriftPeak"), 0.0),
                    readDouble(rhythm.path("motionEnergyMean"), 0.0),
                    readDouble(rhythm.path("motionEnergyStdDev"), 0.0),
                    readDouble(rhythm.path("motionEnergyPeak"), 0.0),
                    readDouble(rhythm.path("motionBurstCount"), 0.0),
                    readDouble(symmetry.path("upperBodyMean"), 0.0),
                    readDouble(symmetry.path("lowerBodyMean"), 0.0),
                    readDouble(symmetry.path("fullBodyMean"), 0.0),
                    readDouble(kinematics.path("jointRangeMean"), 0.0),
                    readDouble(kinematics.path("jointRangePeak"), 0.0),
                    readDouble(kinematics.path("jointStabilityMean"), 0.0),
                    Map.copyOf(joints));

            boolean hasAnalysisSummary = analysisSummary.isObject() && analysisSummary.size() > 0;

            return new ParsedMotionProfile(
                    metrics.path("signature").asInt(),
                    metrics.path("sampleCount").asInt(frames.size()),
                    metrics.path("durationMs").asLong(),
                    frames,
                    processedFrames,
                    framesWithPose,
                    averageVisibility,
                    signals,
                    hasAnalysisSummary,
                    focusProfile);
        } catch (IOException exception) {
            return ParsedMotionProfile.empty();
        }
    }

    private FocusProfile parseFocusProfile(JsonNode focusProfileNode) {
        if (!focusProfileNode.isObject()) {
            return FocusProfile.empty();
        }

        String version = focusProfileNode.path("version").asText("v1");
        List<WeightedFocusTarget> primaryJoints = new ArrayList<>();
        for (JsonNode jointNode : focusProfileNode.path("primaryJoints")) {
            String name = jointNode.path("name").asText();
            if (name == null || name.isBlank()) {
                continue;
            }
            primaryJoints.add(new WeightedFocusTarget(
                    name,
                    clampDouble(readDouble(jointNode.path("weight"), 0.0), 0.0, 1.0)));
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
                        clampDouble(readDouble(entry.getValue(), 0.0), 0.0, 1.0)));
            }

            segments.add(new FocusSegment(
                    key,
                    segmentNode.path("label").asText(key),
                    clampDouble(readDouble(segmentNode.path("startRatio"), 0.0), 0.0, 1.0),
                    clampDouble(readDouble(segmentNode.path("endRatio"), 1.0), 0.0, 1.0),
                    clampDouble(readDouble(segmentNode.path("poseWeight"), 0.0), 0.0, 1.0),
                    clampDouble(readDouble(segmentNode.path("timingWeight"), 0.0), 0.0, 1.0),
                    segmentNode.path("dominantRegion").asText("body"),
                    Map.copyOf(jointWeights)));
        }

        return new FocusProfile(
                version,
                List.copyOf(primaryJoints),
                List.copyOf(segments));
    }

    private double calculatePoseShapeDifference(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        int comparisonFrames = Math.max(1, Math.min(reference.frames().size(), attempt.frames().size()));
        double weightedDistanceTotal = 0.0;
        double frameWeightTotal = 0.0;
        for (int index = 0; index < comparisonFrames; index++) {
            double ratio = comparisonFrames == 1 ? 0.0 : index / (double) (comparisonFrames - 1);
            FrameLandmarkSet referenceFrame = selectAlignedFrame(reference.frames(), index, comparisonFrames);
            FrameLandmarkSet attemptFrame = selectAlignedFrame(attempt.frames(), index, comparisonFrames);
            double weight = combinedFrameWeight(referenceFrame, attemptFrame)
                    * resolvePoseSegmentWeight(reference.focusProfile(), ratio);
            weightedDistanceTotal += comparePoseShape(referenceFrame, attemptFrame, reference.focusProfile(), ratio) * weight;
            frameWeightTotal += weight;
        }

        double landmarkDifference = frameWeightTotal > 0.0 ? weightedDistanceTotal / frameWeightTotal : 1.0;
        if (!reference.hasAnalysisSummary() || !attempt.hasAnalysisSummary()) {
            return landmarkDifference;
        }

        double symmetryGap = average(
                Math.abs(reference.signals().upperBodySymmetry() - attempt.signals().upperBodySymmetry()),
                Math.abs(reference.signals().lowerBodySymmetry() - attempt.signals().lowerBodySymmetry()),
                Math.abs(reference.signals().fullBodySymmetry() - attempt.signals().fullBodySymmetry()));
        Map<String, Double> focusJointWeights = aggregateFocusJointWeights(reference.focusProfile());
        double jointShapeGap = average(
                Math.abs(reference.signals().jointRangeMean() - attempt.signals().jointRangeMean()),
                Math.abs(reference.signals().jointRangePeak() - attempt.signals().jointRangePeak()),
                compareSharedJointMetric(reference.signals().joints(), attempt.signals().joints(), JointSignal::mean, focusJointWeights),
                compareSharedJointMetric(reference.signals().joints(), attempt.signals().joints(), JointSignal::range, focusJointWeights));
        double summaryDifference = average(symmetryGap, jointShapeGap);
        return landmarkDifference * 0.70 + summaryDifference * 0.30;
    }

    private double calculateTimingDifference(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        double durationGap = ratioGap(reference.durationMs(), attempt.durationMs());
        double frameSpanGap = ratioGap(reference.frameSpan(), attempt.frameSpan());

        List<PoseDescriptor> referenceDescriptors = buildNormalizedPoseDescriptors(reference.frames(), 14, reference.focusProfile(), true);
        List<PoseDescriptor> attemptDescriptors = buildNormalizedPoseDescriptors(attempt.frames(), 14, FocusProfile.empty(), false);

        if (referenceDescriptors.size() < 2 || attemptDescriptors.size() < 2) {
            double sampleGap = ratioGap(reference.sampleCount(), attempt.sampleCount());
            double summaryGap = reference.hasAnalysisSummary() && attempt.hasAnalysisSummary()
                    ? calculateRhythmSignalDifference(reference, attempt)
                    : 0.0;
            return reference.hasAnalysisSummary() && attempt.hasAnalysisSummary()
                    ? average(summaryGap * 0.70, durationGap * 0.20, sampleGap * 0.10)
                    : durationGap * 0.75 + sampleGap * 0.25;
        }

        List<MotionCurveSample> referenceMotionCurve = buildMotionCurve(referenceDescriptors);
        List<MotionCurveSample> attemptMotionCurve = buildMotionCurve(attemptDescriptors);
        double timingCurveDifference = compareMotionCurves(referenceMotionCurve, attemptMotionCurve);

        if (!reference.hasAnalysisSummary() || !attempt.hasAnalysisSummary()) {
            return timingCurveDifference * 0.65 + durationGap * 0.20 + frameSpanGap * 0.15;
        }

        double rhythmSignalDifference = calculateRhythmSignalDifference(reference, attempt);
        return timingCurveDifference * 0.50 + rhythmSignalDifference * 0.35 + durationGap * 0.10 + frameSpanGap * 0.05;
    }

    private double calculateRhythmSignalDifference(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        return average(
                normalizeGap(reference.signals().motionEnergyMean(), attempt.signals().motionEnergyMean(), 3.0),
                normalizeGap(reference.signals().motionEnergyStdDev(), attempt.signals().motionEnergyStdDev(), 3.0),
                normalizeGap(reference.signals().motionEnergyPeak(), attempt.signals().motionEnergyPeak(), 3.0),
                ratioGap(reference.signals().motionBurstCount(), attempt.signals().motionBurstCount()));
    }

    private double calculateDetectionQualityDifference(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        double coverageGap = Math.abs(reference.detectionCoverage() - attempt.detectionCoverage());
        double visibilityGap = Math.abs(reference.averageVisibility() - attempt.averageVisibility());
        double sampleGap = ratioGap(reference.sampleCount(), attempt.sampleCount());

        if (!reference.hasAnalysisSummary() || !attempt.hasAnalysisSummary()) {
            return coverageGap * 0.5 + visibilityGap * 0.35 + sampleGap * 0.15;
        }

        double summaryGap = average(
                Math.abs(reference.signals().visibilitySpread() - attempt.signals().visibilitySpread()),
                normalizeGap(reference.signals().torsoScaleStdDev(), attempt.signals().torsoScaleStdDev(), 1.0),
                normalizeGap(reference.signals().centerLineOffsetMean(), attempt.signals().centerLineOffsetMean(), 2.0),
                normalizeGap(reference.signals().centerDriftMean(), attempt.signals().centerDriftMean(), 2.0),
                normalizeGap(reference.signals().centerDriftPeak(), attempt.signals().centerDriftPeak(), 2.0));

        return coverageGap * 0.24
                + visibilityGap * 0.18
                + summaryGap * 0.52
                + sampleGap * 0.06;
    }

    private FrameLandmarkSet selectAlignedFrame(List<FrameLandmarkSet> frames, int index, int totalComparisons) {
        if (frames.size() == 1 || totalComparisons == 1) {
            return frames.get(0);
        }
        double ratio = index / (double) (totalComparisons - 1);
        double targetFrameIndex = ratio * (frames.size() - 1);
        int centerIndex = (int) Math.round(targetFrameIndex);
        int searchRadius = Math.max(1, (int) Math.ceil(frames.size() / (double) Math.max(totalComparisons, 1)));

        FrameLandmarkSet bestFrame = frames.get(Math.max(0, Math.min(centerIndex, frames.size() - 1)));
        double bestScore = alignmentCandidateScore(bestFrame, centerIndex, targetFrameIndex, searchRadius);

        int startIndex = Math.max(0, centerIndex - searchRadius);
        int endIndex = Math.min(frames.size() - 1, centerIndex + searchRadius);
        for (int candidateIndex = startIndex; candidateIndex <= endIndex; candidateIndex++) {
            FrameLandmarkSet candidateFrame = frames.get(candidateIndex);
            double candidateScore = alignmentCandidateScore(candidateFrame, candidateIndex, targetFrameIndex, searchRadius);
            if (candidateScore > bestScore) {
                bestFrame = candidateFrame;
                bestScore = candidateScore;
            }
        }
        return bestFrame;
    }

    private double comparePoseShape(
            FrameLandmarkSet referenceFrame,
            FrameLandmarkSet attemptFrame,
            FocusProfile focusProfile,
            double ratio) {
        LandmarkAnchor referenceAnchor = buildAnchor(referenceFrame.points());
        LandmarkAnchor attemptAnchor = buildAnchor(attemptFrame.points());
        PoseDescriptor referenceDescriptor = buildPoseDescriptor(
                referenceFrame.points(),
                referenceAnchor,
                referenceFrame.qualityScore(),
                1.0);
        PoseDescriptor attemptDescriptor = buildPoseDescriptor(
                attemptFrame.points(),
                attemptAnchor,
                attemptFrame.qualityScore(),
                1.0);
        return comparePoseDescriptors(referenceDescriptor, attemptDescriptor, resolvePoseFeatureWeights(focusProfile, ratio));
    }

    private LandmarkAnchor buildAnchor(Map<String, LandmarkPoint> points) {
        Optional<LandmarkAnchor> torsoAnchor = buildTorsoAnchor(points);
        if (torsoAnchor.isPresent()) {
            return torsoAnchor.get();
        }
        Optional<LandmarkAnchor> hipAnchor = buildPairAnchor(points, "left_hip", "right_hip");
        if (hipAnchor.isPresent()) {
            return hipAnchor.get();
        }
        Optional<LandmarkAnchor> shoulderAnchor = buildPairAnchor(points, "left_shoulder", "right_shoulder");
        if (shoulderAnchor.isPresent()) {
            return shoulderAnchor.get();
        }

        double centerX = points.values().stream().mapToDouble(LandmarkPoint::x).average().orElse(0.5);
        double centerY = points.values().stream().mapToDouble(LandmarkPoint::y).average().orElse(0.5);
        double minX = points.values().stream().mapToDouble(LandmarkPoint::x).min().orElse(centerX - 0.1);
        double maxX = points.values().stream().mapToDouble(LandmarkPoint::x).max().orElse(centerX + 0.1);
        double minY = points.values().stream().mapToDouble(LandmarkPoint::y).min().orElse(centerY - 0.1);
        double maxY = points.values().stream().mapToDouble(LandmarkPoint::y).max().orElse(centerY + 0.1);
        double scale = Math.max(0.05, Math.hypot(maxX - minX, maxY - minY));
        return new LandmarkAnchor(centerX, centerY, scale);
    }

    private Optional<LandmarkAnchor> buildPairAnchor(Map<String, LandmarkPoint> points, String leftName, String rightName) {
        LandmarkPoint left = points.get(leftName);
        LandmarkPoint right = points.get(rightName);
        if (left == null || right == null) {
            return Optional.empty();
        }

        double centerX = (left.x() + right.x()) / 2.0;
        double centerY = (left.y() + right.y()) / 2.0;
        double scale = Math.max(0.05, Math.hypot(left.x() - right.x(), left.y() - right.y()));
        return Optional.of(new LandmarkAnchor(centerX, centerY, scale));
    }

    private Optional<LandmarkAnchor> buildTorsoAnchor(Map<String, LandmarkPoint> points) {
        LandmarkPoint leftShoulder = points.get("left_shoulder");
        LandmarkPoint rightShoulder = points.get("right_shoulder");
        LandmarkPoint leftHip = points.get("left_hip");
        LandmarkPoint rightHip = points.get("right_hip");
        if (leftShoulder == null || rightShoulder == null || leftHip == null || rightHip == null) {
            return Optional.empty();
        }

        double shoulderCenterX = (leftShoulder.x() + rightShoulder.x()) / 2.0;
        double shoulderCenterY = (leftShoulder.y() + rightShoulder.y()) / 2.0;
        double hipCenterX = (leftHip.x() + rightHip.x()) / 2.0;
        double hipCenterY = (leftHip.y() + rightHip.y()) / 2.0;
        double centerX = (shoulderCenterX + hipCenterX) / 2.0;
        double centerY = (shoulderCenterY + hipCenterY) / 2.0;
        double shoulderWidth = Math.hypot(leftShoulder.x() - rightShoulder.x(), leftShoulder.y() - rightShoulder.y());
        double hipWidth = Math.hypot(leftHip.x() - rightHip.x(), leftHip.y() - rightHip.y());
        double torsoHeight = Math.hypot(shoulderCenterX - hipCenterX, shoulderCenterY - hipCenterY);
        double scale = Math.max(0.08, Math.max(torsoHeight, Math.max(shoulderWidth, hipWidth)));
        return Optional.of(new LandmarkAnchor(centerX, centerY, scale));
    }

    private double calculateAverageVisibility(List<FrameLandmarkSet> frames) {
        return frames.stream()
                .flatMap(frame -> frame.points().values().stream())
                .mapToDouble(LandmarkPoint::visibility)
                .average()
                .orElse(0.0);
    }

    private double calculateFrameQuality(Map<String, LandmarkPoint> points) {
        if (points.isEmpty()) {
            return 0.0;
        }

        double averageVisibility = points.values().stream()
                .mapToDouble(LandmarkPoint::visibility)
                .average()
                .orElse(0.0);
        double coreVisibility = averageVisibility(points, "left_shoulder", "right_shoulder", "left_hip", "right_hip");
        double limbVisibility = averageVisibility(
                points,
                "left_elbow",
                "right_elbow",
                "left_wrist",
                "right_wrist",
                "left_knee",
                "right_knee",
                "left_ankle",
                "right_ankle");

        return clampDouble(averageVisibility * 0.55 + coreVisibility * 0.30 + limbVisibility * 0.15, 0.0, 1.0);
    }

    private double alignmentCandidateScore(
            FrameLandmarkSet frame,
            int frameIndex,
            double targetFrameIndex,
            int searchRadius) {
        double normalizedDistance = Math.abs(frameIndex - targetFrameIndex) / Math.max(1.0, searchRadius + 1.0);
        double proximityScore = clampDouble(1.0 - normalizedDistance, 0.0, 1.0);
        return frame.qualityScore() * 0.78 + proximityScore * 0.22;
    }

    private double combinedFrameWeight(FrameLandmarkSet referenceFrame, FrameLandmarkSet attemptFrame) {
        return Math.max(0.08, Math.sqrt(referenceFrame.qualityScore() * attemptFrame.qualityScore()));
    }

    private double ratioGap(long referenceValue, long attemptValue) {
        long denominator = Math.max(Math.abs(referenceValue), 1L);
        return Math.abs(referenceValue - attemptValue) / (double) denominator;
    }

    private double ratioGap(double referenceValue, double attemptValue) {
        double denominator = Math.max(Math.abs(referenceValue), 1.0);
        return Math.abs(referenceValue - attemptValue) / denominator;
    }

    private double normalizeGap(double referenceValue, double attemptValue, double maxRange) {
        return clampDouble(Math.abs(referenceValue - attemptValue) / Math.max(maxRange, 1e-6), 0.0, 1.0);
    }

    private int convertDifferenceToSimilarity(double difference, double multiplier, int maxPenalty) {
        int penalty = (int) Math.round(Math.min(maxPenalty, difference * multiplier));
        return clamp(100 - penalty, 0, 100);
    }

    private int applyPrimaryAxisCap(int score, int poseSimilarity, int timingSimilarity) {
        if (poseSimilarity < 15 || timingSimilarity < 15) {
            return Math.min(score, 30);
        }
        if (poseSimilarity < 30 && timingSimilarity < 30) {
            return Math.min(score, 45);
        }
        if (poseSimilarity < 45 && timingSimilarity < 45) {
            return Math.min(score, 60);
        }
        return score;
    }

    private int applyDiscriminationCurve(int score, int poseSimilarity, int timingSimilarity) {
        int primaryFloor = Math.min(poseSimilarity, timingSimilarity);
        int primaryAverage = (poseSimilarity + timingSimilarity) / 2;

        if (primaryFloor < 50) {
            score = Math.min(score, 56);
        } else if (primaryFloor < 65) {
            score = Math.min(score, 68);
        } else if (primaryFloor < 75) {
            score = Math.min(score, 78);
        }

        if (primaryAverage < 65) {
            score -= 10;
        } else if (primaryAverage < 75) {
            score -= 6;
        } else if (primaryAverage < 82) {
            score -= 4;
        }

        return clamp(score, 0, 100);
    }

    private String buildSummary(
            int score,
            String strongestArea,
            String weakestArea,
            int poseSimilarity,
            int timingSimilarity,
            int stabilitySimilarity,
            ParsedMotionProfile reference,
            ParsedMotionProfile attempt) {
        String strongestLabel = toAreaLabel(strongestArea);
        String weakestLabel = toAreaLabel(weakestArea);
        String focusHint = buildAreaHint(weakestArea, reference, attempt);
        String metricsTail = "모양 %d, 타이밍 %d, 품질 %d.".formatted(poseSimilarity, timingSimilarity, stabilitySimilarity);

        if (score >= 90) {
            return "기준 동작과 매우 가깝습니다. 강점은 "
                    + strongestLabel
                    + "이며, "
                    + focusHint
                    + "만 조금 더 정리하면 완성도가 더 올라갑니다. "
                    + metricsTail;
        }
        if (score >= 75) {
            return "전체 흐름은 잘 맞았습니다. 강점은 "
                    + strongestLabel
                    + "이고, 보완이 필요한 영역은 "
                    + weakestLabel
                    + "입니다. "
                    + focusHint
                    + ". "
                    + metricsTail;
        }
        if (score >= 60) {
            return "기준 동작과 비슷한 구간은 있지만 "
                    + weakestLabel
                    + " 차이가 점수에 반영됐습니다. "
                    + focusHint
                    + ". "
                    + metricsTail;
        }
        return "기준 동작과 차이가 큽니다. 우선 "
                + weakestLabel
                + "부터 다시 맞춰 보세요. "
                + focusHint
                + ". "
                + metricsTail;
    }

    private String buildFallbackSummary(
            int score,
            String strongestArea,
            String weakestArea,
            int poseSimilarity,
            int timingSimilarity,
            int stabilitySimilarity) {
        if (score >= 85) {
            return "메타데이터 기준으로는 전체 흐름이 안정적입니다. 강점은 "
                    + toAreaLabel(strongestArea)
                    + "입니다. 모양 %d, 타이밍 %d, 품질 %d.".formatted(
                            poseSimilarity, timingSimilarity, stabilitySimilarity);
        }
        return "세부 랜드마크 데이터가 충분하지 않아 기본 비교로 채점했습니다. 우선 "
                + toAreaLabel(weakestArea)
                + "부터 보완해 보세요. 모양 %d, 타이밍 %d, 품질 %d.".formatted(
                        poseSimilarity, timingSimilarity, stabilitySimilarity);
    }

    private String buildAreaHint(String area, ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        if (AREA_TIMING.equals(area)) {
            return buildTimingHint(reference, attempt);
        }
        if (AREA_QUALITY.equals(area)) {
            return buildQualityHint(reference, attempt);
        }
        return buildPoseHint(reference, attempt);
    }

    private String buildPoseHint(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        if (!reference.hasAnalysisSummary() || !attempt.hasAnalysisSummary()) {
            return "자세 중심축과 관절 정렬을 기준 동작에 더 가깝게 맞춰 보세요";
        }

        Map<String, Double> gaps = new LinkedHashMap<>();
        gaps.put(
                "좌우 대칭",
                average(
                        Math.abs(reference.signals().upperBodySymmetry() - attempt.signals().upperBodySymmetry()),
                        Math.abs(reference.signals().lowerBodySymmetry() - attempt.signals().lowerBodySymmetry()),
                        Math.abs(reference.signals().fullBodySymmetry() - attempt.signals().fullBodySymmetry())));
        gaps.put("팔 각도", average(elbowGap(reference, attempt), wristReachGap(reference, attempt)));
        gaps.put("하체 각도", average(kneeGap(reference, attempt), ankleReachGap(reference, attempt)));
        gaps.put(
                "가동 범위",
                average(
                        Math.abs(reference.signals().jointRangeMean() - attempt.signals().jointRangeMean()),
                        Math.abs(reference.signals().jointRangePeak() - attempt.signals().jointRangePeak())));

        List<String> labels = findDominantLabels(gaps, 0.04, 2);
        if (labels.isEmpty()) {
            return "자세 중심축과 관절 정렬을 기준 동작에 더 가깝게 맞춰 보세요";
        }
        return "특히 " + String.join(", ", labels) + " 차이를 줄여 보세요";
    }

    private String buildTimingHint(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        if (!reference.hasAnalysisSummary() || !attempt.hasAnalysisSummary()) {
            return "동작 속도와 박자를 기준 영상 템포에 맞춰 보세요";
        }

        Map<String, Double> gaps = new LinkedHashMap<>();
        gaps.put(
                "움직임 속도",
                normalizeGap(reference.signals().motionEnergyMean(), attempt.signals().motionEnergyMean(), 3.0));
        gaps.put(
                "리듬 변화폭",
                normalizeGap(reference.signals().motionEnergyStdDev(), attempt.signals().motionEnergyStdDev(), 3.0));
        gaps.put(
                "강한 동작 피크",
                normalizeGap(reference.signals().motionEnergyPeak(), attempt.signals().motionEnergyPeak(), 3.0));
        gaps.put("템포 구간", ratioGap(reference.signals().motionBurstCount(), attempt.signals().motionBurstCount()));

        List<String> labels = findDominantLabels(gaps, 0.05, 2);
        if (labels.isEmpty()) {
            return "동작 속도와 박자를 기준 영상 템포에 맞춰 보세요";
        }
        return "특히 " + String.join(", ", labels) + "을 기준 영상 템포에 맞춰 보세요";
    }

    private String buildQualityHint(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        if (!reference.hasAnalysisSummary() || !attempt.hasAnalysisSummary()) {
            return "카메라 흔들림을 줄이고 몸 전체가 안정적으로 보이게 촬영해 보세요";
        }

        Map<String, Double> gaps = new LinkedHashMap<>();
        gaps.put("검출 안정성", Math.abs(reference.detectionCoverage() - attempt.detectionCoverage()));
        gaps.put("관절 가시성", Math.abs(reference.averageVisibility() - attempt.averageVisibility()));
        gaps.put(
                "화면 중심",
                normalizeGap(reference.signals().centerLineOffsetMean(), attempt.signals().centerLineOffsetMean(), 2.0));
        gaps.put(
                "카메라 흔들림",
                average(
                        normalizeGap(reference.signals().centerDriftMean(), attempt.signals().centerDriftMean(), 2.0),
                        normalizeGap(reference.signals().centerDriftPeak(), attempt.signals().centerDriftPeak(), 2.0)));

        List<String> labels = findDominantLabels(gaps, 0.04, 2);
        if (labels.isEmpty()) {
            return "카메라 흔들림을 줄이고 몸 전체가 안정적으로 보이게 촬영해 보세요";
        }
        return "특히 " + String.join(", ", labels) + "을 안정적으로 유지해 보세요";
    }

    private List<String> findDominantLabels(Map<String, Double> gaps, double threshold, int limit) {
        return gaps.entrySet().stream()
                .filter(entry -> entry.getValue() >= threshold)
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(limit)
                .map(Map.Entry::getKey)
                .toList();
    }

    private double elbowGap(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        return average(
                jointGap(reference, attempt, "leftElbow", JointSignal::mean),
                jointGap(reference, attempt, "rightElbow", JointSignal::mean),
                jointGap(reference, attempt, "leftElbow", JointSignal::range),
                jointGap(reference, attempt, "rightElbow", JointSignal::range));
    }

    private double kneeGap(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        return average(
                jointGap(reference, attempt, "leftKnee", JointSignal::mean),
                jointGap(reference, attempt, "rightKnee", JointSignal::mean),
                jointGap(reference, attempt, "leftKnee", JointSignal::range),
                jointGap(reference, attempt, "rightKnee", JointSignal::range));
    }

    private double wristReachGap(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        return average(
                relativePointGap(reference.frames(), attempt.frames(), "left_wrist"),
                relativePointGap(reference.frames(), attempt.frames(), "right_wrist"));
    }

    private double ankleReachGap(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        return average(
                relativePointGap(reference.frames(), attempt.frames(), "left_ankle"),
                relativePointGap(reference.frames(), attempt.frames(), "right_ankle"));
    }

    private double jointGap(
            ParsedMotionProfile reference,
            ParsedMotionProfile attempt,
            String jointName,
            ToDoubleFunction<JointSignal> selector) {
        JointSignal referenceJoint = reference.signals().joints().get(jointName);
        JointSignal attemptJoint = attempt.signals().joints().get(jointName);
        if (referenceJoint == null || attemptJoint == null) {
            return 0.0;
        }
        return Math.abs(selector.applyAsDouble(referenceJoint) - selector.applyAsDouble(attemptJoint));
    }

    private double compareSharedJointMetric(
            Map<String, JointSignal> referenceJoints,
            Map<String, JointSignal> attemptJoints,
            ToDoubleFunction<JointSignal> selector) {
        return compareSharedJointMetric(referenceJoints, attemptJoints, selector, Map.of());
    }

    private double compareSharedJointMetric(
            Map<String, JointSignal> referenceJoints,
            Map<String, JointSignal> attemptJoints,
            ToDoubleFunction<JointSignal> selector,
            Map<String, Double> focusJointWeights) {
        if (referenceJoints.isEmpty() || attemptJoints.isEmpty()) {
            return 0.0;
        }

        double weightedTotal = 0.0;
        double weightTotal = 0.0;
        for (Map.Entry<String, JointSignal> entry : referenceJoints.entrySet()) {
            JointSignal attemptJoint = attemptJoints.get(entry.getKey());
            if (attemptJoint == null) {
                continue;
            }
            double difference = Math.abs(selector.applyAsDouble(entry.getValue()) - selector.applyAsDouble(attemptJoint));
            double weight = resolveJointSummaryWeight(entry.getKey(), focusJointWeights);
            weightedTotal += difference * weight;
            weightTotal += weight;
        }
        return weightTotal > 0.0 ? weightedTotal / weightTotal : 0.0;
    }

    private double relativePointGap(List<FrameLandmarkSet> referenceFrames, List<FrameLandmarkSet> attemptFrames, String pointName) {
        int comparisons = Math.max(1, Math.min(referenceFrames.size(), attemptFrames.size()));
        double differenceTotal = 0.0;
        double weightTotal = 0.0;
        for (int index = 0; index < comparisons; index++) {
            FrameLandmarkSet referenceFrame = selectAlignedFrame(referenceFrames, index, comparisons);
            FrameLandmarkSet attemptFrame = selectAlignedFrame(attemptFrames, index, comparisons);
            LandmarkPoint referencePoint = referenceFrame.points().get(pointName);
            LandmarkPoint attemptPoint = attemptFrame.points().get(pointName);
            if (referencePoint == null || attemptPoint == null) {
                continue;
            }

            LandmarkAnchor referenceAnchor = buildAnchor(referenceFrame.points());
            LandmarkAnchor attemptAnchor = buildAnchor(attemptFrame.points());
            double referenceDistance = distanceFromAnchor(referencePoint, referenceAnchor);
            double attemptDistance = distanceFromAnchor(attemptPoint, attemptAnchor);
            double weight = combinedFrameWeight(referenceFrame, attemptFrame);
            differenceTotal += Math.abs(referenceDistance - attemptDistance) * weight;
            weightTotal += weight;
        }
        return weightTotal > 0.0 ? differenceTotal / weightTotal : 0.0;
    }

    private double distanceFromAnchor(LandmarkPoint point, LandmarkAnchor anchor) {
        return clampDouble(
                Math.hypot(point.x() - anchor.centerX(), point.y() - anchor.centerY()) / anchor.scale(),
                0.0,
                2.5);
    }

    private String resolveStrongestArea(int poseSimilarity, int timingSimilarity, int stabilitySimilarity) {
        if (poseSimilarity >= timingSimilarity && poseSimilarity >= stabilitySimilarity) {
            return AREA_POSE;
        }
        if (timingSimilarity >= stabilitySimilarity) {
            return AREA_TIMING;
        }
        return AREA_QUALITY;
    }

    private String resolveWeakestArea(int poseSimilarity, int timingSimilarity, int stabilitySimilarity) {
        if (poseSimilarity <= timingSimilarity && poseSimilarity <= stabilitySimilarity) {
            return AREA_POSE;
        }
        if (timingSimilarity <= stabilitySimilarity) {
            return AREA_TIMING;
        }
        return AREA_QUALITY;
    }

    private String toAreaLabel(String area) {
        if (AREA_TIMING.equals(area)) {
            return "타이밍";
        }
        if (AREA_QUALITY.equals(area)) {
            return "품질";
        }
        return "모양";
    }

    private List<PoseDescriptor> buildNormalizedPoseDescriptors(
            List<FrameLandmarkSet> frames,
            int targetCount,
            FocusProfile focusProfile,
            boolean useTimingFocus) {
        if (frames.isEmpty()) {
            return List.of();
        }
        int count = Math.max(2, Math.min(targetCount, Math.max(2, frames.size())));
        List<PoseDescriptor> descriptors = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            double ratio = count == 1 ? 0.0 : index / (double) (count - 1);
            FrameLandmarkSet frame = selectAlignedFrame(frames, index, count);
            double focusWeight = useTimingFocus ? resolveTimingSegmentWeight(focusProfile, ratio) : 1.0;
            descriptors.add(buildPoseDescriptor(frame.points(), buildAnchor(frame.points()), frame.qualityScore(), focusWeight));
        }
        return descriptors;
    }

    private List<MotionCurveSample> buildMotionCurve(List<PoseDescriptor> descriptors) {
        if (descriptors.size() < 2) {
            return List.of();
        }
        List<MotionCurveSample> curve = new ArrayList<>();
        for (int index = 1; index < descriptors.size(); index++) {
            PoseDescriptor previous = descriptors.get(index - 1);
            PoseDescriptor current = descriptors.get(index);
            curve.add(new MotionCurveSample(
                    comparePoseDescriptors(previous, current),
                    Math.max(0.08, average(previous.qualityScore(), current.qualityScore())
                            * average(previous.focusWeight(), current.focusWeight()))));
        }
        return curve;
    }

    private double compareMotionCurves(List<MotionCurveSample> referenceCurve, List<MotionCurveSample> attemptCurve) {
        if (referenceCurve.isEmpty() || attemptCurve.isEmpty()) {
            return 1.0;
        }
        int comparisons = Math.min(referenceCurve.size(), attemptCurve.size());
        double differenceTotal = 0.0;
        double weightTotal = 0.0;
        for (int index = 0; index < comparisons; index++) {
            MotionCurveSample referenceSample = referenceCurve.get(index);
            MotionCurveComparison bestComparison = compareMotionCurveSample(referenceSample, attemptCurve.get(index));
            if (index > 0) {
                MotionCurveComparison previousComparison = compareMotionCurveSample(referenceSample, attemptCurve.get(index - 1));
                if (previousComparison.difference() < bestComparison.difference()) {
                    bestComparison = previousComparison;
                }
            }
            if (index + 1 < attemptCurve.size()) {
                MotionCurveComparison nextComparison = compareMotionCurveSample(referenceSample, attemptCurve.get(index + 1));
                if (nextComparison.difference() < bestComparison.difference()) {
                    bestComparison = nextComparison;
                }
            }
            differenceTotal += bestComparison.difference() * bestComparison.weight();
            weightTotal += bestComparison.weight();
        }
        return weightTotal > 0.0 ? differenceTotal / weightTotal : 1.0;
    }

    private MotionCurveComparison compareMotionCurveSample(MotionCurveSample referenceSample, MotionCurveSample attemptSample) {
        return new MotionCurveComparison(
                Math.abs(referenceSample.value() - attemptSample.value()),
                Math.max(0.08, Math.sqrt(referenceSample.weight() * attemptSample.weight())));
    }

    private PoseDescriptor buildPoseDescriptor(
            Map<String, LandmarkPoint> points,
            LandmarkAnchor anchor,
            double qualityScore,
            double focusWeight) {
        List<Double> features = new ArrayList<>();

        addPairMidpointFeature(features, points, anchor, "left_shoulder", "right_shoulder", "nose");
        addPairDirectionFeature(features, points, "left_shoulder", "right_shoulder", "left_hip", "right_hip");
        addChainAngleFeature(features, points, "left_shoulder", "left_elbow", "left_wrist");
        addChainAngleFeature(features, points, "right_shoulder", "right_elbow", "right_wrist");
        addChainAngleFeature(features, points, "left_hip", "left_knee", "left_ankle");
        addChainAngleFeature(features, points, "right_hip", "right_knee", "right_ankle");
        addSegmentDirectionFeature(features, points, "left_shoulder", "left_wrist");
        addSegmentDirectionFeature(features, points, "right_shoulder", "right_wrist");
        addSegmentDirectionFeature(features, points, "left_hip", "left_ankle");
        addSegmentDirectionFeature(features, points, "right_hip", "right_ankle");
        addRelativeDistanceFeature(features, points, anchor, "left_wrist", "right_wrist");
        addRelativeDistanceFeature(features, points, anchor, "left_ankle", "right_ankle");

        return new PoseDescriptor(features, qualityScore, focusWeight);
    }

    private double resolveTimingSegmentWeight(FocusProfile focusProfile, double ratio) {
        FocusSegment segment = resolveFocusSegment(focusProfile, ratio);
        if (segment == null || segment.timingWeight() <= 0.0) {
            return 1.0;
        }
        return 0.70 + (segment.timingWeight() * 0.60);
    }

    private double comparePoseDescriptors(PoseDescriptor referenceDescriptor, PoseDescriptor attemptDescriptor) {
        return comparePoseDescriptors(referenceDescriptor, attemptDescriptor, Map.of());
    }

    private double comparePoseDescriptors(
            PoseDescriptor referenceDescriptor,
            PoseDescriptor attemptDescriptor,
            Map<Integer, Double> featureWeights) {
        List<Double> referenceFeatures = referenceDescriptor.features();
        List<Double> attemptFeatures = attemptDescriptor.features();
        if (referenceFeatures.isEmpty() || attemptFeatures.isEmpty()) {
            return 1.0;
        }

        int comparisons = Math.min(referenceFeatures.size(), attemptFeatures.size());
        double weightedTotal = 0.0;
        double weightTotal = 0.0;
        for (int index = 0; index < comparisons; index++) {
            double referenceValue = referenceFeatures.get(index);
            double attemptValue = attemptFeatures.get(index);
            double difference = isAngleFeatureIndex(index)
                    ? angleDifference(referenceValue, attemptValue) / Math.PI
                    : Math.abs(referenceValue - attemptValue);
            double weight = featureWeights.getOrDefault(index, 1.0);
            weightedTotal += difference * weight;
            weightTotal += weight;
        }
        return weightTotal > 0.0 ? weightedTotal / weightTotal : 1.0;
    }

    private Map<Integer, Double> resolvePoseFeatureWeights(FocusProfile focusProfile, double ratio) {
        Map<String, Double> jointWeights = aggregateFocusJointWeights(focusProfile);
        FocusSegment segment = resolveFocusSegment(focusProfile, ratio);
        if (segment != null) {
            segment.jointWeights().forEach((name, weight) -> jointWeights.merge(name, weight, Math::max));
        }

        Map<Integer, Double> featureWeights = new HashMap<>();
        for (int index = 0; index < 12; index++) {
            featureWeights.put(index, resolvePoseFeatureWeight(index, jointWeights));
        }
        return featureWeights;
    }

    private double resolvePoseFeatureWeight(int featureIndex, Map<String, Double> jointWeights) {
        return switch (featureIndex) {
            case 0 -> 1.0 + weightedAverage(jointWeights, "leftHip", "rightHip") * 0.18;
            case 1 -> 1.0 + weightedAverage(jointWeights, "leftHip", "rightHip") * 0.22;
            case 2 -> 1.0 + weightedAverage(jointWeights, "leftElbow", "leftWrist") * 1.20;
            case 3 -> 1.0 + weightedAverage(jointWeights, "rightElbow", "rightWrist") * 1.20;
            case 4 -> 1.0 + weightedAverage(jointWeights, "leftKnee", "leftAnkle", "leftHip") * 0.70;
            case 5 -> 1.0 + weightedAverage(jointWeights, "rightKnee", "rightAnkle", "rightHip") * 0.70;
            case 6 -> 1.0 + weightedAverage(jointWeights, "leftWrist", "leftElbow") * 1.05;
            case 7 -> 1.0 + weightedAverage(jointWeights, "rightWrist", "rightElbow") * 1.05;
            case 8 -> 1.0 + weightedAverage(jointWeights, "leftAnkle", "leftKnee", "leftHip") * 0.62;
            case 9 -> 1.0 + weightedAverage(jointWeights, "rightAnkle", "rightKnee", "rightHip") * 0.62;
            case 10 -> 1.0 + weightedAverage(jointWeights, "leftWrist", "rightWrist", "leftElbow", "rightElbow") * 1.15;
            case 11 -> 1.0 + weightedAverage(jointWeights, "leftAnkle", "rightAnkle", "leftKnee", "rightKnee") * 0.68;
            default -> 1.0;
        };
    }

    private Map<String, Double> aggregateFocusJointWeights(FocusProfile focusProfile) {
        if (focusProfile == null) {
            return Map.of();
        }

        Map<String, Double> weights = new LinkedHashMap<>();
        for (WeightedFocusTarget target : focusProfile.primaryJoints()) {
            weights.merge(target.name(), target.weight(), Math::max);
        }
        for (FocusSegment segment : focusProfile.segments()) {
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

    private double resolvePoseSegmentWeight(FocusProfile focusProfile, double ratio) {
        FocusSegment segment = resolveFocusSegment(focusProfile, ratio);
        if (segment == null || segment.poseWeight() <= 0.0) {
            return 1.0;
        }
        return 0.72 + (segment.poseWeight() * 0.56);
    }

    private double resolveJointSummaryWeight(String jointName, Map<String, Double> focusJointWeights) {
        return 1.0 + (focusJointWeights.getOrDefault(jointName, 0.0) * 0.70);
    }

    private double weightedAverage(Map<String, Double> weights, String... keys) {
        double total = 0.0;
        int count = 0;
        for (String key : keys) {
            Double weight = weights.get(key);
            if (weight == null) {
                continue;
            }
            total += weight;
            count++;
        }
        return count == 0 ? 0.0 : total / count;
    }

    private boolean isAngleFeatureIndex(int index) {
        return index < 10;
    }

    private void addPairMidpointFeature(
            List<Double> features,
            Map<String, LandmarkPoint> points,
            LandmarkAnchor anchor,
            String leftName,
            String rightName,
            String targetName) {
        LandmarkPoint left = points.get(leftName);
        LandmarkPoint right = points.get(rightName);
        LandmarkPoint target = points.get(targetName);
        if (left == null || right == null || target == null) {
            return;
        }
        LandmarkPoint midpoint = new LandmarkPoint((left.x() + right.x()) / 2.0, (left.y() + right.y()) / 2.0, 0.0, 1.0);
        features.add(normalizeAngle(Math.atan2(target.y() - midpoint.y(), target.x() - midpoint.x())));
        features.add(clampDistance(distanceBetween(midpoint, target) / anchor.scale()));
    }

    private void addPairDirectionFeature(
            List<Double> features,
            Map<String, LandmarkPoint> points,
            String firstLeft,
            String firstRight,
            String secondLeft,
            String secondRight) {
        LandmarkPoint aLeft = points.get(firstLeft);
        LandmarkPoint aRight = points.get(firstRight);
        LandmarkPoint bLeft = points.get(secondLeft);
        LandmarkPoint bRight = points.get(secondRight);
        if (aLeft == null || aRight == null || bLeft == null || bRight == null) {
            return;
        }
        LandmarkPoint aMid = new LandmarkPoint((aLeft.x() + aRight.x()) / 2.0, (aLeft.y() + aRight.y()) / 2.0, 0.0, 1.0);
        LandmarkPoint bMid = new LandmarkPoint((bLeft.x() + bRight.x()) / 2.0, (bLeft.y() + bRight.y()) / 2.0, 0.0, 1.0);
        features.add(normalizeAngle(Math.atan2(bMid.y() - aMid.y(), bMid.x() - aMid.x())));
    }

    private void addChainAngleFeature(List<Double> features, Map<String, LandmarkPoint> points, String start, String joint, String end) {
        LandmarkPoint startPoint = points.get(start);
        LandmarkPoint jointPoint = points.get(joint);
        LandmarkPoint endPoint = points.get(end);
        if (startPoint == null || jointPoint == null || endPoint == null) {
            return;
        }
        double firstAngle = Math.atan2(startPoint.y() - jointPoint.y(), startPoint.x() - jointPoint.x());
        double secondAngle = Math.atan2(endPoint.y() - jointPoint.y(), endPoint.x() - jointPoint.x());
        features.add(normalizeAngle(secondAngle - firstAngle));
    }

    private void addSegmentDirectionFeature(List<Double> features, Map<String, LandmarkPoint> points, String start, String end) {
        LandmarkPoint startPoint = points.get(start);
        LandmarkPoint endPoint = points.get(end);
        if (startPoint == null || endPoint == null) {
            return;
        }
        features.add(normalizeAngle(Math.atan2(endPoint.y() - startPoint.y(), endPoint.x() - startPoint.x())));
    }

    private void addRelativeDistanceFeature(
            List<Double> features,
            Map<String, LandmarkPoint> points,
            LandmarkAnchor anchor,
            String firstName,
            String secondName) {
        LandmarkPoint firstPoint = points.get(firstName);
        LandmarkPoint secondPoint = points.get(secondName);
        if (firstPoint == null || secondPoint == null) {
            return;
        }
        features.add(clampDistance(distanceBetween(firstPoint, secondPoint) / anchor.scale()));
    }

    private double normalizeAngle(double angle) {
        while (angle > Math.PI) {
            angle -= Math.PI * 2.0;
        }
        while (angle < -Math.PI) {
            angle += Math.PI * 2.0;
        }
        return angle;
    }

    private double angleDifference(double left, double right) {
        return Math.abs(normalizeAngle(left - right));
    }

    private double distanceBetween(LandmarkPoint left, LandmarkPoint right) {
        return Math.sqrt(square(left.x() - right.x()) + square(left.y() - right.y()));
    }

    private double clampDistance(double value) {
        return Math.max(0.0, Math.min(value, 2.5));
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private double clampDouble(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private double square(double value) {
        return value * value;
    }

    private double readDouble(JsonNode node, double fallback) {
        return node != null && node.isNumber() ? node.asDouble() : fallback;
    }

    private double average(double... values) {
        double total = 0.0;
        int count = 0;
        for (double value : values) {
            total += value;
            count++;
        }
        return count == 0 ? 0.0 : total / count;
    }

    private double averageVisibility(Map<String, LandmarkPoint> points, String... pointNames) {
        List<Double> visibilities = new ArrayList<>();
        for (String pointName : pointNames) {
            LandmarkPoint point = points.get(pointName);
            if (point != null) {
                visibilities.add(point.visibility());
            }
        }
        return visibilities.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private record ParsedMotionProfile(
            int signature,
            int sampleCount,
            long durationMs,
            List<FrameLandmarkSet> frames,
            int processedFrames,
            int framesWithPose,
            double averageVisibility,
            MotionSignals signals,
            boolean hasAnalysisSummary,
            FocusProfile focusProfile) {

        static ParsedMotionProfile empty() {
            return new ParsedMotionProfile(0, 0, 0L, List.of(), 0, 0, 0.0, MotionSignals.empty(), false, FocusProfile.empty());
        }

        boolean hasLandmarks() {
            return !frames.isEmpty();
        }

        double detectionCoverage() {
            if (hasAnalysisSummary) {
                return signals.detectionCoverage();
            }
            if (processedFrames <= 0) {
                return sampleCount > 0 ? 1.0 : 0.0;
            }
            return Math.min(1.0, framesWithPose / (double) processedFrames);
        }

        long frameSpan() {
            if (frames.size() <= 1) {
                return frames.size();
            }
            int minFrame = frames.stream().map(FrameLandmarkSet::frameIndex).min(Comparator.naturalOrder()).orElse(0);
            int maxFrame = frames.stream().map(FrameLandmarkSet::frameIndex).max(Comparator.naturalOrder()).orElse(minFrame);
            return Math.max(1, maxFrame - minFrame);
        }
    }

    private record FrameLandmarkSet(int frameIndex, Map<String, LandmarkPoint> points, double qualityScore) {
    }

    private record LandmarkPoint(double x, double y, double z, double visibility) {
    }

    private record LandmarkAnchor(double centerX, double centerY, double scale) {
    }

    private record JointSignal(double mean, double range, double stdDev) {
    }

    private record MotionSignals(
            double detectionCoverage,
            double averageVisibility,
            double visibilitySpread,
            double torsoScaleStdDev,
            double centerLineOffsetMean,
            double centerDriftMean,
            double centerDriftPeak,
            double motionEnergyMean,
            double motionEnergyStdDev,
            double motionEnergyPeak,
            double motionBurstCount,
            double upperBodySymmetry,
            double lowerBodySymmetry,
            double fullBodySymmetry,
            double jointRangeMean,
            double jointRangePeak,
            double jointStabilityMean,
            Map<String, JointSignal> joints) {

        static MotionSignals empty() {
            return new MotionSignals(
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    Map.of());
        }
    }

    private record MotionCurveSample(double value, double weight) {
    }

    private record MotionCurveComparison(double difference, double weight) {
    }

    private record FocusProfile(
            String version,
            List<WeightedFocusTarget> primaryJoints,
            List<FocusSegment> segments) {

        static FocusProfile empty() {
            return new FocusProfile("v1", List.of(), List.of());
        }
    }

    private record WeightedFocusTarget(String name, double weight) {
    }

    private record FocusSegment(
            String key,
            String label,
            double startRatio,
            double endRatio,
            double poseWeight,
            double timingWeight,
            String dominantRegion,
            Map<String, Double> jointWeights) {
    }

    private record PoseDescriptor(List<Double> features, double qualityScore, double focusWeight) {
        PoseDescriptor(List<Double> features, double qualityScore, double focusWeight) {
            this.features = Collections.unmodifiableList(new ArrayList<>(features));
            this.qualityScore = qualityScore;
            this.focusWeight = focusWeight;
        }
    }
}
