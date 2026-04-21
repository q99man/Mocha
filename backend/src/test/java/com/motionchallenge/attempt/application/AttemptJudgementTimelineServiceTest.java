package com.motionchallenge.attempt.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AttemptJudgementTimelineServiceTest {

    private final AttemptJudgementTimelineService service =
            new AttemptJudgementTimelineService(new ObjectMapper());

    @Test
    void buildTimelineReturnsMotionAnalysisCuesAndSupportsRoundTrip() {
        String referenceProfile = buildProfileJson("reference", 12_000, 0, 0.42, 0.58, 0.46, 0.54);
        String attemptProfile = buildProfileJson("attempt", 12_600, 28, 0.42, 0.58, 0.46, 0.54);

        List<AttemptJudgementCueResponse> cues = service.buildTimeline(referenceProfile, attemptProfile);

        assertThat(cues).isNotEmpty();
        assertThat(cues).hasSizeGreaterThanOrEqualTo(6);
        assertThat(cues).allSatisfy(cue -> {
            assertThat(cue.source()).isEqualTo("motion-analysis");
            assertThat(cue.verdict()).isIn("PERFECT", "GOOD", "HOLD", "EARLY", "LATE", "MISS");
            assertThat(cue.confidence()).isBetween(0.0, 1.0);
        });

        String serialized = service.serializeTimeline(cues);
        assertThat(service.readTimeline(serialized)).hasSize(cues.size());
    }

    @Test
    void readTimelineReturnsEmptyListWhenValueIsMissing() {
        assertThat(service.readTimeline(null)).isEmpty();
        assertThat(service.readTimeline("")).isEmpty();
        assertThat(service.readTimeline("not-json")).isEmpty();
    }

    @Test
    void focusProfileMakesArmMismatchJudgementStricterThanLegFocus() {
        String armFocusedReference = buildProfileJson(
                "reference",
                12_000,
                0,
                0.42,
                0.58,
                0.46,
                0.54,
                buildFocusProfileJson("arm"));
        String legFocusedReference = buildProfileJson(
                "reference",
                12_000,
                0,
                0.42,
                0.58,
                0.46,
                0.54,
                buildFocusProfileJson("leg"));
        String armMismatchAttempt = buildProfileJson(
                "attempt",
                12_000,
                0,
                0.42,
                0.58,
                0.20,
                0.80,
                null);

        List<AttemptJudgementCueResponse> armFocusedCues = service.buildTimeline(armFocusedReference, armMismatchAttempt);
        List<AttemptJudgementCueResponse> legFocusedCues = service.buildTimeline(legFocusedReference, armMismatchAttempt);

        double armFocusedAverageConfidence = armFocusedCues.stream()
                .mapToDouble(AttemptJudgementCueResponse::confidence)
                .average()
                .orElse(0.0);
        double legFocusedAverageConfidence = legFocusedCues.stream()
                .mapToDouble(AttemptJudgementCueResponse::confidence)
                .average()
                .orElse(0.0);
        long armLaneCount = armFocusedCues.stream()
                .filter(cue -> cue.lane() == 1 || cue.lane() == 4)
                .count();
        long legLaneCount = legFocusedCues.stream()
                .filter(cue -> cue.lane() == 0 || cue.lane() == 5)
                .count();

        assertThat(armFocusedAverageConfidence).isLessThan(legFocusedAverageConfidence);
        assertThat(armLaneCount).isGreaterThan(0);
        assertThat(legLaneCount).isGreaterThan(0);
    }

    @Test
    void impactTimingFocusTreatsSameOffsetMoreStrictlyThanRelaxedTimingFocus() {
        String strictTimingReference = buildProfileJson(
                "reference",
                12_000,
                0,
                0.42,
                0.58,
                0.46,
                0.54,
                buildFocusProfileJson("arm", 1.0, 1.0));
        String relaxedTimingReference = buildProfileJson(
                "reference",
                12_000,
                0,
                0.42,
                0.58,
                0.46,
                0.54,
                buildFocusProfileJson("arm", 1.0, 0.1));
        String lateAttempt = buildProfileJson(
                "attempt",
                12_000,
                48,
                0.42,
                0.58,
                0.46,
                0.54,
                null);

        List<AttemptJudgementCueResponse> strictCues = service.buildTimeline(strictTimingReference, lateAttempt);
        List<AttemptJudgementCueResponse> relaxedCues = service.buildTimeline(relaxedTimingReference, lateAttempt);

        long strictEarlyLateCount = strictCues.stream()
                .filter(cue -> cue.verdict().equals("EARLY") || cue.verdict().equals("LATE"))
                .count();
        long relaxedGoodCount = relaxedCues.stream()
                .filter(cue -> cue.verdict().equals("GOOD") || cue.verdict().equals("PERFECT") || cue.verdict().equals("HOLD"))
                .count();

        assertThat(strictEarlyLateCount).isGreaterThan(0);
        assertThat(relaxedGoodCount).isGreaterThan(0);
    }

    @Test
    void cueAnchorsClusterAroundImpactMotionInsteadOfStayingUniform() {
        String focusedReference = buildExtendedProfileJson("reference", 20, buildPhasedFocusProfileJson());
        List<AttemptJudgementCueResponse> cues = service.buildTimeline(focusedReference, focusedReference);

        long impactCueCount = cues.stream()
                .filter(cue -> cue.triggerMs() >= 3_500 && cue.triggerMs() <= 6_500)
                .count();

        assertThat(cues).hasSize(14);
        assertThat(impactCueCount).isGreaterThanOrEqualTo(5);
    }

    @Test
    void stableAttemptKeepsComboWhilePerfectsStaySelective() {
        String focusedReference = buildExtendedProfileJson("reference", 20, buildPhasedFocusProfileJson());
        List<AttemptJudgementCueResponse> cues = service.buildTimeline(focusedReference, focusedReference);

        long perfectCount = cues.stream().filter(cue -> cue.verdict().equals("PERFECT")).count();
        long missCount = cues.stream().filter(cue -> cue.verdict().equals("MISS")).count();
        int maxCombo = cues.stream().mapToInt(AttemptJudgementCueResponse::combo).max().orElse(0);

        assertThat(missCount).isZero();
        assertThat(perfectCount).isGreaterThan(0);
        assertThat(perfectCount).isLessThan(cues.size());
        assertThat(maxCombo).isEqualTo(cues.size());
    }

    private String buildProfileJson(
            String phase,
            long durationMs,
            int attemptOffsetMs,
            double leftShoulderX,
            double rightShoulderX,
            double leftWristX,
            double rightWristX) {
        return buildProfileJson(
                phase,
                durationMs,
                attemptOffsetMs,
                leftShoulderX,
                rightShoulderX,
                leftWristX,
                rightWristX,
                null);
    }

    private String buildProfileJson(
            String phase,
            long durationMs,
            int attemptOffsetMs,
            double leftShoulderX,
            double rightShoulderX,
            double leftWristX,
            double rightWristX,
            String focusProfileJson) {
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
                    "signature": 1111,
                    "sampleCount": 3,
                    "durationMs": %d
                  },
                  "landmarks": [
                    {
                      "frameIndex": 0,
                      "timestampMs": 0,
                      "phase": "%s",
                      "points": [
                        {"name": "nose", "x": 0.50, "y": 0.16, "z": -0.04, "visibility": 0.98},
                        {"name": "left_shoulder", "x": %.2f, "y": 0.30, "z": -0.08, "visibility": 0.98},
                        {"name": "right_shoulder", "x": %.2f, "y": 0.30, "z": -0.08, "visibility": 0.98},
                        {"name": "left_elbow", "x": 0.40, "y": 0.38, "z": -0.10, "visibility": 0.98},
                        {"name": "right_elbow", "x": 0.60, "y": 0.38, "z": -0.10, "visibility": 0.98},
                        {"name": "left_wrist", "x": %.2f, "y": 0.44, "z": -0.12, "visibility": 0.98},
                        {"name": "right_wrist", "x": %.2f, "y": 0.44, "z": -0.12, "visibility": 0.98},
                        {"name": "left_hip", "x": 0.40, "y": 0.56, "z": -0.03, "visibility": 0.98},
                        {"name": "right_hip", "x": 0.60, "y": 0.56, "z": -0.03, "visibility": 0.98},
                        {"name": "left_knee", "x": 0.38, "y": 0.72, "z": 0.01, "visibility": 0.98},
                        {"name": "right_knee", "x": 0.62, "y": 0.72, "z": 0.01, "visibility": 0.98},
                        {"name": "left_ankle", "x": 0.34, "y": 0.90, "z": 0.02, "visibility": 0.98},
                        {"name": "right_ankle", "x": 0.66, "y": 0.90, "z": 0.02, "visibility": 0.98}
                      ]
                    },
                    {
                      "frameIndex": 1,
                      "timestampMs": %d,
                      "phase": "%s",
                      "points": [
                        {"name": "nose", "x": 0.50, "y": 0.16, "z": -0.04, "visibility": 0.98},
                        {"name": "left_shoulder", "x": %.2f, "y": 0.29, "z": -0.08, "visibility": 0.98},
                        {"name": "right_shoulder", "x": %.2f, "y": 0.29, "z": -0.08, "visibility": 0.98},
                        {"name": "left_elbow", "x": 0.36, "y": 0.36, "z": -0.10, "visibility": 0.98},
                        {"name": "right_elbow", "x": 0.64, "y": 0.36, "z": -0.10, "visibility": 0.98},
                        {"name": "left_wrist", "x": %.2f, "y": 0.34, "z": -0.14, "visibility": 0.98},
                        {"name": "right_wrist", "x": %.2f, "y": 0.34, "z": -0.14, "visibility": 0.98},
                        {"name": "left_hip", "x": 0.41, "y": 0.56, "z": -0.03, "visibility": 0.98},
                        {"name": "right_hip", "x": 0.59, "y": 0.56, "z": -0.03, "visibility": 0.98},
                        {"name": "left_knee", "x": 0.39, "y": 0.72, "z": 0.01, "visibility": 0.98},
                        {"name": "right_knee", "x": 0.61, "y": 0.72, "z": 0.01, "visibility": 0.98},
                        {"name": "left_ankle", "x": 0.35, "y": 0.90, "z": 0.02, "visibility": 0.98},
                        {"name": "right_ankle", "x": 0.65, "y": 0.90, "z": 0.02, "visibility": 0.98}
                      ]
                    },
                    {
                      "frameIndex": 2,
                      "timestampMs": %d,
                      "phase": "%s",
                      "points": [
                        {"name": "nose", "x": 0.50, "y": 0.16, "z": -0.04, "visibility": 0.98},
                        {"name": "left_shoulder", "x": %.2f, "y": 0.30, "z": -0.08, "visibility": 0.98},
                        {"name": "right_shoulder", "x": %.2f, "y": 0.30, "z": -0.08, "visibility": 0.98},
                        {"name": "left_elbow", "x": 0.42, "y": 0.39, "z": -0.10, "visibility": 0.98},
                        {"name": "right_elbow", "x": 0.58, "y": 0.39, "z": -0.10, "visibility": 0.98},
                        {"name": "left_wrist", "x": %.2f, "y": 0.46, "z": -0.12, "visibility": 0.98},
                        {"name": "right_wrist", "x": %.2f, "y": 0.46, "z": -0.12, "visibility": 0.98},
                        {"name": "left_hip", "x": 0.40, "y": 0.56, "z": -0.03, "visibility": 0.98},
                        {"name": "right_hip", "x": 0.60, "y": 0.56, "z": -0.03, "visibility": 0.98},
                        {"name": "left_knee", "x": 0.38, "y": 0.72, "z": 0.01, "visibility": 0.98},
                        {"name": "right_knee", "x": 0.62, "y": 0.72, "z": 0.01, "visibility": 0.98},
                        {"name": "left_ankle", "x": 0.34, "y": 0.90, "z": 0.02, "visibility": 0.98},
                        {"name": "right_ankle", "x": 0.66, "y": 0.90, "z": 0.02, "visibility": 0.98}
                      ]
                    }
                  ],
                  "notes": [],
                  "extras": {
                    "processedFrames": 3,
                    "framesWithPose": 3,
                    "analysisSummary": {
                      "quality": {
                        "detectionCoverage": 1.0,
                        "averageVisibility": 0.98
                      },
                      "rhythm": {
                        "motionEnergyMean": 0.36,
                        "motionEnergyStdDev": 0.12,
                        "motionEnergyPeak": 0.48,
                        "motionBurstCount": 2
                      },
                      "symmetry": {
                        "upperBodyMean": 0.95,
                        "lowerBodyMean": 0.94,
                        "fullBodyMean": 0.945
                      },
                      "kinematics": {
                        "jointRangeMean": 0.34,
                        "jointRangePeak": 0.48,
                        "jointStabilityMean": 0.91,
                        "joints": {}
                      }%s
                    }
                  }
                }
                """.formatted(
                phase,
                phase,
                phase,
                durationMs,
                phase,
                leftShoulderX,
                rightShoulderX,
                leftWristX,
                rightWristX,
                (durationMs / 2) + attemptOffsetMs,
                phase,
                leftShoulderX - 0.02,
                rightShoulderX + 0.02,
                leftWristX - 0.10,
                rightWristX + 0.10,
                durationMs + attemptOffsetMs,
                phase,
                leftShoulderX,
                rightShoulderX,
                leftWristX,
                rightWristX,
                focusProfileBlock);
    }

    private String buildFocusProfileJson(String dominantRegion) {
        return buildFocusProfileJson(dominantRegion, 1.0, 0.8);
    }

    private String buildFocusProfileJson(String dominantRegion, double poseWeight, double timingWeight) {
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
                          "startRatio": 0.0,
                          "endRatio": 1.0,
                          "poseWeight": %.2f,
                          "timingWeight": %.2f,
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
                    """.formatted(poseWeight, timingWeight);
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
                      "startRatio": 0.0,
                      "endRatio": 1.0,
                      "poseWeight": %.2f,
                      "timingWeight": %.2f,
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
                """.formatted(poseWeight, timingWeight);
    }

    private String buildPhasedFocusProfileJson() {
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
                      "key": "opening",
                      "startRatio": 0.0,
                      "endRatio": 0.35,
                      "poseWeight": 0.45,
                      "timingWeight": 0.35,
                      "dominantRegion": "arm",
                      "jointWeights": {
                        "leftElbow": 0.55,
                        "rightElbow": 0.55
                      }
                    },
                    {
                      "key": "impact",
                      "startRatio": 0.35,
                      "endRatio": 0.65,
                      "poseWeight": 1.0,
                      "timingWeight": 1.0,
                      "dominantRegion": "arm",
                      "jointWeights": {
                        "leftElbow": 1.0,
                        "rightElbow": 1.0,
                        "leftWrist": 0.95,
                        "rightWrist": 0.95
                      }
                    },
                    {
                      "key": "finish",
                      "startRatio": 0.65,
                      "endRatio": 1.0,
                      "poseWeight": 0.40,
                      "timingWeight": 0.30,
                      "dominantRegion": "body",
                      "jointWeights": {
                        "leftHip": 0.35,
                        "rightHip": 0.35
                      }
                    }
                  ]
                }
                """;
    }

    private String buildExtendedProfileJson(String phase, int frameCount, String focusProfileJson) {
        StringBuilder landmarkFrames = new StringBuilder();
        int durationMs = 9_500;
        for (int index = 0; index < frameCount; index++) {
            if (index > 0) {
                landmarkFrames.append(",\n");
            }
            double progress = frameCount <= 1 ? 0.0 : index / (double) (frameCount - 1);
            double impactBoost = progress >= 0.35 && progress <= 0.65
                    ? Math.sin(((progress - 0.35) / 0.30) * Math.PI)
                    : 0.0;
            double leftWristX = 0.46 - (impactBoost * 0.19);
            double rightWristX = 0.54 + (impactBoost * 0.19);
            double leftElbowX = 0.40 - (impactBoost * 0.08);
            double rightElbowX = 0.60 + (impactBoost * 0.08);
            int timestampMs = (int) Math.round(progress * durationMs);

            landmarkFrames.append("""
                    {
                      "frameIndex": %d,
                      "timestampMs": %d,
                      "phase": "%s",
                      "points": [
                        {"name": "nose", "x": 0.50, "y": 0.16, "z": -0.04, "visibility": 0.98},
                        {"name": "left_shoulder", "x": 0.42, "y": 0.30, "z": -0.08, "visibility": 0.98},
                        {"name": "right_shoulder", "x": 0.58, "y": 0.30, "z": -0.08, "visibility": 0.98},
                        {"name": "left_elbow", "x": %.4f, "y": 0.36, "z": -0.10, "visibility": 0.98},
                        {"name": "right_elbow", "x": %.4f, "y": 0.36, "z": -0.10, "visibility": 0.98},
                        {"name": "left_wrist", "x": %.4f, "y": 0.40, "z": -0.12, "visibility": 0.98},
                        {"name": "right_wrist", "x": %.4f, "y": 0.40, "z": -0.12, "visibility": 0.98},
                        {"name": "left_hip", "x": 0.40, "y": 0.56, "z": -0.03, "visibility": 0.98},
                        {"name": "right_hip", "x": 0.60, "y": 0.56, "z": -0.03, "visibility": 0.98},
                        {"name": "left_knee", "x": 0.38, "y": 0.72, "z": 0.01, "visibility": 0.98},
                        {"name": "right_knee", "x": 0.62, "y": 0.72, "z": 0.01, "visibility": 0.98},
                        {"name": "left_ankle", "x": 0.34, "y": 0.90, "z": 0.02, "visibility": 0.98},
                        {"name": "right_ankle", "x": 0.66, "y": 0.90, "z": 0.02, "visibility": 0.98}
                      ]
                    }""".formatted(
                    index,
                    timestampMs,
                    phase,
                    leftElbowX,
                    rightElbowX,
                    leftWristX,
                    rightWristX));
        }

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
                    "signature": 3333,
                    "sampleCount": %d,
                    "durationMs": %d
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
                        "averageVisibility": 0.98
                      },
                      "rhythm": {
                        "motionEnergyMean": 0.48,
                        "motionEnergyStdDev": 0.22,
                        "motionEnergyPeak": 0.92,
                        "motionBurstCount": 4
                      },
                      "symmetry": {
                        "upperBodyMean": 0.96,
                        "lowerBodyMean": 0.94,
                        "fullBodyMean": 0.95
                      },
                      "kinematics": {
                        "jointRangeMean": 0.42,
                        "jointRangePeak": 0.66,
                        "jointStabilityMean": 0.86,
                        "joints": {}
                      },
                      "focusProfile": %s
                    }
                  }
                }
                """.formatted(
                phase,
                phase,
                phase,
                frameCount,
                durationMs,
                landmarkFrames,
                frameCount,
                frameCount,
                focusProfileJson);
    }
}
