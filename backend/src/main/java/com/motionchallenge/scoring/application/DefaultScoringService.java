package com.motionchallenge.scoring.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
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
        double poseDifference = calculatePoseDifference(reference, attempt);
        double timingDifference = calculateTimingDifference(reference, attempt);
        double stabilityDifference = calculateStabilityDifference(reference, attempt);

        int poseSimilarity = convertDifferenceToSimilarity(poseDifference, 160.0, 100);
        int timingSimilarity = convertDifferenceToSimilarity(timingDifference, 220.0, 100);
        int stabilitySimilarity = convertDifferenceToSimilarity(stabilityDifference, 180.0, 100);

        double weightedScore = poseSimilarity * 0.72 + timingSimilarity * 0.16 + stabilitySimilarity * 0.12;
        int score = clamp((int) Math.round(weightedScore), 0, 100);
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

        int poseSimilarity = convertDifferenceToSimilarity(poseDifferenceRatio, 185.0, 72);
        int timingSimilarity = convertDifferenceToSimilarity(timingDifferenceRatio, 130.0, 82);
        int stabilitySimilarity = convertDifferenceToSimilarity(stabilityDifferenceRatio, 110.0, 86);

        double weightedScore = poseSimilarity * 0.65 + timingSimilarity * 0.20 + stabilitySimilarity * 0.15;
        int score = clamp((int) Math.round(weightedScore), 0, 100);
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

    private double calculatePoseDifference(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        int comparisonFrames = Math.max(1, Math.min(reference.frames().size(), attempt.frames().size()));
        List<Double> distances = new ArrayList<>();
        for (int index = 0; index < comparisonFrames; index++) {
            FrameLandmarkSet referenceFrame = selectAlignedFrame(reference.frames(), index, comparisonFrames);
            FrameLandmarkSet attemptFrame = selectAlignedFrame(attempt.frames(), index, comparisonFrames);
            distances.add(compareFrame(referenceFrame, attemptFrame));
        }
        return distances.stream().mapToDouble(Double::doubleValue).average().orElse(1.0);
    }

    private double calculateTimingDifference(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
        double durationGap = ratioGap(reference.durationMs(), attempt.durationMs());
        double sampleGap = ratioGap(reference.sampleCount(), attempt.sampleCount());
        double spanGap = ratioGap(reference.frameSpan(), attempt.frameSpan());
        return durationGap * 0.55 + sampleGap * 0.20 + spanGap * 0.25;
    }

    private double calculateStabilityDifference(ParsedMotionProfile reference, ParsedMotionProfile attempt) {
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

    private double compareFrame(FrameLandmarkSet referenceFrame, FrameLandmarkSet attemptFrame) {
        LandmarkAnchor referenceAnchor = buildAnchor(referenceFrame.points());
        LandmarkAnchor attemptAnchor = buildAnchor(attemptFrame.points());
        List<Double> pointDistances = new ArrayList<>();

        for (String landmarkName : CORE_LANDMARKS) {
            LandmarkPoint referencePoint = referenceFrame.points().get(landmarkName);
            LandmarkPoint attemptPoint = attemptFrame.points().get(landmarkName);
            if (referencePoint == null || attemptPoint == null) {
                continue;
            }

            double referenceX = (referencePoint.x() - referenceAnchor.centerX()) / referenceAnchor.scale();
            double referenceY = (referencePoint.y() - referenceAnchor.centerY()) / referenceAnchor.scale();
            double referenceZ = referencePoint.z() / referenceAnchor.scale();
            double attemptX = (attemptPoint.x() - attemptAnchor.centerX()) / attemptAnchor.scale();
            double attemptY = (attemptPoint.y() - attemptAnchor.centerY()) / attemptAnchor.scale();
            double attemptZ = attemptPoint.z() / attemptAnchor.scale();

            double distance = Math.sqrt(
                    square(referenceX - attemptX)
                            + square(referenceY - attemptY)
                            + square((referenceZ - attemptZ) * 0.35));
            double visibilityPenalty = Math.abs(referencePoint.visibility() - attemptPoint.visibility()) * 0.08;
            pointDistances.add(distance + visibilityPenalty);
        }

        return pointDistances.stream().mapToDouble(Double::doubleValue).average().orElse(1.0);
    }

    private LandmarkAnchor buildAnchor(Map<String, LandmarkPoint> points) {
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
                + ". Pose "
                + poseSimilarity
                + ", timing "
                + timingSimilarity
                + ", stability "
                + stabilitySimilarity
                + ".";
    }

    private String resolveStrongestArea(int poseSimilarity, int timingSimilarity, int stabilitySimilarity) {
        if (poseSimilarity >= timingSimilarity && poseSimilarity >= stabilitySimilarity) {
            return "pose similarity";
        }
        if (timingSimilarity >= stabilitySimilarity) {
            return "timing";
        }
        return "detection stability";
    }

    private String resolveWeakestArea(int poseSimilarity, int timingSimilarity, int stabilitySimilarity) {
        if (poseSimilarity <= timingSimilarity && poseSimilarity <= stabilitySimilarity) {
            return "pose similarity";
        }
        if (timingSimilarity <= stabilitySimilarity) {
            return "timing";
        }
        return "detection stability";
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
}
