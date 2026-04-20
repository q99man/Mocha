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

        assertThat(result.poseSimilarity()).isLessThan(100);
        assertThat(result.score()).isLessThan(100);
        assertThat(result.weakestArea()).isEqualTo("pose shape");
    }

    @Test
    void poorPoseCapsTimingAndStabilityEvenWhenMetadataLooksSimilar() {
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
                0.18,
                0.82,
                0.12,
                0.88,
                0.08,
                0.92,
                0.05,
                0.95);

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
        assertThat(result.weakestArea()).isEqualTo("pose shape");
    }

    @Test
    void analysisSummarySignalsLowerTimingWhenRhythmProfileDiffers() {
        String referenceProfileData = """
                {
                  "schemaVersion": "v1",
                  "provider": "mediapipe",
                  "analyzerName": "mediapipe-fastapi-pose-v1",
                  "analysisPhase": "reference",
                  "sourceVideo": {
                    "originalFileName": "reference.mp4",
                    "storagePath": "uploads/reference-a.mp4",
                    "contentType": "video/mp4",
                    "size": 1024
                  },
                  "metrics": {
                    "signature": 1280,
                    "sampleCount": 12,
                    "durationMs": 12000
                  },
                  "landmarks": [
                    {
                      "frameIndex": 0,
                      "phase": "reference",
                      "points": [
                        {"name": "nose", "x": 0.50, "y": 0.18, "z": -0.04, "visibility": 0.98},
                        {"name": "left_shoulder", "x": 0.42, "y": 0.30, "z": -0.08, "visibility": 0.98},
                        {"name": "right_shoulder", "x": 0.58, "y": 0.30, "z": -0.08, "visibility": 0.98},
                        {"name": "left_wrist", "x": 0.47, "y": 0.42, "z": -0.12, "visibility": 0.98},
                        {"name": "right_wrist", "x": 0.53, "y": 0.42, "z": -0.12, "visibility": 0.98},
                        {"name": "left_hip", "x": 0.40, "y": 0.54, "z": -0.03, "visibility": 0.98},
                        {"name": "right_hip", "x": 0.60, "y": 0.54, "z": -0.03, "visibility": 0.98},
                        {"name": "left_ankle", "x": 0.30, "y": 0.88, "z": 0.01, "visibility": 0.98},
                        {"name": "right_ankle", "x": 0.70, "y": 0.88, "z": 0.01, "visibility": 0.98}
                      ]
                    }
                  ],
                  "notes": [],
                  "extras": {
                    "processedFrames": 12,
                    "framesWithPose": 12,
                    "analysisSummary": {
                      "quality": {
                        "detectionCoverage": 1.0,
                        "averageVisibility": 0.98,
                        "visibilitySpread": 0.02,
                        "torsoScaleStdDev": 0.04,
                        "centerLineOffsetMean": 0.06,
                        "centerDriftMean": 0.08,
                        "centerDriftPeak": 0.12
                      },
                      "rhythm": {
                        "motionEnergyMean": 0.32,
                        "motionEnergyStdDev": 0.11,
                        "motionEnergyPeak": 0.54,
                        "motionBurstCount": 2
                      },
                      "symmetry": {
                        "upperBodyMean": 0.96,
                        "lowerBodyMean": 0.95,
                        "fullBodyMean": 0.955
                      },
                      "kinematics": {
                        "jointRangeMean": 0.38,
                        "jointRangePeak": 0.52,
                        "jointStabilityMean": 0.90,
                        "joints": {
                          "leftElbow": {"mean": 0.58, "range": 0.36, "stdDev": 0.09},
                          "rightElbow": {"mean": 0.57, "range": 0.35, "stdDev": 0.10},
                          "leftKnee": {"mean": 0.61, "range": 0.30, "stdDev": 0.08},
                          "rightKnee": {"mean": 0.60, "range": 0.31, "stdDev": 0.08}
                        }
                      }
                    }
                  }
                }
                """;
        String attemptProfileData = """
                {
                  "schemaVersion": "v1",
                  "provider": "mediapipe",
                  "analyzerName": "mediapipe-fastapi-pose-v1",
                  "analysisPhase": "attempt",
                  "sourceVideo": {
                    "originalFileName": "attempt.mp4",
                    "storagePath": "uploads/attempt-b.mp4",
                    "contentType": "video/mp4",
                    "size": 1024
                  },
                  "metrics": {
                    "signature": 1281,
                    "sampleCount": 12,
                    "durationMs": 12000
                  },
                  "landmarks": [
                    {
                      "frameIndex": 0,
                      "phase": "attempt",
                      "points": [
                        {"name": "nose", "x": 0.50, "y": 0.18, "z": -0.04, "visibility": 0.98},
                        {"name": "left_shoulder", "x": 0.42, "y": 0.30, "z": -0.08, "visibility": 0.98},
                        {"name": "right_shoulder", "x": 0.58, "y": 0.30, "z": -0.08, "visibility": 0.98},
                        {"name": "left_wrist", "x": 0.47, "y": 0.42, "z": -0.12, "visibility": 0.98},
                        {"name": "right_wrist", "x": 0.53, "y": 0.42, "z": -0.12, "visibility": 0.98},
                        {"name": "left_hip", "x": 0.40, "y": 0.54, "z": -0.03, "visibility": 0.98},
                        {"name": "right_hip", "x": 0.60, "y": 0.54, "z": -0.03, "visibility": 0.98},
                        {"name": "left_ankle", "x": 0.30, "y": 0.88, "z": 0.01, "visibility": 0.98},
                        {"name": "right_ankle", "x": 0.70, "y": 0.88, "z": 0.01, "visibility": 0.98}
                      ]
                    }
                  ],
                  "notes": [],
                  "extras": {
                    "processedFrames": 12,
                    "framesWithPose": 12,
                    "analysisSummary": {
                      "quality": {
                        "detectionCoverage": 1.0,
                        "averageVisibility": 0.98,
                        "visibilitySpread": 0.02,
                        "torsoScaleStdDev": 0.04,
                        "centerLineOffsetMean": 0.06,
                        "centerDriftMean": 0.08,
                        "centerDriftPeak": 0.12
                      },
                      "rhythm": {
                        "motionEnergyMean": 1.78,
                        "motionEnergyStdDev": 0.86,
                        "motionEnergyPeak": 2.35,
                        "motionBurstCount": 7
                      },
                      "symmetry": {
                        "upperBodyMean": 0.96,
                        "lowerBodyMean": 0.95,
                        "fullBodyMean": 0.955
                      },
                      "kinematics": {
                        "jointRangeMean": 0.38,
                        "jointRangePeak": 0.52,
                        "jointStabilityMean": 0.90,
                        "joints": {
                          "leftElbow": {"mean": 0.58, "range": 0.36, "stdDev": 0.09},
                          "rightElbow": {"mean": 0.57, "range": 0.35, "stdDev": 0.10},
                          "leftKnee": {"mean": 0.61, "range": 0.30, "stdDev": 0.08},
                          "rightKnee": {"mean": 0.60, "range": 0.31, "stdDev": 0.08}
                        }
                      }
                    }
                  }
                }
                """;

        ChallengeMotionProfile referenceProfile = new ChallengeMotionProfile(
                new Challenge("title", "desc", "cat", "medium", null, null, 10, true),
                referenceProfileData,
                1111,
                12,
                12000,
                "mediapipe-fastapi-pose-v1",
                LocalDateTime.now());
        MotionAnalysisResult attemptAnalysis = new MotionAnalysisResult(
                attemptProfileData,
                2222,
                12,
                12000,
                "mediapipe-fastapi-pose-v1");

        ScoringResult result = scoringService.calculateScore(referenceProfile, attemptAnalysis);

        assertThat(result.timingSimilarity()).isLessThan(100);
        assertThat(result.weakestArea()).isEqualTo("pose timing");
        assertThat(result.summary()).contains("타이밍");
    }

    @Test
    void lowConfidenceOutlierFrameDoesNotOverPenalizePoseAndTiming() {
        String referenceProfileData = buildSequenceProfileJson(
                "reference",
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.45, 0.55, 0.32, 0.68),
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.48, 0.52, 0.31, 0.69),
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.45, 0.55, 0.32, 0.68));
        String attemptProfileData = buildSequenceProfileJson(
                "attempt",
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.45, 0.55, 0.32, 0.68),
                new FramePose(0.08, 0.18, 0.82, 0.14, 0.86, 0.12, 0.88, 0.08, 0.92),
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.45, 0.55, 0.32, 0.68));

        ChallengeMotionProfile referenceProfile = new ChallengeMotionProfile(
                new Challenge("title", "desc", "cat", "medium", null, null, 10, true),
                referenceProfileData,
                1111,
                3,
                12000,
                "mediapipe-fastapi-pose-v1",
                LocalDateTime.now());
        MotionAnalysisResult attemptAnalysis = new MotionAnalysisResult(
                attemptProfileData,
                2222,
                3,
                12000,
                "mediapipe-fastapi-pose-v1");

        ScoringResult result = scoringService.calculateScore(referenceProfile, attemptAnalysis);

        assertThat(result.poseSimilarity()).isGreaterThanOrEqualTo(90);
        assertThat(result.timingSimilarity()).isGreaterThanOrEqualTo(85);
        assertThat(result.stabilitySimilarity()).isLessThan(result.poseSimilarity());
        assertThat(result.weakestArea()).isEqualTo("detection quality");
    }

    @Test
    void legFocusedReferencePenalizesLegMismatchMoreThanArmFocusedReference() {
        String armFocusedReferenceProfileData = buildSequenceProfileJson(
                "reference",
                buildFocusProfileJson("arm"),
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.45, 0.55, 0.32, 0.68),
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.48, 0.52, 0.31, 0.69),
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.45, 0.55, 0.32, 0.68));
        String legFocusedReferenceProfileData = buildSequenceProfileJson(
                "reference",
                buildFocusProfileJson("leg"),
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.45, 0.55, 0.32, 0.68),
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.48, 0.52, 0.31, 0.69),
                new FramePose(0.98, 0.42, 0.58, 0.40, 0.60, 0.45, 0.55, 0.32, 0.68));
        String legMismatchProfileData = buildSequenceProfileJson(
                "attempt",
                new FramePose(0.98, 0.42, 0.58, 0.30, 0.60, 0.45, 0.55, 0.10, 0.68),
                new FramePose(0.98, 0.42, 0.58, 0.32, 0.60, 0.48, 0.52, 0.12, 0.69),
                new FramePose(0.98, 0.42, 0.58, 0.30, 0.60, 0.45, 0.55, 0.10, 0.68));

        ChallengeMotionProfile armFocusedReferenceProfile = new ChallengeMotionProfile(
                new Challenge("title", "desc", "cat", "medium", null, null, 10, true),
                armFocusedReferenceProfileData,
                1111,
                3,
                12000,
                "mediapipe-fastapi-pose-v1",
                LocalDateTime.now());
        ChallengeMotionProfile legFocusedReferenceProfile = new ChallengeMotionProfile(
                new Challenge("title", "desc", "cat", "medium", null, null, 10, true),
                legFocusedReferenceProfileData,
                1112,
                3,
                12000,
                "mediapipe-fastapi-pose-v1",
                LocalDateTime.now());

        ScoringResult armFocusedResult = scoringService.calculateScore(armFocusedReferenceProfile, new MotionAnalysisResult(
                legMismatchProfileData,
                2222,
                3,
                12000,
                "mediapipe-fastapi-pose-v1"));
        ScoringResult legFocusedResult = scoringService.calculateScore(legFocusedReferenceProfile, new MotionAnalysisResult(
                legMismatchProfileData,
                3333,
                3,
                12000,
                "mediapipe-fastapi-pose-v1"));

        assertThat(legFocusedResult.poseSimilarity()).isLessThan(armFocusedResult.poseSimilarity());
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

    private String buildSequenceProfileJson(String phase, FramePose... frames) {
        return buildSequenceProfileJson(phase, null, frames);
    }

    private String buildSequenceProfileJson(String phase, String focusProfileJson, FramePose... frames) {
        StringBuilder landmarkFrames = new StringBuilder();
        for (int index = 0; index < frames.length; index++) {
            if (index > 0) {
                landmarkFrames.append(",\n");
            }
            landmarkFrames.append(buildFrameJson(index, phase, frames[index]));
        }
        String focusProfileBlock = focusProfileJson == null || focusProfileJson.isBlank()
                ? ""
                : ",\n                      \"focusProfile\": " + focusProfileJson;

        return """
                {
                  "schemaVersion": "v1",
                  "provider": "mediapipe",
                  "analyzerName": "mediapipe-fastapi-pose-v1",
                  "analysisPhase": "%s",
                  "sourceVideo": {
                    "originalFileName": "%s.mp4",
                    "storagePath": "uploads/%s.mp4",
                    "contentType": "video/mp4",
                    "size": 1024
                  },
                  "metrics": {
                    "signature": 1280,
                    "sampleCount": %d,
                    "durationMs": 12000
                  },
                  "landmarks": [
                %s
                  ],
                  "notes": [],
                  "extras": {
                    "processedFrames": %d,
                    "framesWithPose": %d,
                    "analysisSummary": {
                      "quality": {
                        "detectionCoverage": 1.0,
                        "averageVisibility": %.4f,
                        "visibilitySpread": %.4f,
                        "torsoScaleStdDev": 0.04,
                        "centerLineOffsetMean": 0.06,
                        "centerDriftMean": 0.08,
                        "centerDriftPeak": 0.12
                      },
                      "rhythm": {
                        "motionEnergyMean": 0.40,
                        "motionEnergyStdDev": 0.14,
                        "motionEnergyPeak": 0.62,
                        "motionBurstCount": 2
                      },
                      "symmetry": {
                        "upperBodyMean": 0.93,
                        "lowerBodyMean": 0.92,
                        "fullBodyMean": 0.925
                      },
                      "kinematics": {
                        "jointRangeMean": 0.36,
                        "jointRangePeak": 0.50,
                        "jointStabilityMean": 0.88,
                        "joints": {
                          "leftElbow": {"mean": 0.58, "range": 0.36, "stdDev": 0.09},
                          "rightElbow": {"mean": 0.57, "range": 0.35, "stdDev": 0.10},
                          "leftKnee": {"mean": 0.61, "range": 0.30, "stdDev": 0.08},
                          "rightKnee": {"mean": 0.60, "range": 0.31, "stdDev": 0.08}
                        }
                      }%s
                    }
                  }
                }
                """.formatted(
                phase,
                phase,
                phase,
                frames.length,
                landmarkFrames,
                frames.length,
                frames.length,
                averageVisibility(frames),
                visibilitySpread(frames),
                focusProfileBlock);
    }

    private String buildFocusProfileJson(String dominantRegion) {
        if ("leg".equals(dominantRegion)) {
            return """
                    {
                      "version": "v1",
                      "primaryJoints": [
                        {"name": "leftKnee", "weight": 1.0},
                        {"name": "rightKnee", "weight": 1.0},
                        {"name": "leftAnkle", "weight": 0.95},
                        {"name": "rightAnkle", "weight": 0.95}
                      ],
                      "segments": [
                        {
                          "key": "impact",
                          "label": "impact leg focus",
                          "startRatio": 0.0,
                          "endRatio": 1.0,
                          "poseWeight": 1.0,
                          "timingWeight": 0.7,
                          "dominantRegion": "leg",
                          "jointWeights": {
                            "leftKnee": 1.0,
                            "rightKnee": 1.0,
                            "leftAnkle": 0.95,
                            "rightAnkle": 0.95
                          }
                        }
                      ]
                    }
                    """;
        }

        return """
                {
                  "version": "v1",
                  "primaryJoints": [
                    {"name": "leftElbow", "weight": 1.0},
                    {"name": "rightElbow", "weight": 1.0},
                    {"name": "leftWrist", "weight": 0.95},
                    {"name": "rightWrist", "weight": 0.95}
                  ],
                  "segments": [
                    {
                      "key": "impact",
                      "label": "impact arm focus",
                      "startRatio": 0.0,
                      "endRatio": 1.0,
                      "poseWeight": 1.0,
                      "timingWeight": 0.7,
                      "dominantRegion": "arm",
                      "jointWeights": {
                        "leftElbow": 1.0,
                        "rightElbow": 1.0,
                        "leftWrist": 0.95,
                        "rightWrist": 0.95
                      }
                    }
                  ]
                }
                """;
    }

    private String buildFrameJson(int frameIndex, String phase, FramePose framePose) {
        double visibility = framePose.visibility();
        return """
                    {
                      "frameIndex": %d,
                      "phase": "%s",
                      "points": [
                        {"name": "nose", "x": 0.50, "y": 0.18, "z": -0.04, "visibility": %.2f},
                        {"name": "left_shoulder", "x": %.2f, "y": 0.30, "z": -0.08, "visibility": %.2f},
                        {"name": "right_shoulder", "x": %.2f, "y": 0.30, "z": -0.08, "visibility": %.2f},
                        {"name": "left_elbow", "x": %.2f, "y": 0.36, "z": -0.10, "visibility": %.2f},
                        {"name": "right_elbow", "x": %.2f, "y": 0.36, "z": -0.10, "visibility": %.2f},
                        {"name": "left_wrist", "x": %.2f, "y": 0.42, "z": -0.12, "visibility": %.2f},
                        {"name": "right_wrist", "x": %.2f, "y": 0.42, "z": -0.12, "visibility": %.2f},
                        {"name": "left_hip", "x": %.2f, "y": 0.54, "z": -0.03, "visibility": %.2f},
                        {"name": "right_hip", "x": %.2f, "y": 0.54, "z": -0.03, "visibility": %.2f},
                        {"name": "left_knee", "x": %.2f, "y": 0.72, "z": 0.00, "visibility": %.2f},
                        {"name": "right_knee", "x": %.2f, "y": 0.72, "z": 0.00, "visibility": %.2f},
                        {"name": "left_ankle", "x": %.2f, "y": 0.88, "z": 0.01, "visibility": %.2f},
                        {"name": "right_ankle", "x": %.2f, "y": 0.88, "z": 0.01, "visibility": %.2f}
                      ]
                    }""".formatted(
                frameIndex,
                phase,
                visibility,
                framePose.leftShoulderX(),
                visibility,
                framePose.rightShoulderX(),
                visibility,
                framePose.leftShoulderX() + 0.02,
                visibility,
                framePose.rightShoulderX() - 0.02,
                visibility,
                framePose.leftWristX(),
                visibility,
                framePose.rightWristX(),
                visibility,
                framePose.leftHipX(),
                visibility,
                framePose.rightHipX(),
                visibility,
                framePose.leftHipX() + 0.01,
                visibility,
                framePose.rightHipX() - 0.01,
                visibility,
                framePose.leftAnkleX(),
                visibility,
                framePose.rightAnkleX(),
                visibility);
    }

    private double averageVisibility(FramePose[] frames) {
        double total = 0.0;
        for (FramePose frame : frames) {
            total += frame.visibility();
        }
        return frames.length == 0 ? 0.0 : total / frames.length;
    }

    private double visibilitySpread(FramePose[] frames) {
        if (frames.length < 2) {
            return 0.0;
        }
        double average = averageVisibility(frames);
        double squaredTotal = 0.0;
        for (FramePose frame : frames) {
            double delta = frame.visibility() - average;
            squaredTotal += delta * delta;
        }
        return Math.sqrt(squaredTotal / frames.length);
    }

    private record FramePose(
            double visibility,
            double leftShoulderX,
            double rightShoulderX,
            double leftHipX,
            double rightHipX,
            double leftWristX,
            double rightWristX,
            double leftAnkleX,
            double rightAnkleX) {
    }
}
