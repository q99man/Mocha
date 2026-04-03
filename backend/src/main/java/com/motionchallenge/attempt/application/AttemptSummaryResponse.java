package com.motionchallenge.attempt.application;

import java.time.LocalDateTime;

public record AttemptSummaryResponse(
        Long id,
        Long challengeId,
        String challengeTitle,
        int score,
        String status,
        boolean scoreAvailable,
        String resultHeadline,
        String resultSummary,
        LocalDateTime attemptedAt) {
}