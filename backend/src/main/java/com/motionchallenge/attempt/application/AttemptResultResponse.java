package com.motionchallenge.attempt.application;

import java.time.LocalDateTime;

public record AttemptResultResponse(
        Long attemptId,
        Long challengeId,
        String challengeTitle,
        int score,
        String status,
        String resultSource,
        boolean scoreAvailable,
        String resultHeadline,
        String resultSummary,
        String analyzerName,
        String processingMode,
        boolean processingComplete,
        String processingNotice,
        String pendingTrackingId,
        String videoOriginalFileName,
        String videoContentType,
        long videoSize,
        LocalDateTime attemptedAt) {

    public AttemptResultResponse withProcessingState(
            String nextProcessingMode,
            boolean nextProcessingComplete,
            String nextProcessingNotice) {
        return new AttemptResultResponse(
                attemptId,
                challengeId,
                challengeTitle,
                score,
                status,
                resultSource,
                scoreAvailable,
                resultHeadline,
                resultSummary,
                analyzerName,
                nextProcessingMode,
                nextProcessingComplete,
                nextProcessingNotice,
                pendingTrackingId,
                videoOriginalFileName,
                videoContentType,
                videoSize,
                attemptedAt);
    }
}