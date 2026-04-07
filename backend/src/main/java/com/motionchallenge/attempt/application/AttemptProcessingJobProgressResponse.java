package com.motionchallenge.attempt.application;

import java.time.LocalDateTime;

public record AttemptProcessingJobProgressResponse(
        String trackingId,
        Long challengeId,
        String status,
        String processingMode,
        String completionStrategy,
        String runtimeState,
        String processingNotice,
        String failureCode,
        String failureSeverity,
        String failureAction,
        boolean retryRecommended,
        int processingAttempts,
        int retryCount,
        boolean autoRetryEnabled,
        int remainingAutoRetryCount,
        boolean autoRetryExhausted,
        Long resultAttemptId,
        String originalFileName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        long elapsedSeconds) {
}
