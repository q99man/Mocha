package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.entity.AttemptProcessingJobStatus;
import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import com.motionchallenge.scoring.application.AsyncPendingAttemptCompletionService;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
        prefix = "app.attempt",
        name = "async-pending-auto-complete-enabled",
        havingValue = "true")
public class AsyncPendingAttemptJobRunner {

    private final ScheduledExecutorService executorService =
            Executors.newSingleThreadScheduledExecutor(runnable -> {
                Thread thread = new Thread(runnable, "async-pending-attempt-runner");
                thread.setDaemon(true);
                return thread;
            });

    private final AsyncPendingAttemptCompletionService asyncPendingAttemptCompletionService;
    private final AttemptProcessingJobRepository attemptProcessingJobRepository;
    private final AttemptAsyncPendingProperties asyncPendingProperties;
    private final long initialDelayMillis;
    private final long retryDelayMillis;
    private final int maxAttempts;

    public AsyncPendingAttemptJobRunner(
            AsyncPendingAttemptCompletionService asyncPendingAttemptCompletionService,
            AttemptProcessingJobRepository attemptProcessingJobRepository,
            AttemptAsyncPendingProperties asyncPendingProperties) {
        this.asyncPendingAttemptCompletionService = asyncPendingAttemptCompletionService;
        this.attemptProcessingJobRepository = attemptProcessingJobRepository;
        this.asyncPendingProperties = asyncPendingProperties;
        this.initialDelayMillis = asyncPendingProperties.getAsyncPendingAutoCompleteDelayMillis();
        this.retryDelayMillis = asyncPendingProperties.getAsyncPendingAutoCompleteRetryDelayMillis();
        this.maxAttempts = asyncPendingProperties.getAsyncPendingAutoCompleteMaxAttempts();
    }

    public void schedule(String trackingId, Long challengeId, String notes) {
        schedule(trackingId, challengeId, notes, initialDelayMillis);
    }

    private void schedule(String trackingId, Long challengeId, String notes, long delayMillis) {
        executorService.schedule(
                () -> {
                    try {
                        asyncPendingAttemptCompletionService.completePendingAttemptInternal(challengeId, trackingId, notes);
                    } catch (RuntimeException ignored) {
                        scheduleRetryIfEligible(trackingId, challengeId, notes);
                    }
                },
                delayMillis,
                TimeUnit.MILLISECONDS);
    }

    private void scheduleRetryIfEligible(String trackingId, Long challengeId, String notes) {
        if (!asyncPendingProperties.isAsyncPendingAutoCompleteEnabled()) {
            return;
        }

        AttemptProcessingJob job = attemptProcessingJobRepository.findByTrackingId(trackingId).orElse(null);
        if (job == null) {
            return;
        }

        if (job.getStatus() == AttemptProcessingJobStatus.COMPLETED) {
            return;
        }

        if (job.getProcessingAttempts() >= maxAttempts) {
            return;
        }

        schedule(trackingId, challengeId, notes, retryDelayMillis);
    }

    @PreDestroy
    void shutdown() {
        executorService.shutdownNow();
    }
}
