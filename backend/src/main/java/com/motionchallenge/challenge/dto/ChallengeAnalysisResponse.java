package com.motionchallenge.challenge.dto;

import java.time.LocalDateTime;

public record ChallengeAnalysisResponse(
        Long challengeId,
        String analysisStatus,
        boolean referenceMotionProfileReady,
        String analyzerName,
        LocalDateTime analyzedAt,
        String message) {
}