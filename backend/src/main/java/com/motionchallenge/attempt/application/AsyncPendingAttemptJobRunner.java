package com.motionchallenge.attempt.application;

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
    private final PendingAttemptVideoJobRegistry pendingAttemptVideoJobRegistry;
    private final AttemptProcessingJobRepository attemptProcessingJobRepository;
    private final AttemptAsyncPendingProperties asyncPendingProperties;
    private final long initialDelayMillis;
    private final long retryDelayMillis;
    private final int maxAttempts;

    public AsyncPendingAttemptJobRunner(
            AsyncPendingAttemptCompletionService asyncPendingAttemptCompletionService,
            PendingAttemptVideoJobRegistry pendingAttemptVideoJobRegistry,
            AttemptProcessingJobRepository attemptProcessingJobRepository,
            AttemptAsyncPendingProperties asyncPendingProperties) {
        this.asyncPendingAttemptCompletionService = asyncPendingAttemptCompletionService;
        this.pendingAttemptVideoJobRegistry = pendingAttemptVideoJobRegistry;
        this.attemptProcessingJobRepository = attemptProcessingJobRepository;
        this.asyncPendingProperties = asyncPendingProperties;
        this.initialDelayMillis = asyncPendingProperties.getAsyncPendingAutoCompleteDelayMillis();
        this.retryDelayMillis = asyncPendingProperties.getAsyncPendingAutoCompleteRetryDelayMillis();
        this.maxAttempts = asyncPendingProperties.getAsyncPendingAutoCompleteMaxAttempts();
    }

    public void schedule(PendingAttemptVideoJob pendingJob) {
        schedule(pendingJob, initialDelayMillis);
    }

    private void schedule(PendingAttemptVideoJob pendingJob, long delayMillis) {
        executorService.schedule(
                () -> {
                    try {
                        asyncPendingAttemptCompletionService.completePendingAttempt(
                                pendingJob.challengeId(),
                                pendingJob.trackingId(),
                                pendingJob.notes());
                    } catch (RuntimeException ignored) {
                        scheduleRetryIfEligible(pendingJob);
                    }
                },
                delayMillis,
                TimeUnit.MILLISECONDS);
    }

    private void scheduleRetryIfEligible(PendingAttemptVideoJob pendingJob) {
        if (!asyncPendingProperties.isAsyncPendingAutoCompleteEnabled()) {
            return;
        }

        boolean stillPending = pendingAttemptVideoJobRegistry.findByTrackingId(pendingJob.trackingId()).isPresent();
        if (!stillPending) {
            return;
        }

        int attempts = attemptProcessingJobRepository.findByTrackingId(pendingJob.trackingId())
                .map(job -> job.getProcessingAttempts())
                .orElse(0);
        if (attempts >= maxAttempts) {
            return;
        }

        schedule(pendingJob, retryDelayMillis);
    }

    @PreDestroy
    void shutdown() {
        executorService.shutdownNow();
    }
}
