package com.motionchallenge.challenge.service;
import java.time.LocalDateTime;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
@Component
public class MotionSessionRuntimeEventListener {
    private static final String TRACE_SOURCE_EVENT_BUS = "EVENT_BUS";
    private static final long TRANSIENT_VISIBILITY_SECONDS = 2;
    private static final String RUNTIME_STATE_UPLOAD_STORED = "UPLOAD_STORED";
    private static final String RUNTIME_STATE_ANALYSIS_IN_PROGRESS = "ANALYSIS_IN_PROGRESS";
    private static final String RUNTIME_STATE_FAILED_RETRYABLE = "FAILED_RETRYABLE";
    private static final String RUNTIME_STATE_SCORING_COMPLETED = "SCORING_COMPLETED";
    private final MotionSessionRuntimeTracker motionSessionRuntimeTracker;
    public MotionSessionRuntimeEventListener(MotionSessionRuntimeTracker motionSessionRuntimeTracker) {
        this.motionSessionRuntimeTracker = motionSessionRuntimeTracker;
    }
    @EventListener
    public void handle(MotionSessionRuntimeEvent event) {
        if (RUNTIME_STATE_SCORING_COMPLETED.equals(event.runtimeState())) {
            motionSessionRuntimeTracker.clearRuntimeState(event.challengeId());
            motionSessionRuntimeTracker.recordRuntimeHistory(
                    event.challengeId(),
                    event.runtimeState(),
                    TRACE_SOURCE_EVENT_BUS,
                    event.recordedAt());
            return;
        }
        LocalDateTime visibleUntilAt = null;
        if (RUNTIME_STATE_UPLOAD_STORED.equals(event.runtimeState())
                || RUNTIME_STATE_ANALYSIS_IN_PROGRESS.equals(event.runtimeState())) {
            visibleUntilAt = event.recordedAt().plusSeconds(TRANSIENT_VISIBILITY_SECONDS);
        }
        LocalDateTime failureRecordedAt = null;
        if (RUNTIME_STATE_FAILED_RETRYABLE.equals(event.runtimeState())) {
            failureRecordedAt = event.recordedAt();
        }
        motionSessionRuntimeTracker.recordTrackedRuntimeState(
                event.challengeId(),
                event.runtimeState(),
                TRACE_SOURCE_EVENT_BUS,
                event.recordedAt(),
                event.failureCode(),
                event.failureMessage(),
                failureRecordedAt,
                visibleUntilAt);
    }
}