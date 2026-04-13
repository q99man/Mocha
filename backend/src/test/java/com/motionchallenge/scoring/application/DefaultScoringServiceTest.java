package com.motionchallenge.scoring.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DefaultScoringServiceTest {

    private final DefaultScoringService scoringService = new DefaultScoringService(new ObjectMapper());

    @Test
    void identicalLandmarksScorePerfectEvenWhenMetadataDiffers() {
        String referenceProfileData = buildProfileJson(
                "reference.mp4",
                "uploads/reference-a.mp4",
                1280,
                12000,
                10,
                10,
                0.98,
                0.42,
                0.58,
                0.40,
                0.60,
                0.47,
                0.53,
                0.30,
                0.70);
        String attemptProfileData = buildProfileJson(
                "attempt.mp4",
                "uploads/attempt-b.mp4",
                1280,
                12000,
                10,
                10,
                0.98,
                0.42,
                0.58,
                0.40,
                0.60,
                0.47,
                0.53,
                0.30,
                0.70);

        ChallengeMotionProfile referenceProfile = new ChallengeMotionProfile(
                new Challenge("title", "desc", "cat", "medium", null, null, 10, true),
                referenceProfileData,
                1111,
                10,
                12000,
                "mediapipe-fastapi-pose-v1",
                LocalDateTime.now());
        MotionAnalysisResult attemptAnalysis = new MotionAnalysisResult(
                attemptProfileData,
                2222,
                10,
                12000,
                "mediapipe-fastapi-pose-v1");

        ScoringResult result = scoringService.calculateScore(referenceProfile, attemptAnalysis);

        assertThat(result.score()).isEqualTo(100);
        assertThat(result.poseSimilarity()).isEqualTo(100);
        assertThat(result.timingSimilarity()).isEqualTo(100);
        assertThat(result.stabilitySimilarity()).isEqualTo(100);
    }

    @Test
    void shiftedPoseLowersPoseSimilarity() {
        String referenceProfileData = buildProfileJson(
                "reference.mp4",
                "uploads/reference-a.mp4",
                1280,
                12000,
                10,
                10,
                0.98,
                0.42,
                0.58,
                0.40,
                0.60,
                0.47,
                0.53,
                0.30,
                0.70);
        String attemptProfileData = buildProfileJson(
                "attempt.mp4",
                "uploads/attempt-b.mp4",
                1280,
                12000,
                10,
                10,
                0.98,
                0.30,
                0.70,
                0.28,
                0.72,
                0.36,
                0.64,
                0.16,
                0.84);

        ChallengeMotionProfile referenceProfile = new ChallengeMotionProfile(
                new Challenge("title", "desc", "cat", "medium", null, null, 10, true),
                referenceProfileData,
                1111,
                10,
                12000,
                "mediapipe-fastapi-pose-v1",
                LocalDateTime.now());
        MotionAnalysisResult attemptAnalysis = new MotionAnalysisResult(
                attemptProfileData,
                2222,
                10,
                12000,
                "mediapipe-fastapi-pose-v1");

        ScoringResult result = scoringService.calculateScore(referenceProfile, attemptAnalysis);

        assertThat(result.poseSimilarity()).isLessThan(95);
        assertThat(result.score()).isLessThan(100);
        assertThat(result.weakestArea()).isEqualTo("pose similarity");
    }

    private String buildProfileJson(
            String originalFileName,
            String storagePath,
            int signature,
            long durationMs,
            int sampleCount,
            int framesWithPose,
            double visibility,
            double leftShoulderX,
            double rightShoulderX,
            double leftHipX,
            double rightHipX,
            double leftWristX,
            double rightWristX,
            double leftAnkleX,
            double rightAnkleX) {
        return """
                {
                  "schemaVersion": "v1",
                  "provider": "mediapipe",
                  "analyzerName": "mediapipe-fastapi-pose-v1",
                  "analysisPhase": "reference",
                  "sourceVideo": {
                    "originalFileName": "%s",
                    "storagePath": "%s",
                    "contentType": "video/mp4",
                    "size": 1024
                  },
                  "metrics": {
                    "signature": %d,
                    "sampleCount": %d,
                    "durationMs": %d
                  },
                  "landmarks": [
                    {
                      "frameIndex": 0,
                      "phase": "reference",
                      "points": [
                        {"name": "nose", "x": 0.50, "y": 0.18, "z": -0.04, "visibility": %.2f},
                        {"name": "left_shoulder", "x": %.2f, "y": 0.30, "z": -0.08, "visibility": %.2f},
                        {"name": "right_shoulder", "x": %.2f, "y": 0.30, "z": -0.08, "visibility": %.2f},
                        {"name": "left_wrist", "x": %.2f, "y": 0.42, "z": -0.12, "visibility": %.2f},
                        {"name": "right_wrist", "x": %.2f, "y": 0.42, "z": -0.12, "visibility": %.2f},
                        {"name": "left_hip", "x": %.2f, "y": 0.54, "z": -0.03, "visibility": %.2f},
                        {"name": "right_hip", "x": %.2f, "y": 0.54, "z": -0.03, "visibility": %.2f},
                        {"name": "left_ankle", "x": %.2f, "y": 0.88, "z": 0.01, "visibility": %.2f},
                        {"name": "right_ankle", "x": %.2f, "y": 0.88, "z": 0.01, "visibility": %.2f}
                      ]
                    }
                  ],
                  "notes": [],
                  "extras": {
                    "processedFrames": %d,
                    "framesWithPose": %d
                  }
                }
                """.formatted(
                originalFileName,
                storagePath,
                signature,
                sampleCount,
                durationMs,
                visibility,
                leftShoulderX,
                visibility,
                rightShoulderX,
                visibility,
                leftWristX,
                visibility,
                rightWristX,
                visibility,
                leftHipX,
                visibility,
                rightHipX,
                visibility,
                leftAnkleX,
                visibility,
                rightAnkleX,
                visibility,
                sampleCount,
                framesWithPose);
    }
}
