package com.motionchallenge.challenge.service;

import com.motionchallenge.attempt.application.AttemptAsyncPendingProperties;
import com.motionchallenge.attempt.application.AttemptResultSource;
import com.motionchallenge.attempt.application.AttemptStatus;
import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.entity.AttemptProcessingJobStatus;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class MotionSessionRuntimeResolver {

    private static final String RUNTIME_STATE_IDLE = "IDLE";
    private static final String RUNTIME_STATE_UPLOAD_PENDING = "UPLOAD_PENDING";
    private static final String RUNTIME_STATE_UPLOAD_IN_PROGRESS = "UPLOAD_IN_PROGRESS";
    private static final String RUNTIME_STATE_UPLOAD_STORED = "UPLOAD_STORED";
    private static final String RUNTIME_STATE_ANALYSIS_IN_PROGRESS = "ANALYSIS_IN_PROGRESS";
    private static final String RUNTIME_STATE_FAILED_RETRYABLE = "FAILED_RETRYABLE";
    private static final String RUNTIME_STATE_SCORING_COMPLETED = "SCORING_COMPLETED";
    private static final String TRACE_SOURCE_ASYNC_JOB = "ASYNC_JOB";
    private static final String FAILURE_CODE_UPLOAD_STORAGE = "UPLOAD_STORAGE_FAILED";
    private static final String FAILURE_CODE_ANALYSIS = "ANALYSIS_FAILED";
    private static final String FAILURE_CODE_SCORING = "SCORING_FAILED";
    private static final String TERMINAL_STATE_AUTO_RETRY_EXHAUSTED = "AUTO_RETRY_EXHAUSTED";

    private final MotionSessionRuntimeTracker motionSessionRuntimeTracker;
    private final AttemptAsyncPendingProperties asyncPendingProperties;

    public MotionSessionRuntimeResolver(
            MotionSessionRuntimeTracker motionSessionRuntimeTracker,
            AttemptAsyncPendingProperties asyncPendingProperties) {
        this.motionSessionRuntimeTracker = motionSessionRuntimeTracker;
        this.asyncPendingProperties = asyncPendingProperties;
    }

    public MotionSessionRuntimeContext resolve(
            Long challengeId,
            boolean referenceMotionProfileReady,
            Optional<Attempt> latestAttempt,
            boolean latestAttemptVideoUploaded,
            Optional<AttemptProcessingJob> latestProcessingJob) {
        Long latestAttemptId = latestAttempt.map(Attempt::getId).orElse(null);
        String latestAttemptStatus = latestAttempt.map(Attempt::getStatus).orElse(null);
        String latestAttemptResultSource = resolveLatestAttemptResultSource(
                latestAttemptStatus,
                latestAttemptVideoUploaded);
        boolean latestAttemptScoreAvailable = AttemptStatus.COMPLETED.equals(latestAttemptStatus);
        TrackedRuntimeState trackedRuntimeState = motionSessionRuntimeTracker.getTrackedRuntimeState(challengeId);
        List<RuntimeTraceEntry> runtimeHistory = mergeRuntimeHistory(
                motionSessionRuntimeTracker.getRecentRuntimeHistory(challengeId),
                latestProcessingJob);
        String asyncJobRuntimeState = resolveAsyncJobRuntimeState(latestProcessingJob);
        LocalDateTime asyncJobRuntimeUpdatedAt = latestProcessingJob.map(AttemptProcessingJob::getUpdatedAt).orElse(null);
        String jobFailureSeverity = latestProcessingJob.map(this::resolveFailureSeverity).orElse(null);
        String jobFailureAction = latestProcessingJob.map(this::resolveFailureAction).orElse(null);
        int jobRetryCount = latestProcessingJob.map(this::resolveRetryCount).orElse(0);
        boolean autoRetryExhausted = latestProcessingJob.map(this::resolveAutoRetryExhausted).orElse(false);
        boolean inspectRecommended = latestProcessingJob
                .map(job -> resolveInspectRecommended(job, jobFailureSeverity, jobRetryCount, autoRetryExhausted))
                .orElse(false);
        String terminalState = autoRetryExhausted ? TERMINAL_STATE_AUTO_RETRY_EXHAUSTED : null;
        String terminalMessage = autoRetryExhausted ? buildTerminalMessage(jobFailureAction) : null;
        String trackedRuntimeValue = trackedRuntimeState == null ? null : trackedRuntimeState.runtimeState();

        if (!referenceMotionProfileReady) {
            return new MotionSessionRuntimeContext(
                    RUNTIME_STATE_IDLE,
                    latestAttempt.map(Attempt::getCreatedAt).orElse(null),
                    runtimeHistory,
                    null,
                    latestAttemptId,
                    latestAttemptStatus,
                    latestAttemptResultSource,
                    latestAttemptScoreAvailable,
                    latestAttemptVideoUploaded,
                    null,
                    null,
                    null,
                    0,
                    false,
                    false,
                    null,
                    null,
                    null,
                    null);
        }

        if (RUNTIME_STATE_UPLOAD_IN_PROGRESS.equals(trackedRuntimeValue)) {
            return new MotionSessionRuntimeContext(
                    RUNTIME_STATE_UPLOAD_IN_PROGRESS,
                    trackedRuntimeState.runtimeUpdatedAt(),
                    runtimeHistory,
                    null,
                    latestAttemptId,
                    latestAttemptStatus,
                    latestAttemptResultSource,
                    latestAttemptScoreAvailable,
                    latestAttemptVideoUploaded,
                    null,
                    jobFailureSeverity,
                    jobFailureAction,
                    jobRetryCount,
                    autoRetryExhausted,
                    inspectRecommended,
                    terminalState,
                    terminalMessage,
                    null,
                    null);
        }

        if (RUNTIME_STATE_UPLOAD_STORED.equals(trackedRuntimeValue)) {
            return new MotionSessionRuntimeContext(
                    RUNTIME_STATE_UPLOAD_STORED,
                    trackedRuntimeState.runtimeUpdatedAt(),
                    runtimeHistory,
                    null,
                    latestAttemptId,
                    latestAttemptStatus,
                    latestAttemptResultSource,
                    latestAttemptScoreAvailable,
                    latestAttemptVideoUploaded,
                    null,
                    jobFailureSeverity,
                    jobFailureAction,
                    jobRetryCount,
                    autoRetryExhausted,
                    inspectRecommended,
                    terminalState,
                    terminalMessage,
                    null,
                    null);
        }

        if (RUNTIME_STATE_ANALYSIS_IN_PROGRESS.equals(trackedRuntimeValue)) {
            return new MotionSessionRuntimeContext(
                    RUNTIME_STATE_ANALYSIS_IN_PROGRESS,
                    trackedRuntimeState.runtimeUpdatedAt(),
                    runtimeHistory,
                    null,
                    latestAttemptId,
                    latestAttemptStatus,
                    latestAttemptResultSource,
                    latestAttemptScoreAvailable,
                    latestAttemptVideoUploaded,
                    null,
                    jobFailureSeverity,
                    jobFailureAction,
                    jobRetryCount,
                    autoRetryExhausted,
                    inspectRecommended,
                    terminalState,
                    terminalMessage,
                    null,
                    null);
        }

        if (RUNTIME_STATE_FAILED_RETRYABLE.equals(trackedRuntimeValue)) {
            return new MotionSessionRuntimeContext(
                    RUNTIME_STATE_FAILED_RETRYABLE,
                    trackedRuntimeState.runtimeUpdatedAt(),
                    runtimeHistory,
                    null,
                    latestAttemptId,
                    latestAttemptStatus,
                    latestAttemptResultSource,
                    latestAttemptScoreAvailable,
                    latestAttemptVideoUploaded,
                    trackedRuntimeState.failureCode(),
                    jobFailureSeverity,
                    jobFailureAction,
                    jobRetryCount,
                    autoRetryExhausted,
                    inspectRecommended,
                    terminalState,
                    terminalMessage,
                    trackedRuntimeState.failureMessage(),
                    trackedRuntimeState.failureRecordedAt());
        }

        if (asyncJobRuntimeState != null) {
            return new MotionSessionRuntimeContext(
                    asyncJobRuntimeState,
                    asyncJobRuntimeUpdatedAt,
                    runtimeHistory,
                    TRACE_SOURCE_ASYNC_JOB,
                    latestAttemptId,
                    latestAttemptStatus,
                    latestAttemptResultSource,
                    latestAttemptScoreAvailable,
                    latestAttemptVideoUploaded,
                    latestProcessingJob.map(AttemptProcessingJob::getFailureCode).orElse(null),
                    jobFailureSeverity,
                    jobFailureAction,
                    jobRetryCount,
                    autoRetryExhausted,
                    inspectRecommended,
                    terminalState,
                    terminalMessage,
                    latestProcessingJob.map(AttemptProcessingJob::getProcessingNotice).orElse(null),
                    asyncJobRuntimeUpdatedAt);
        }

        if (AttemptStatus.COMPLETED.equals(latestAttemptStatus) && latestAttemptVideoUploaded) {
            return new MotionSessionRuntimeContext(
                    RUNTIME_STATE_SCORING_COMPLETED,
                    latestAttempt.map(Attempt::getCreatedAt).orElse(null),
                    runtimeHistory,
                    null,
                    latestAttemptId,
                    latestAttemptStatus,
                    latestAttemptResultSource,
                    latestAttemptScoreAvailable,
                    latestAttemptVideoUploaded,
                    null,
                    null,
                    null,
                    0,
                    false,
                    false,
                    null,
                    null,
                    null,
                    null);
        }

        return new MotionSessionRuntimeContext(
                RUNTIME_STATE_UPLOAD_PENDING,
                latestAttempt.map(Attempt::getCreatedAt).orElse(null),
                runtimeHistory,
                null,
                latestAttemptId,
                latestAttemptStatus,
                latestAttemptResultSource,
                latestAttemptScoreAvailable,
                latestAttemptVideoUploaded,
                null,
                jobFailureSeverity,
                jobFailureAction,
                jobRetryCount,
                autoRetryExhausted,
                inspectRecommended,
                terminalState,
                terminalMessage,
                null,
                null);
    }

    private String resolveFailureSeverity(AttemptProcessingJob processingJob) {
        String failureCode = processingJob.getFailureCode();
        if (failureCode == null || failureCode.isBlank()) {
            return null;
        }

        return switch (failureCode) {
            case FAILURE_CODE_UPLOAD_STORAGE, FAILURE_CODE_SCORING -> "HIGH";
            case FAILURE_CODE_ANALYSIS -> "WARN";
            default -> "WARN";
        };
    }

    private String resolveFailureAction(AttemptProcessingJob processingJob) {
        String failureCode = processingJob.getFailureCode();
        if (failureCode == null || failureCode.isBlank()) {
            return null;
        }

        return switch (failureCode) {
            case FAILURE_CODE_UPLOAD_STORAGE -> "CHECK_STORAGE";
            case FAILURE_CODE_ANALYSIS -> "RETRY_ANALYSIS";
            case FAILURE_CODE_SCORING -> "RETRY_SCORING";
            default -> "RETRY_UPLOAD";
        };
    }

    private int resolveRetryCount(AttemptProcessingJob processingJob) {
        return Math.max(0, processingJob.getProcessingAttempts() - 1);
    }

    private boolean resolveAutoRetryEnabled(AttemptProcessingJob processingJob) {
        return "ASYNC_JOB_PENDING".equals(processingJob.getProcessingMode())
                && asyncPendingProperties.isAsyncPendingAutoCompleteEnabled();
    }

    private int resolveRemainingAutoRetryCount(AttemptProcessingJob processingJob) {
        if (!resolveAutoRetryEnabled(processingJob)) {
            return 0;
        }

        return Math.max(0, asyncPendingProperties.getAsyncPendingAutoCompleteMaxAttempts() - processingJob.getProcessingAttempts());
    }

    private boolean resolveAutoRetryExhausted(AttemptProcessingJob processingJob) {
        return resolveAutoRetryEnabled(processingJob)
                && RUNTIME_STATE_FAILED_RETRYABLE.equals(processingJob.getRuntimeState())
                && resolveRemainingAutoRetryCount(processingJob) == 0;
    }

    private boolean resolveInspectRecommended(
            AttemptProcessingJob processingJob,
            String failureSeverity,
            int retryCount,
            boolean autoRetryExhausted) {
        if (autoRetryExhausted) {
            return true;
        }

        return RUNTIME_STATE_FAILED_RETRYABLE.equals(processingJob.getRuntimeState())
                && "HIGH".equals(failureSeverity)
                && retryCount >= 2;
    }

    private String buildTerminalMessage(String failureAction) {
        if (failureAction == null || failureAction.isBlank()) {
            return "자동 재시도가 모두 소진되었습니다. 원인을 먼저 점검한 뒤 업로드 흐름을 다시 시작해 주세요.";
        }

        return switch (failureAction) {
            case "CHECK_STORAGE" ->
                    "자동 재시도가 모두 소진되었습니다. 저장 경로와 업로드 파일 상태를 먼저 점검한 뒤 다시 업로드해 주세요.";
            case "RETRY_ANALYSIS" ->
                    "자동 재시도가 모두 소진되었습니다. 분석 경로를 점검한 뒤 수동 완료나 재업로드를 다시 시도해 주세요.";
            case "RETRY_SCORING" ->
                    "자동 재시도가 모두 소진되었습니다. 채점 경로를 점검한 뒤 결과 생성을 다시 시도해 주세요.";
            default ->
                    "자동 재시도가 모두 소진되었습니다. 업로드 흐름을 다시 시작하기 전에 현재 실패 원인을 먼저 점검해 주세요.";
        };
    }

    private List<RuntimeTraceEntry> mergeRuntimeHistory(
            List<RuntimeTraceEntry> trackerHistory,
            Optional<AttemptProcessingJob> latestProcessingJob) {
        if (latestProcessingJob.isEmpty() || latestProcessingJob.get().getRuntimeState() == null) {
            return trackerHistory;
        }

        AttemptProcessingJob job = latestProcessingJob.get();
        RuntimeTraceEntry asyncTraceEntry = new RuntimeTraceEntry(
                job.getRuntimeState(),
                TRACE_SOURCE_ASYNC_JOB,
                job.getUpdatedAt());

        List<RuntimeTraceEntry> mergedHistory = new ArrayList<>();
        mergedHistory.add(asyncTraceEntry);
        for (RuntimeTraceEntry entry : trackerHistory) {
            if (entry.runtimeState().equals(asyncTraceEntry.runtimeState())
                    && entry.source().equals(asyncTraceEntry.source())) {
                continue;
            }
            mergedHistory.add(entry);
            if (mergedHistory.size() >= 6) {
                break;
            }
        }
        return mergedHistory;
    }

    private String resolveAsyncJobRuntimeState(Optional<AttemptProcessingJob> latestProcessingJob) {
        if (latestProcessingJob.isEmpty()) {
            return null;
        }

        AttemptProcessingJob job = latestProcessingJob.get();
        if (job.getRuntimeState() == null || job.getProcessingMode() == null) {
            return null;
        }

        if (!job.getProcessingMode().startsWith("ASYNC_JOB")) {
            return null;
        }

        if (AttemptProcessingJobStatus.COMPLETED.equals(job.getStatus())) {
            return null;
        }

        return job.getRuntimeState();
    }

    private String resolveLatestAttemptResultSource(String latestAttemptStatus, boolean latestAttemptVideoUploaded) {
        if (latestAttemptStatus == null) {
            return null;
        }

        if (!AttemptStatus.COMPLETED.equals(latestAttemptStatus)) {
            return AttemptResultSource.PREPARED_FLOW;
        }

        if (latestAttemptVideoUploaded) {
            return AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED;
        }

        return AttemptResultSource.SAMPLE_SCORING_PREVIEW;
    }
}
