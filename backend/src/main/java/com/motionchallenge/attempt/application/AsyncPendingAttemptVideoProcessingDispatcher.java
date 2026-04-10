package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.attempt.video-processing-mode", havingValue = "async-pending-stub")
public class AsyncPendingAttemptVideoProcessingDispatcher implements AttemptVideoProcessingDispatcher {

    private static final String PROCESSING_MODE = "ASYNC_JOB_PENDING";
    private static final String RUNTIME_STATE = "UPLOAD_PENDING";
    private static final String PROCESSING_NOTICE =
            "Async pending stub mode is active. The real background worker has not finished this upload yet.";
    private static final String PENDING_HEADLINE = "Upload accepted.";
    private static final String PENDING_SUMMARY =
            "Analysis and scoring were deferred to the async pending flow. Only the pending state is available right now.";
    private static final String PENDING_ANALYZER_NAME = "async-pending-stub";

    private final AttemptProcessingJobDraftFactory attemptProcessingJobDraftFactory;
    private final AttemptProcessingJobRepository attemptProcessingJobRepository;
    private final ObjectProvider<AsyncPendingAttemptJobRunner> asyncPendingAttemptJobRunnerProvider;

    public AsyncPendingAttemptVideoProcessingDispatcher(
            AttemptProcessingJobDraftFactory attemptProcessingJobDraftFactory,
            AttemptProcessingJobRepository attemptProcessingJobRepository,
            ObjectProvider<AsyncPendingAttemptJobRunner> asyncPendingAttemptJobRunnerProvider) {
        this.attemptProcessingJobDraftFactory = attemptProcessingJobDraftFactory;
        this.attemptProcessingJobRepository = attemptProcessingJobRepository;
        this.asyncPendingAttemptJobRunnerProvider = asyncPendingAttemptJobRunnerProvider;
    }

    @Override
    public AttemptResultResponse dispatch(AttemptVideoProcessingCommand command) {
        String trackingId = UUID.randomUUID().toString();

        var draft = attemptProcessingJobRepository.save(
                attemptProcessingJobDraftFactory.createPendingDraft(
                        command.challenge(),
                        trackingId,
                        command.storedVideo(),
                        command.notes(),
                        PROCESSING_MODE,
                        RUNTIME_STATE,
                        PROCESSING_NOTICE));

        asyncPendingAttemptJobRunnerProvider.ifAvailable(
                runner -> runner.schedule(draft.getTrackingId(), command.challenge().getId(), command.notes()));

        return new AttemptResultResponse(
                null,
                command.challenge().getId(),
                command.challenge().getTitle(),
                0,
                AttemptStatus.PREPARED,
                AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED,
                false,
                PENDING_HEADLINE,
                PENDING_SUMMARY,
                PENDING_ANALYZER_NAME,
                PROCESSING_MODE,
                false,
                PROCESSING_NOTICE,
                draft.getTrackingId(),
                command.storedVideo().originalFileName(),
                command.storedVideo().contentType(),
                command.storedVideo().size(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                LocalDateTime.now());
    }
}
