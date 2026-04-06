package com.motionchallenge.challenge.service;

import com.motionchallenge.challenge.dto.MotionSessionStateResponse;
import com.motionchallenge.challenge.dto.MotionSessionRuntimeTraceEntryResponse;
import java.util.List;
import com.motionchallenge.challenge.entity.Challenge;
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
                            ? "레퍼런스 비디오는 준비됐지만 분석이 아직 끝나지 않아 지금은 샘플 저장 흐름만 먼저 확인할 수 있습니다."
                            : "아직 레퍼런스 준비가 끝나지 않아 지금은 카메라 확인과 샘플 저장 흐름 중심으로 확인하는 단계입니다.");
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
                    runtimeContext.lastFailureMessage(),
                    formatFailureAt(runtimeContext.lastFailureAt()),
                    SESSION_STATE_CAMERA_PERMISSION_REQUIRED,
                    RECORDING_PHASE_UPLOAD_SCORING_READY,
                    NEXT_ACTION_REQUEST_CAMERA_PERMISSION,
                    true,
                    false,
                    true,
                    true,
                    "레퍼런스 분석과 최신 시도 결과 반영이 모두 끝났습니다. 결과 화면에서 자동 채점 요약을 바로 이어서 확인할 수 있습니다.");
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
                runtimeContext.lastFailureMessage(),
                formatFailureAt(runtimeContext.lastFailureAt()),
                SESSION_STATE_CAMERA_PERMISSION_REQUIRED,
                RECORDING_PHASE_UPLOAD_SCORING_READY,
                NEXT_ACTION_REQUEST_CAMERA_PERMISSION,
                true,
                false,
                true,
                true,
                "레퍼런스 분석이 완료되어 카메라 확인 뒤 시도 비디오 업로드와 자동 채점 흐름으로 바로 이어질 수 있습니다.");
    }

    private String formatFailureAt(java.time.LocalDateTime failureAt) {
        return failureAt == null ? null : failureAt.toString();
    }

    private String formatRuntimeUpdatedAt(java.time.LocalDateTime runtimeUpdatedAt) {
        return runtimeUpdatedAt == null ? null : runtimeUpdatedAt.toString();
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
