package com.motionchallenge.challenge.service;

import com.motionchallenge.attempt.application.AttemptResultSource;
import com.motionchallenge.attempt.application.AttemptStatus;
import com.motionchallenge.attempt.entity.Attempt;
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

    private final MotionSessionRuntimeTracker motionSessionRuntimeTracker;

    public MotionSessionRuntimeResolver(MotionSessionRuntimeTracker motionSessionRuntimeTracker) {
        this.motionSessionRuntimeTracker = motionSessionRuntimeTracker;
    }

    public MotionSessionRuntimeContext resolve(
            Long challengeId,
            boolean referenceMotionProfileReady,
            Optional<Attempt> latestAttempt,
            boolean latestAttemptVideoUploaded) {
        Long latestAttemptId = latestAttempt.map(Attempt::getId).orElse(null);
        String latestAttemptStatus = latestAttempt.map(Attempt::getStatus).orElse(null);
        String latestAttemptResultSource = resolveLatestAttemptResultSource(
                latestAttemptStatus,
                latestAttemptVideoUploaded);
        boolean latestAttemptScoreAvailable = AttemptStatus.COMPLETED.equals(latestAttemptStatus);
        TrackedRuntimeState trackedRuntimeState = motionSessionRuntimeTracker.getTrackedRuntimeState(challengeId);
        java.util.List<RuntimeTraceEntry> runtimeHistory = motionSessionRuntimeTracker.getRecentRuntimeHistory(challengeId);
        String trackedRuntimeValue = trackedRuntimeState == null ? null : trackedRuntimeState.runtimeState();

        if (!referenceMotionProfileReady) {
            return new MotionSessionRuntimeContext(
                    RUNTIME_STATE_IDLE,
                    latestAttempt.map(Attempt::getCreatedAt).orElse(null),
                    runtimeHistory,
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
                    latestAttemptId,
                    latestAttemptStatus,
                    latestAttemptResultSource,
                    latestAttemptScoreAvailable,
                    latestAttemptVideoUploaded,
                    trackedRuntimeState.failureCode(),
                    trackedRuntimeState.failureMessage(),
                    trackedRuntimeState.failureRecordedAt());
        }

        if (AttemptStatus.COMPLETED.equals(latestAttemptStatus) && latestAttemptVideoUploaded) {
            return new MotionSessionRuntimeContext(
                    RUNTIME_STATE_SCORING_COMPLETED,
                    latestAttempt.map(Attempt::getCreatedAt).orElse(null),
                    runtimeHistory,
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
                latestAttemptId,
                latestAttemptStatus,
                latestAttemptResultSource,
                latestAttemptScoreAvailable,
                latestAttemptVideoUploaded,
                null,
                null,
                null);
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
