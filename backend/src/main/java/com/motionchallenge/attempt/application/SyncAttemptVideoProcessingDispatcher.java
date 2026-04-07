package com.motionchallenge.attempt.application;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.attempt.video-processing-mode", havingValue = "sync-inline", matchIfMissing = true)
public class SyncAttemptVideoProcessingDispatcher implements AttemptVideoProcessingDispatcher {

    private static final String PROCESSING_MODE = "SYNC_INLINE";
    private static final String PROCESSING_NOTICE = "현재 MVP에서는 업로드 직후 동기 처리로 분석과 채점을 바로 완료합니다.";

    private final AttemptVideoProcessingService attemptVideoProcessingService;

    public SyncAttemptVideoProcessingDispatcher(AttemptVideoProcessingService attemptVideoProcessingService) {
        this.attemptVideoProcessingService = attemptVideoProcessingService;
    }

    @Override
    public AttemptResultResponse dispatch(AttemptVideoProcessingCommand command) {
        AttemptResultResponse response = attemptVideoProcessingService.processUploadedAttempt(
                command.challenge(),
                command.referenceProfile(),
                command.storedVideo(),
                command.notes());

        return response.withProcessingState(PROCESSING_MODE, true, PROCESSING_NOTICE);
    }
}