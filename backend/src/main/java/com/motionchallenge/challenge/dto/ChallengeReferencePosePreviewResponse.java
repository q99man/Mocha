package com.motionchallenge.challenge.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ChallengeReferencePosePreviewResponse(
        Long challengeId,
        String challengeTitle,
        String analyzerName,
        LocalDateTime analyzedAt,
        String referenceVideoUrl,
        Integer sampleCount,
        Long durationMs,
        List<ChallengeReferencePoseFrameResponse> frames) {
}
