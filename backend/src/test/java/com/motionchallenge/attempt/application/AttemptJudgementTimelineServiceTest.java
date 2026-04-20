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

    private String buildProfileJson(
            String phase,
            long durationMs,
            int attemptOffsetMs,
            double leftShoulderX,
            double rightShoulderX,
            double leftWristX,
            double rightWristX) {
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
                      }
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
                rightWristX);
    }
}
