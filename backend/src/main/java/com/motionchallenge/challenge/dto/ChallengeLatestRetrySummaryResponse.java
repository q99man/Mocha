package com.motionchallenge.challenge.dto;

import java.time.LocalDateTime;

public record ChallengeLatestRetrySummaryResponse(
        Long latestAttemptId,
        Integer latestScore,
        LocalDateTime latestAttemptedAt,
        Integer scoreDeltaFromPrevious,
        String strongestArea,
        String weakestArea,
        String coachingTeaser,
        String retryFocus,
        String keepStableFocus) {
}