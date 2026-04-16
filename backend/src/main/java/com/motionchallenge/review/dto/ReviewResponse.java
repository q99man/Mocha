package com.motionchallenge.review.dto;

import java.time.LocalDateTime;

public record ReviewResponse(
        Long id,
        Long challengeId,
        String challengeTitle,
        Long memberId,
        String memberDisplayName,
        int rating,
        String content,
        boolean mine,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
