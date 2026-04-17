package com.motionchallenge.board.dto;

public record BoardChallengeReviewSummaryResponse(
        Long challengeId,
        String challengeTitle,
        long reviewCount,
        double averageRating) {
}
