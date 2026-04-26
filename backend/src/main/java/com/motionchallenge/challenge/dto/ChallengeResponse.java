package com.motionchallenge.challenge.dto;

import java.time.LocalDateTime;

public record ChallengeResponse(
        Long id,
        String title,
        String description,
        String category,
        String difficulty,
        String thumbnailUrl,
        String fallbackThumbnailVideoUrl,
        String guideVideoUrl,
        Integer durationSec,
        boolean isActive,
        String referenceAnalysisStatus,
        boolean referenceVideoUploaded,
        boolean referenceMotionProfileReady,
        String referenceVideoOriginalFileName,
        LocalDateTime referenceAnalyzedAt,
        long reviewCount,
        Double averageRating,
        ChallengeLatestRetrySummaryResponse latestRetrySummary) {
}
