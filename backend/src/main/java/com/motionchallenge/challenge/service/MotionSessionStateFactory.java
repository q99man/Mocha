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
                            ? "?덊띁?곗뒪 鍮꾨뵒?ㅻ뒗 以鍮꾨릱吏留?遺꾩꽍???꾩쭅 ?앸굹吏 ?딆븘 吏湲덉? ?섑뵆 ????먮쫫留?癒쇱? ?뺤씤?????덉뒿?덈떎."
                            : "?꾩쭅 ?덊띁?곗뒪 以鍮꾧? ?앸굹吏 ?딆븘 吏湲덉? 移대찓???뺤씤怨??섑뵆 ????먮쫫留??뺤씤?섎뒗 ?④퀎?낅땲??");
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
                    "?덊띁?곗뒪 遺꾩꽍怨?理쒖떊 ?쒕룄 寃곌낵 諛섏쁺??紐⑤몢 ?앸궗?듬땲?? 寃곌낵 ?붾㈃?먯꽌 ?먮룞 梨꾩젏 ?붿빟??諛붾줈 ?뺤씤?????덉뒿?덈떎.");
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

        return "?덊띁?곗뒪 遺꾩꽍???꾨즺?섏뼱 移대찓???뺤씤 ???쒕룄 鍮꾨뵒???낅줈?쒖? ?먮룞 梨꾩젏 ?먮쫫?쇰줈 諛붾줈 ?댁뼱吏????덉뒿?덈떎.";
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
