package com.motionchallenge.attempt.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MediaPipeBridgeResponse;
import com.motionchallenge.motion.service.MediaPipeBridgeResultMapper;
import com.motionchallenge.motion.service.MotionAnalysisProfilePayloadFactory;
import com.motionchallenge.motion.service.MotionAnalysisProperties;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import com.motionchallenge.scoring.application.DefaultScoringService;
import com.motionchallenge.scoring.application.ScoringResult;
import com.motionchallenge.video.service.StoredVideo;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class MotionCalibrationSampleReportTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final DefaultScoringService scoringService = new DefaultScoringService(objectMapper);
    private final AttemptJudgementTimelineService timelineService = new AttemptJudgementTimelineService(objectMapper);
    private final MotionAnalysisProfilePayloadFactory payloadFactory =
            new MotionAnalysisProfilePayloadFactory(objectMapper, new MotionAnalysisProperties());
    private final MediaPipeBridgeResultMapper resultMapper = new MediaPipeBridgeResultMapper(payloadFactory);

    @Test
    void motionCalibrationSamplesProduceUsefulScoreOrderingAndJudgementDistribution() throws Exception {
        Path repoRoot = Path.of("..").toAbsolutePath().normalize();
        Path calibrationRoot = repoRoot.resolve("motion-calibration");
        Path pythonExe = repoRoot.resolve("mediapipe-bridge").resolve(".venv").resolve("Scripts").resolve("python.exe");
        Path workingRoot = repoRoot.resolve("backend").resolve("build").resolve("tmp").resolve("motion-calibration");

        assumeTrue(Files.isDirectory(calibrationRoot), "motion-calibration directory is required for local calibration report");
        assumeTrue(Files.exists(pythonExe), "mediapipe bridge virtualenv python is required for local calibration report");
        Files.createDirectories(workingRoot);

        List<Path> challengeDirectories;
        try (var stream = Files.list(calibrationRoot)) {
            challengeDirectories = stream
                    .filter(Files::isDirectory)
                    .sorted()
                    .toList();
        }

        assertThat(challengeDirectories).isNotEmpty();

        System.out.println("=== Motion Calibration Report ===");

        for (Path challengeDirectory : challengeDirectories) {
            Path referenceFile = resolveSingleVideo(challengeDirectory.resolve("reference"));
            List<Path> attemptFiles = listVideoFiles(challengeDirectory.resolve("attempts"));
            assertThat(referenceFile).isNotNull();
            assertThat(attemptFiles).isNotEmpty();

            MotionAnalysisResult referenceAnalysis = analyzeVideo(pythonExe, repoRoot, workingRoot, referenceFile, "reference");
            Challenge challenge = new Challenge(
                    challengeDirectory.getFileName().toString(),
                    "motion calibration report",
                    "calibration",
                    "medium",
                    null,
                    null,
                    Math.max(1, (int) Math.round(referenceAnalysis.durationMs() / 1000.0)),
                    true);
            ChallengeMotionProfile referenceProfile = new ChallengeMotionProfile(
                    challenge,
                    referenceAnalysis.rawProfileData(),
                    referenceAnalysis.signature(),
                    referenceAnalysis.sampleCount(),
                    referenceAnalysis.durationMs(),
                    referenceAnalysis.analyzerName(),
                    LocalDateTime.now());

            List<CalibrationResult> results = new ArrayList<>();
            for (Path attemptFile : attemptFiles) {
                MotionAnalysisResult attemptAnalysis = analyzeVideo(pythonExe, repoRoot, workingRoot, attemptFile, "attempt");
                ScoringResult scoringResult = scoringService.calculateScore(referenceProfile, attemptAnalysis);
                List<AttemptJudgementCueResponse> cues = timelineService.buildTimeline(
                        referenceProfile.getProfileData(),
                        attemptAnalysis.rawProfileData());
                results.add(buildCalibrationResult(attemptFile, scoringResult, cues));
            }

            printChallengeReport(challengeDirectory.getFileName().toString(), results);
            assertUsefulOrdering(challengeDirectory.getFileName().toString(), results);
        }
    }

    private CalibrationResult buildCalibrationResult(
            Path attemptFile,
            ScoringResult scoringResult,
            List<AttemptJudgementCueResponse> cues) {
        Map<String, Long> verdictCounts = cues.stream()
                .collect(Collectors.groupingBy(AttemptJudgementCueResponse::verdict, LinkedHashMap::new, Collectors.counting()));
        long stableCount = cues.stream()
                .filter(cue -> cue.verdict().equals("PERFECT") || cue.verdict().equals("GOOD") || cue.verdict().equals("HOLD"))
                .count();
        int maxCombo = cues.stream().mapToInt(AttemptJudgementCueResponse::combo).max().orElse(0);
        double averageConfidence = cues.stream().mapToDouble(AttemptJudgementCueResponse::confidence).average().orElse(0.0);
        SampleLabel label = resolveSampleLabel(attemptFile.getFileName().toString());
        return new CalibrationResult(
                attemptFile.getFileName().toString(),
                label,
                scoringResult.score(),
                scoringResult.poseSimilarity(),
                scoringResult.timingSimilarity(),
                scoringResult.stabilitySimilarity(),
                cues.size(),
                stableCount,
                maxCombo,
                averageConfidence,
                verdictCounts);
    }

    private void printChallengeReport(String challengeName, List<CalibrationResult> results) {
        System.out.println();
        System.out.println("[challenge] " + challengeName);
        for (CalibrationResult result : results) {
            System.out.println("  - " + result.fileName()
                    + " label=" + result.label()
                    + " score=" + result.score()
                    + " pose=" + result.poseSimilarity()
                    + " timing=" + result.timingSimilarity()
                    + " stability=" + result.stabilitySimilarity()
                    + " stable=" + result.stableCount() + "/" + result.cueCount()
                    + " maxCombo=" + result.maxCombo()
                    + " avgConf=" + String.format(Locale.US, "%.3f", result.averageConfidence())
                    + " verdicts=" + result.verdictCounts());
        }

        Map<SampleLabel, List<CalibrationResult>> grouped = results.stream()
                .collect(Collectors.groupingBy(CalibrationResult::label, () -> new EnumMap<>(SampleLabel.class), Collectors.toList()));
        for (SampleLabel label : SampleLabel.values()) {
            List<CalibrationResult> group = grouped.get(label);
            if (group == null || group.isEmpty()) {
                continue;
            }
            double averageScore = group.stream().mapToInt(CalibrationResult::score).average().orElse(0.0);
            double averageStableRatio = group.stream()
                    .mapToDouble(result -> result.cueCount() == 0 ? 0.0 : result.stableCount() / (double) result.cueCount())
                    .average()
                    .orElse(0.0);
            double averageConfidence = group.stream().mapToDouble(CalibrationResult::averageConfidence).average().orElse(0.0);
            System.out.println("    * " + label.name().toLowerCase(Locale.ROOT)
                    + " avgScore=" + String.format(Locale.US, "%.1f", averageScore)
                    + " avgStable=" + String.format(Locale.US, "%.3f", averageStableRatio)
                    + " avgConf=" + String.format(Locale.US, "%.3f", averageConfidence));
        }
    }

    private void assertUsefulOrdering(String challengeName, List<CalibrationResult> results) {
        Map<SampleLabel, List<CalibrationResult>> grouped = results.stream()
                .collect(Collectors.groupingBy(CalibrationResult::label, () -> new EnumMap<>(SampleLabel.class), Collectors.toList()));

        double goodAverageScore = averageScore(grouped.get(SampleLabel.GOOD));
        double borderlineAverageScore = averageScore(grouped.get(SampleLabel.BORDERLINE));
        double missAverageScore = averageScore(grouped.get(SampleLabel.MISS));

        if (!Double.isNaN(goodAverageScore) && !Double.isNaN(missAverageScore)) {
            assertThat(goodAverageScore)
                    .as("%s good samples should score higher than miss samples", challengeName)
                    .isGreaterThan(missAverageScore);
        }
        if (!Double.isNaN(borderlineAverageScore) && !Double.isNaN(missAverageScore)) {
            assertThat(borderlineAverageScore)
                    .as("%s borderline samples should score higher than miss samples", challengeName)
                    .isGreaterThan(missAverageScore);
        }
    }

    private double averageScore(List<CalibrationResult> results) {
        if (results == null || results.isEmpty()) {
            return Double.NaN;
        }
        return results.stream().mapToInt(CalibrationResult::score).average().orElse(Double.NaN);
    }

    private MotionAnalysisResult analyzeVideo(
            Path pythonExe,
            Path repoRoot,
            Path workingRoot,
            Path videoPath,
            String analysisPhase) throws Exception {
        Path sampleRoot = workingRoot.resolve(videoPath.getFileName().toString().replace('.', '_'));
        Path mplConfigDir = sampleRoot.resolve("mplconfig");
        Path responseFile = sampleRoot.resolve("response.json");
        Files.createDirectories(mplConfigDir);

        String script = """
                import json
                import sys
                from pathlib import Path
                from app.analysis import analyze_payload
                from app.schemas import AnalyzeRequest

                video_path = Path(sys.argv[1]).resolve()
                phase = sys.argv[2]
                response_path = Path(sys.argv[3]).resolve()
                payload = AnalyzeRequest(
                    schemaVersion='v1',
                    analysisPhase=phase,
                    sourceVideo={
                        'originalFileName': video_path.name,
                        'storagePath': str(video_path),
                        'contentType': 'video/mp4',
                        'size': video_path.stat().st_size,
                    },
                    runtime={'timeoutMillis': 35000},
                )
                response = analyze_payload(payload)
                response_path.write_text(response.model_dump_json(), encoding='utf-8')
                print(json.dumps({'status': 'ok', 'responsePath': str(response_path)}))
                """;

        ProcessBuilder processBuilder = new ProcessBuilder(
                pythonExe.toString(),
                "-c",
                script,
                videoPath.toString(),
                analysisPhase,
                responseFile.toString());
        processBuilder.directory(repoRoot.resolve("mediapipe-bridge").toFile());
        processBuilder.redirectErrorStream(true);
        processBuilder.environment().put("MPLCONFIGDIR", mplConfigDir.toString());

        Process process = processBuilder.start();
        String output;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            output = reader.lines().collect(Collectors.joining(System.lineSeparator()));
        }

        int exitCode = process.waitFor();
        assertThat(exitCode)
                .as("mediapipe analysis must succeed for %s%n%s", videoPath.getFileName(), output)
                .isEqualTo(0);
        assertThat(Files.exists(responseFile))
                .as("mediapipe response file must exist for %s%n%s", videoPath.getFileName(), output)
                .isTrue();

        MediaPipeBridgeResponse response = objectMapper.readValue(responseFile.toFile(), MediaPipeBridgeResponse.class);
        StoredVideo storedVideo = new StoredVideo(
                videoPath.getFileName().toString(),
                repoRoot.relativize(videoPath).toString().replace('\\', '/'),
                videoPath,
                "video/mp4",
                Files.size(videoPath));
        return resultMapper.map(storedVideo, analysisPhase, response);
    }

    private Path resolveSingleVideo(Path directory) throws Exception {
        List<Path> files = listVideoFiles(directory);
        assertThat(files).hasSize(1);
        return files.get(0);
    }

    private List<Path> listVideoFiles(Path directory) throws Exception {
        try (var stream = Files.list(directory)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".mp4"))
                    .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                    .toList();
        }
    }

    private SampleLabel resolveSampleLabel(String fileName) {
        String normalized = fileName.toLowerCase(Locale.ROOT);
        if (normalized.startsWith("good")) {
            return SampleLabel.GOOD;
        }
        if (normalized.startsWith("borderline")) {
            return SampleLabel.BORDERLINE;
        }
        if (normalized.startsWith("miss")) {
            return SampleLabel.MISS;
        }
        return SampleLabel.UNKNOWN;
    }

    private enum SampleLabel {
        GOOD,
        BORDERLINE,
        MISS,
        UNKNOWN
    }

    private record CalibrationResult(
            String fileName,
            SampleLabel label,
            int score,
            int poseSimilarity,
            int timingSimilarity,
            int stabilitySimilarity,
            int cueCount,
            long stableCount,
            int maxCombo,
            double averageConfidence,
            Map<String, Long> verdictCounts) {
    }
}
