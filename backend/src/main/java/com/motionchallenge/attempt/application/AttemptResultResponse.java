package com.motionchallenge.attempt.application;

import java.time.LocalDateTime;

public record AttemptResultResponse(
        Long attemptId,
        Long challengeId,
        String challengeTitle,
        int score,
        String status,
        boolean scoreAvailable,
        String resultHeadline,
        String resultSummary,
        String analyzerName,
        String videoOriginalFileName,
        String videoContentType,
        long videoSize,
        LocalDateTime attemptedAt) {
}