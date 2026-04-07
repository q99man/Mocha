package com.motionchallenge.challenge.service;
import java.time.LocalDateTime;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
@Component
public class MotionSessionRuntimeEventPublisher {
    private static final String RUNTIME_STATE_UPLOAD_PENDING = "UPLOAD_PENDING";
    private static final String RUNTIME_STATE_UPLOAD_IN_PROGRESS = "UPLOAD_IN_PROGRESS";
    private static final String RUNTIME_STATE_UPLOAD_STORED = "UPLOAD_STORED";
    private static final String RUNTIME_STATE_ANALYSIS_IN_PROGRESS = "ANALYSIS_IN_PROGRESS";
    private static final String RUNTIME_STATE_SCORING_COMPLETED = "SCORING_COMPLETED";
    private static final String RUNTIME_STATE_FAILED_RETRYABLE = "FAILED_RETRYABLE";
    private final ApplicationEventPublisher applicationEventPublisher;
    public MotionSessionRuntimeEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
        this.applicationEventPublisher = applicationEventPublisher;
    }
    public void publishUploadPending(Long challengeId) {
        publish(challengeId, RUNTIME_STATE_UPLOAD_PENDING, null, null);
    }
    public void publishUploadInProgress(Long challengeId) {
        publish(challengeId, RUNTIME_STATE_UPLOAD_IN_PROGRESS, null, null);
    }
    public void publishUploadStored(Long challengeId) {
        publish(challengeId, RUNTIME_STATE_UPLOAD_STORED, null, null);
    }
    public void publishAnalysisInProgress(Long challengeId) {
        publish(challengeId, RUNTIME_STATE_ANALYSIS_IN_PROGRESS, null, null);
    }
    public void publishScoringCompleted(Long challengeId) {
        publish(challengeId, RUNTIME_STATE_SCORING_COMPLETED, null, null);
    }
    public void publishFailedRetryable(Long challengeId, String failureCode, String failureMessage) {
        publish(challengeId, RUNTIME_STATE_FAILED_RETRYABLE, failureCode, failureMessage);
    }
    private void publish(Long challengeId, String runtimeState, String failureCode, String failureMessage) {
        applicationEventPublisher.publishEvent(new MotionSessionRuntimeEvent(
                challengeId,
                runtimeState,
                LocalDateTime.now(),
                failureCode,
                failureMessage));
    }
}