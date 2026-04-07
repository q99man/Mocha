package com.motionchallenge.challenge.service;

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

    private final MotionSessionRuntimeTracker motionSessionRuntimeTracker;

    public MotionSessionRuntimeResolver(MotionSessionRuntimeTracker motionSessionRuntimeTracker) {
        this.motionSessionRuntimeTracker = motionSessionRuntimeTracker;
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
                null,
                null);
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
