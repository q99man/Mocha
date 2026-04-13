package com.motionchallenge.scoring.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class DefaultScoringService implements ScoringService {

    private static final List<String> CORE_LANDMARKS = List.of(
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

        int poseSimilarity = convertDifferenceToSimilarity(poseDifference, 115.0, 100);
        int timingSimilarity = convertDifferenceToSimilarity(timingDifference, 150.0, 100);
        int stabilitySimilarity = convertDifferenceToSimilarity(stabilityDifference, 120.0, 100);

        double weightedScore = poseSimilarity * 0.50 + timingSimilarity * 0.45 + stabilitySimilarity * 0.05;
        int score = clamp((int) Math.round(weightedScore), 0, 100);
        score = applyPrimaryAxisCap(score, poseSimilarity, timingSimilarity);
        score = applyDiscriminationCurve(score, poseSimilarity, timingSimilarity);
        String strongestArea = resolveStrongestArea(poseSimilarity, timingSimilarity, stabilitySimilarity);
        String weakestArea = resolveWeakestArea(poseSimilarity, timingSimilarity, stabilitySimilarity);
        String summary = buildSummary(score, strongestArea, weakestArea, poseSimilarity, timingSimilarity, stabilitySimilarity);

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
        String summary = buildSummary(score, strongestArea, weakestArea, poseSimilarity, timingSimilarity, stabilitySimilarity);

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
                    frames.add(new FrameLandmarkSet(frameIndex, points));
                }
            }

            int processedFrames = extras.path("processedFrames").asInt(Math.max(frames.size(), metrics.path("sampleCount").asInt(frames.size())));
            int framesWithPose = extras.path("framesWithPose").asInt(frames.size());

            return new ParsedMotionProfile(
                    metrics.path("signature").asInt(),
                    metrics.path("sampleCount").asInt(frames.size()),
                    metrics.path("durationMs").asLong(),
                    frames,
                    processedFrames,
                    framesWithPose,
                    calculateAverageVisibility(frames));
        } catch (IOException exception) {
            return ParsedMotionProfile.empty();
        }
    }

    private double calculatePoseShapeDifference(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        int comparisonFrames = Math.max(1, Math.min(reference.frames().size(), attempt.frames().size()));
        List<Double> distances = new ArrayList<>();
        for (int index = 0; index < comparisonFrames; index++) {
            FrameLandmarkSet referenceFrame = selectAlignedFrame(reference.frames(), index, comparisonFrames);
            FrameLandmarkSet attemptFrame = selectAlignedFrame(attempt.frames(), index, comparisonFrames);
            distances.add(comparePoseShape(referenceFrame, attemptFrame));
        }
        return distances.stream().mapToDouble(Double::doubleValue).average().orElse(1.0);
    }

    private double calculateTimingDifference(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        List<PoseDescriptor> referenceDescriptors = buildNormalizedPoseDescriptors(reference.frames(), 12);
        List<PoseDescriptor> attemptDescriptors = buildNormalizedPoseDescriptors(attempt.frames(), 12);
        if (referenceDescriptors.size() < 2 || attemptDescriptors.size() < 2) {
            double durationGap = ratioGap(reference.durationMs(), attempt.durationMs());
            double sampleGap = ratioGap(reference.sampleCount(), attempt.sampleCount());
            return durationGap * 0.75 + sampleGap * 0.25;
        }

        List<Double> referenceMotionCurve = buildMotionCurve(referenceDescriptors);
        List<Double> attemptMotionCurve = buildMotionCurve(attemptDescriptors);
        double timingCurveDifference = compareMotionCurves(referenceMotionCurve, attemptMotionCurve);
        double durationGap = ratioGap(reference.durationMs(), attempt.durationMs());
        double frameSpanGap = ratioGap(reference.frameSpan(), attempt.frameSpan());
        return timingCurveDifference * 0.65 + durationGap * 0.20 + frameSpanGap * 0.15;
    }

    private double calculateDetectionQualityDifference(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        double coverageGap = Math.abs(reference.detectionCoverage() - attempt.detectionCoverage());
        double visibilityGap = Math.abs(reference.averageVisibility() - attempt.averageVisibility());
        double sampleGap = ratioGap(reference.sampleCount(), attempt.sampleCount());
        return coverageGap * 0.5 + visibilityGap * 0.35 + sampleGap * 0.15;
    }

    private FrameLandmarkSet selectAlignedFrame(List<FrameLandmarkSet> frames, int index, int totalComparisons) {
        if (frames.size() == 1 || totalComparisons == 1) {
            return frames.get(0);
        }
        double ratio = index / (double) (totalComparisons - 1);
        int frameIndex = (int) Math.round(ratio * (frames.size() - 1));
        return frames.get(Math.max(0, Math.min(frameIndex, frames.size() - 1)));
    }

    private double comparePoseShape(FrameLandmarkSet referenceFrame, FrameLandmarkSet attemptFrame) {
        LandmarkAnchor referenceAnchor = buildAnchor(referenceFrame.points());
        LandmarkAnchor attemptAnchor = buildAnchor(attemptFrame.points());
        PoseDescriptor referenceDescriptor = buildPoseDescriptor(referenceFrame.points(), referenceAnchor);
        PoseDescriptor attemptDescriptor = buildPoseDescriptor(attemptFrame.points(), attemptAnchor);
        return comparePoseDescriptors(referenceDescriptor, attemptDescriptor);
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

    private double ratioGap(long referenceValue, long attemptValue) {
        long denominator = Math.max(Math.abs(referenceValue), 1L);
        return Math.abs(referenceValue - attemptValue) / (double) denominator;
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
            int stabilitySimilarity) {
        if (score >= 90) {
            return "Very close match. Strongest area: " + strongestArea + ".";
        }
        if (score >= 75) {
            return "Good overall match. Strongest area: " + strongestArea + ", but " + weakestArea + " still differs.";
        }
        if (score >= 60) {
            return "Partially similar result. The upload stayed closest in " + strongestArea + ", while " + weakestArea + " pulled the score down.";
        }
        return "Meaningful difference detected. Weakest area: "
                + weakestArea
                + ". Shape "
                + poseSimilarity
                + ", timing "
                + timingSimilarity
                + ", quality "
                + stabilitySimilarity
                + ".";
    }

    private String resolveStrongestArea(int poseSimilarity, int timingSimilarity, int stabilitySimilarity) {
        if (poseSimilarity >= timingSimilarity && poseSimilarity >= stabilitySimilarity) {
            return "pose shape";
        }
        if (timingSimilarity >= stabilitySimilarity) {
            return "pose timing";
        }
        return "detection quality";
    }

    private String resolveWeakestArea(int poseSimilarity, int timingSimilarity, int stabilitySimilarity) {
        if (poseSimilarity <= timingSimilarity && poseSimilarity <= stabilitySimilarity) {
            return "pose shape";
        }
        if (timingSimilarity <= stabilitySimilarity) {
            return "pose timing";
        }
        return "detection quality";
    }

    private List<PoseDescriptor> buildNormalizedPoseDescriptors(List<FrameLandmarkSet> frames, int targetCount) {
        if (frames.isEmpty()) {
            return List.of();
        }
        int count = Math.max(2, Math.min(targetCount, Math.max(2, frames.size())));
        List<PoseDescriptor> descriptors = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            FrameLandmarkSet frame = selectAlignedFrame(frames, index, count);
            descriptors.add(buildPoseDescriptor(frame.points(), buildAnchor(frame.points())));
        }
        return descriptors;
    }

    private List<Double> buildMotionCurve(List<PoseDescriptor> descriptors) {
        if (descriptors.size() < 2) {
            return List.of();
        }
        List<Double> curve = new ArrayList<>();
        for (int index = 1; index < descriptors.size(); index++) {
            curve.add(comparePoseDescriptors(descriptors.get(index - 1), descriptors.get(index)));
        }
        return curve;
    }

    private double compareMotionCurves(List<Double> referenceCurve, List<Double> attemptCurve) {
        if (referenceCurve.isEmpty() || attemptCurve.isEmpty()) {
            return 1.0;
        }
        int comparisons = Math.min(referenceCurve.size(), attemptCurve.size());
        List<Double> differences = new ArrayList<>();
        for (int index = 0; index < comparisons; index++) {
            double best = Math.abs(referenceCurve.get(index) - attemptCurve.get(index));
            if (index > 0) {
                best = Math.min(best, Math.abs(referenceCurve.get(index) - attemptCurve.get(index - 1)));
            }
            if (index + 1 < attemptCurve.size()) {
                best = Math.min(best, Math.abs(referenceCurve.get(index) - attemptCurve.get(index + 1)));
            }
            differences.add(best);
        }
        return differences.stream().mapToDouble(Double::doubleValue).average().orElse(1.0);
    }

    private PoseDescriptor buildPoseDescriptor(Map<String, LandmarkPoint> points, LandmarkAnchor anchor) {
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

        return new PoseDescriptor(features);
    }

    private double comparePoseDescriptors(PoseDescriptor referenceDescriptor, PoseDescriptor attemptDescriptor) {
        List<Double> referenceFeatures = referenceDescriptor.features();
        List<Double> attemptFeatures = attemptDescriptor.features();
        if (referenceFeatures.isEmpty() || attemptFeatures.isEmpty()) {
            return 1.0;
        }

        int comparisons = Math.min(referenceFeatures.size(), attemptFeatures.size());
        List<Double> differences = new ArrayList<>();
        for (int index = 0; index < comparisons; index++) {
            double referenceValue = referenceFeatures.get(index);
            double attemptValue = attemptFeatures.get(index);
            double difference = isAngleFeatureIndex(index)
                    ? angleDifference(referenceValue, attemptValue) / Math.PI
                    : Math.abs(referenceValue - attemptValue);
            differences.add(difference);
        }
        return differences.stream().mapToDouble(Double::doubleValue).average().orElse(1.0);
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

    private double square(double value) {
        return value * value;
    }

    private record ParsedMotionProfile(
            int signature,
            int sampleCount,
            long durationMs,
            List<FrameLandmarkSet> frames,
            int processedFrames,
            int framesWithPose,
            double averageVisibility) {

        static ParsedMotionProfile empty() {
            return new ParsedMotionProfile(0, 0, 0L, List.of(), 0, 0, 0.0);
        }

        boolean hasLandmarks() {
            return !frames.isEmpty();
        }

        double detectionCoverage() {
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

    private record FrameLandmarkSet(int frameIndex, Map<String, LandmarkPoint> points) {
    }

    private record LandmarkPoint(double x, double y, double z, double visibility) {
    }

    private record LandmarkAnchor(double centerX, double centerY, double scale) {
    }

    private record PoseDescriptor(List<Double> features) {
        PoseDescriptor(List<Double> features) {
            this.features = Collections.unmodifiableList(new ArrayList<>(features));
        }
    }
}
