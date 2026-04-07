package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.attempt.video-processing-mode", havingValue = "async-pending-stub")
public class AsyncPendingAttemptVideoProcessingDispatcher implements AttemptVideoProcessingDispatcher {

    private static final String PROCESSING_MODE = "ASYNC_JOB_PENDING";
    private static final String RUNTIME_STATE = "UPLOAD_PENDING";
    private static final String PROCESSING_NOTICE = "현재는 비동기 대기 stub 모드입니다. 실제 백그라운드 작업은 아직 연결되지 않았습니다.";
    private static final String PENDING_HEADLINE = "업로드가 접수되었습니다.";
    private static final String PENDING_SUMMARY = "분석과 채점은 비동기 작업으로 전환될 예정이며, 지금은 대기 상태만 확인할 수 있습니다.";
    private static final String PENDING_ANALYZER_NAME = "async-pending-stub";

    private final PendingAttemptVideoJobRegistry pendingAttemptVideoJobRegistry;
    private final AttemptProcessingJobDraftFactory attemptProcessingJobDraftFactory;
    private final AttemptProcessingJobRepository attemptProcessingJobRepository;

    public AsyncPendingAttemptVideoProcessingDispatcher(
            PendingAttemptVideoJobRegistry pendingAttemptVideoJobRegistry,
            AttemptProcessingJobDraftFactory attemptProcessingJobDraftFactory,
            AttemptProcessingJobRepository attemptProcessingJobRepository) {
        this.pendingAttemptVideoJobRegistry = pendingAttemptVideoJobRegistry;
        this.attemptProcessingJobDraftFactory = attemptProcessingJobDraftFactory;
        this.attemptProcessingJobRepository = attemptProcessingJobRepository;
    }

    @Override
    public AttemptResultResponse dispatch(AttemptVideoProcessingCommand command) {
        String trackingId = UUID.randomUUID().toString();
        PendingAttemptVideoJob pendingJob = new PendingAttemptVideoJob(
                trackingId,
                command.challenge().getId(),
                command.storedVideo(),
                command.notes());

        pendingAttemptVideoJobRegistry.register(pendingJob);

        AttemptProcessingJob draft = attemptProcessingJobDraftFactory.createPendingDraft(
                command.challenge(),
                pendingJob,
                PROCESSING_MODE,
                RUNTIME_STATE,
                PROCESSING_NOTICE);
        attemptProcessingJobRepository.save(draft);

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
                trackingId,
                command.storedVideo().originalFileName(),
                command.storedVideo().contentType(),
                command.storedVideo().size(),
                LocalDateTime.now());
    }
}