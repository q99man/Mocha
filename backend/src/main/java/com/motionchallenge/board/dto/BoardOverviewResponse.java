package com.motionchallenge.board.dto;

import java.util.List;

public record BoardOverviewResponse(
        long totalCount,
        long generalCount,
        long reviewCount,
        List<BoardChallengeReviewSummaryResponse> topReviewChallenges) {
}
