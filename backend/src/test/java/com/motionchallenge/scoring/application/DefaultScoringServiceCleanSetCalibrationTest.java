package com.motionchallenge.scoring.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfSystemProperty(named = "mocha.cleanSetCalibration", matches = "true")
class DefaultScoringServiceCleanSetCalibrationTest {

    private static final Path ANALYSIS_ROOT = Path.of(
            "..",
            "motion-calibration",
            "2026-04-25-clean-set",
            "analysis");
    private static final Path ACTUAL_UPLOAD_ANALYSIS_ROOT = Path.of(
            "..",
            "tmp",
            "actual-upload-analysis-fixed");

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final DefaultScoringService scoringService = new DefaultScoringService(objectMapper);

    @Test
    void cleanSetScoresStaySeparatedByExpectedBands() throws Exception {
        AnalysisPayload reference = readPayload("reference-analysis.json");
        ChallengeMotionProfile referenceProfile = new ChallengeMotionProfile(
                new Challenge("clean set", "desc", "calibration", "medium", null, null, 16, true),
                reference.rawJson(),
                reference.signature(),
                reference.sampleCount(),
                reference.durationMs(),
                reference.analyzerName(),
                LocalDateTime.now());

        List<AttemptExpectation> expectations = List.of(
                new AttemptExpectation("strong", "attempt-strong-analysis.json", 85, 100, "pose timing"),
                new AttemptExpectation("similar", "attempt-similar-analysis.json", 55, 84, "pose timing"),
                new AttemptExpectation("wrong", "attempt-wrong-analysis.json", 0, 66, "pose shape"),
                new AttemptExpectation("static", "attempt-static-analysis.json", 0, 15, "pose shape"),
                new AttemptExpectation("low-confidence", "attempt-low-confidence-analysis.json", 0, 44, "detection quality"));

        List<String> failures = new ArrayList<>();
        for (AttemptExpectation expectation : expectations) {
            AnalysisPayload attempt = readPayload(expectation.fileName());
            ScoringResult result = scoringService.calculateScore(
                    referenceProfile,
                    new MotionAnalysisResult(
                            attempt.rawJson(),
                            attempt.signature(),
                            attempt.sampleCount(),
                            attempt.durationMs(),
                            attempt.analyzerName()));

            System.out.printf(
                    "clean-set %-14s score=%3d pose=%3d timing=%3d quality=%3d weakest=%s summary=%s%n",
                    expectation.label(),
                    result.score(),
                    result.poseSimilarity(),
                    result.timingSimilarity(),
                    result.stabilitySimilarity(),
                    result.weakestArea(),
                    result.summary());

            if (result.score() < expectation.minScore() || result.score() > expectation.maxScore()) {
                failures.add("%s score %d expected [%d, %d]".formatted(
                        expectation.label(),
                        result.score(),
                        expectation.minScore(),
                        expectation.maxScore()));
            }
            if (!expectation.weakestArea().equals(result.weakestArea())) {
                failures.add("%s weakestArea %s expected %s".formatted(
                        expectation.label(),
                        result.weakestArea(),
                        expectation.weakestArea()));
            }
        }

        assertThat(failures).isEmpty();
    }

    @Test
    void actualUploadedWebmAnalysesDoNotCollapseToThirtyTwo() throws Exception {
        Path referencePath = ACTUAL_UPLOAD_ANALYSIS_ROOT.resolve("reference-ch10-db.json");
        Path attempt2Path = ACTUAL_UPLOAD_ANALYSIS_ROOT.resolve("attempt-2-ch10.json");
        Path attempt4Path = ACTUAL_UPLOAD_ANALYSIS_ROOT.resolve("attempt-4-ch10.json");
        if (!Files.exists(referencePath) || !Files.exists(attempt2Path) || !Files.exists(attempt4Path)) {
            return;
        }

        AnalysisPayload reference = readPayload(referencePath);
        ChallengeMotionProfile referenceProfile = new ChallengeMotionProfile(
                new Challenge("actual upload", "desc", "calibration", "medium", null, null, 16, true),
                reference.rawJson(),
                reference.signature(),
                reference.sampleCount(),
                reference.durationMs(),
                reference.analyzerName(),
                LocalDateTime.now());

        List<AnalysisPayload> attempts = List.of(readPayload(attempt2Path), readPayload(attempt4Path));
        for (AnalysisPayload attempt : attempts) {
            ScoringResult result = scoringService.calculateScore(
                    referenceProfile,
                    new MotionAnalysisResult(
                            attempt.rawJson(),
                            attempt.signature(),
                            attempt.sampleCount(),
                            attempt.durationMs(),
                            attempt.analyzerName()));

            System.out.printf(
                    "actual-upload score=%3d pose=%3d timing=%3d quality=%3d weakest=%s summary=%s%n",
                    result.score(),
                    result.poseSimilarity(),
                    result.timingSimilarity(),
                    result.stabilitySimilarity(),
                    result.weakestArea(),
                    result.summary());

            assertThat(result.score()).isNotEqualTo(32);
        }
    }

    private AnalysisPayload readPayload(String fileName) throws Exception {
        return readPayload(ANALYSIS_ROOT.resolve(fileName));
    }

    private AnalysisPayload readPayload(Path path) throws Exception {
        String rawJson = Files.readString(path);
        if (!rawJson.isEmpty() && rawJson.charAt(0) == '\uFEFF') {
            rawJson = rawJson.substring(1);
        }
        JsonNode root = objectMapper.readTree(rawJson);
        return new AnalysisPayload(
                rawJson,
                root.path("signature").asInt(),
                root.path("sampleCount").asInt(),
                root.path("durationMs").asLong(),
                root.path("analyzerName").asText("mediapipe-fastapi-pose-v1"));
    }

    private record AnalysisPayload(
            String rawJson,
            int signature,
            int sampleCount,
            long durationMs,
            String analyzerName) {
    }

    private record AttemptExpectation(String label, String fileName, int minScore, int maxScore, String weakestArea) {
    }
}
