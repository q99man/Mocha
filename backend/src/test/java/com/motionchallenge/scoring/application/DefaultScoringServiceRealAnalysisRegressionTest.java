package com.motionchallenge.scoring.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DefaultScoringServiceRealAnalysisRegressionTest {

    private final DefaultScoringService scoringService = new DefaultScoringService(new ObjectMapper());

    @Test
    void realAnalysisPayloadsDoNotCollapseToPerfectScoreForDifferentVideos() throws Exception {
        String referenceProfileData = Files.readString(Path.of("src", "test", "resources", "fixtures", "scoring", "reference-analysis.json"));
        String attemptProfileData = Files.readString(Path.of("src", "test", "resources", "fixtures", "scoring", "attempt-analysis-different.json"));

        ChallengeMotionProfile referenceProfile = new ChallengeMotionProfile(
                new Challenge("title", "desc", "cat", "medium", null, null, 10, true),
                referenceProfileData,
                1111,
                23,
                18810,
                "mediapipe-fastapi-pose-v1",
                LocalDateTime.now());
        MotionAnalysisResult attemptAnalysis = new MotionAnalysisResult(
                attemptProfileData,
                2222,
                20,
                13875,
                "mediapipe-fastapi-pose-v1");

        ScoringResult result = scoringService.calculateScore(referenceProfile, attemptAnalysis);

        assertThat(result.score()).isLessThan(100);
        assertThat(result.poseSimilarity()).isLessThan(100);
    }
}
