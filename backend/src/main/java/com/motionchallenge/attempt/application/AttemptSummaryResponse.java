package com.motionchallenge.attempt.application;

import java.time.LocalDateTime;

public record AttemptSummaryResponse(
        Long id,
        Long challengeId,
        String challengeTitle,
        int score,
        String status,
        String resultSource,
        boolean scoreAvailable,
        String resultHeadline,
        String resultSummary,
        String processingMode,
        boolean processingComplete,
        String processingNotice,
        LocalDateTime attemptedAt) {
}