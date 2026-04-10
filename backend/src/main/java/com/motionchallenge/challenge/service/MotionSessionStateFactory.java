package com.motionchallenge.challenge.service;

import com.motionchallenge.challenge.dto.MotionSessionRuntimeTraceEntryResponse;
import com.motionchallenge.challenge.dto.MotionSessionStateResponse;
import com.motionchallenge.challenge.entity.Challenge;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class MotionSessionStateFactory {

    private static final String READINESS_STATE_REFERENCE_PENDING = "REFERENCE_PENDING";
    private static final String READINESS_STATE_UPLOAD_READY = "UPLOAD_READY";

    private static final String SESSION_STATE_REFERENCE_PENDING = "REFERENCE_PENDING";
    private static final String SESSION_STATE_CAMERA_PERMISSION_REQUIRED = "CAMERA_PERMISSION_REQUIRED";

    private static final String RECORDING_PHASE_SAMPLE_FLOW_ONLY = "SAMPLE_FLOW_ONLY";
    private static final String RECORDING_PHASE_UPLOAD_SCORING_READY = "UPLOAD_SCORING_READY";

    private static final String NEXT_ACTION_REVIEW_REFERENCE_STATUS = "REVIEW_REFERENCE_STATUS";
    private static final String NEXT_ACTION_REQUEST_CAMERA_PERMISSION = "REQUEST_CAMERA_PERMISSION";

    public MotionSessionStateResponse createState(
            Challenge challenge,
            boolean referenceVideoUploaded,
            boolean referenceMotionProfileReady,
            MotionSessionRuntimeContext runtimeContext) {
        if (!referenceMotionProfileReady) {
            return new MotionSessionStateResponse(
                    challenge.getId(),
                    READINESS_STATE_REFERENCE_PENDING,
                    runtimeContext.runtimeState(),
                    formatRuntimeUpdatedAt(resolveRuntimeUpdatedAt(challenge, runtimeContext)),
                    toTraceResponses(runtimeContext.runtimeHistory()),
                    runtimeContext.latestAttemptId(),
                    runtimeContext.latestAttemptResultSource(),
                    runtimeContext.latestAttemptScoreAvailable(),
                    runtimeContext.lastFailureCode(),
                    runtimeContext.failureSeverity(),
                    runtimeContext.failureAction(),
                    runtimeContext.retryCount(),
                    runtimeContext.autoRetryExhausted(),
                    runtimeContext.inspectRecommended(),
                    runtimeContext.terminalState(),
                    runtimeContext.terminalMessage(),
                    runtimeContext.lastFailureMessage(),
                    formatFailureAt(runtimeContext.lastFailureAt()),
                    SESSION_STATE_REFERENCE_PENDING,
                    RECORDING_PHASE_SAMPLE_FLOW_ONLY,
                    referenceVideoUploaded ? NEXT_ACTION_REVIEW_REFERENCE_STATUS : NEXT_ACTION_REQUEST_CAMERA_PERMISSION,
                    true,
                    false,
                    false,
                    false,
                    referenceVideoUploaded
                            ? "The reference video is uploaded, but reference analysis is still pending. Finish reference analysis before accepting uploads."
                            : "Upload a reference video first, then run reference analysis before opening the challenge for scoring.");
        }

        if ("SCORING_COMPLETED".equals(runtimeContext.runtimeState())) {
            return new MotionSessionStateResponse(
                    challenge.getId(),
                    READINESS_STATE_UPLOAD_READY,
                    runtimeContext.runtimeState(),
                    formatRuntimeUpdatedAt(resolveRuntimeUpdatedAt(challenge, runtimeContext)),
                    toTraceResponses(runtimeContext.runtimeHistory()),
                    runtimeContext.latestAttemptId(),
                    runtimeContext.latestAttemptResultSource(),
                    runtimeContext.latestAttemptScoreAvailable(),
                    runtimeContext.lastFailureCode(),
                    runtimeContext.failureSeverity(),
                    runtimeContext.failureAction(),
                    runtimeContext.retryCount(),
                    runtimeContext.autoRetryExhausted(),
                    runtimeContext.inspectRecommended(),
                    runtimeContext.terminalState(),
                    runtimeContext.terminalMessage(),
                    runtimeContext.lastFailureMessage(),
                    formatFailureAt(runtimeContext.lastFailureAt()),
                    SESSION_STATE_CAMERA_PERMISSION_REQUIRED,
                    RECORDING_PHASE_UPLOAD_SCORING_READY,
                    NEXT_ACTION_REQUEST_CAMERA_PERMISSION,
                    true,
                    false,
                    true,
                    true,
                    "Reference analysis is complete and the most recent scoring flow also finished successfully.");
        }

        return new MotionSessionStateResponse(
                challenge.getId(),
                READINESS_STATE_UPLOAD_READY,
                runtimeContext.runtimeState(),
                formatRuntimeUpdatedAt(resolveRuntimeUpdatedAt(challenge, runtimeContext)),
                toTraceResponses(runtimeContext.runtimeHistory()),
                runtimeContext.latestAttemptId(),
                runtimeContext.latestAttemptResultSource(),
                runtimeContext.latestAttemptScoreAvailable(),
                runtimeContext.lastFailureCode(),
                runtimeContext.failureSeverity(),
                runtimeContext.failureAction(),
                runtimeContext.retryCount(),
                runtimeContext.autoRetryExhausted(),
                runtimeContext.inspectRecommended(),
                runtimeContext.terminalState(),
                runtimeContext.terminalMessage(),
                runtimeContext.lastFailureMessage(),
                formatFailureAt(runtimeContext.lastFailureAt()),
                SESSION_STATE_CAMERA_PERMISSION_REQUIRED,
                RECORDING_PHASE_UPLOAD_SCORING_READY,
                NEXT_ACTION_REQUEST_CAMERA_PERMISSION,
                true,
                false,
                true,
                true,
                resolveReadyMessage(runtimeContext));
    }

    private String formatFailureAt(java.time.LocalDateTime failureAt) {
        return failureAt == null ? null : failureAt.toString();
    }

    private String formatRuntimeUpdatedAt(java.time.LocalDateTime runtimeUpdatedAt) {
        return runtimeUpdatedAt == null ? null : runtimeUpdatedAt.toString();
    }

    private String resolveReadyMessage(MotionSessionRuntimeContext runtimeContext) {
        if (runtimeContext.terminalMessage() != null && !runtimeContext.terminalMessage().isBlank()) {
            return runtimeContext.terminalMessage();
        }

        return "Reference analysis is complete. You can now request camera permission and upload a real attempt video for scoring.";
    }

    private java.time.LocalDateTime resolveRuntimeUpdatedAt(
            Challenge challenge,
            MotionSessionRuntimeContext runtimeContext) {
        if (runtimeContext.runtimeUpdatedAt() != null) {
            return runtimeContext.runtimeUpdatedAt();
        }

        if (challenge.getReferenceAnalyzedAt() != null) {
            return challenge.getReferenceAnalyzedAt();
        }

        return challenge.getUpdatedAt();
    }

    private List<MotionSessionRuntimeTraceEntryResponse> toTraceResponses(List<RuntimeTraceEntry> runtimeHistory) {
        return runtimeHistory.stream()
                .map(entry -> new MotionSessionRuntimeTraceEntryResponse(
                        entry.runtimeState(),
                        entry.source(),
                        formatRuntimeUpdatedAt(entry.recordedAt())))
                .toList();
    }
}
