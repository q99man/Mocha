package com.motionchallenge.board.dto;

import java.util.List;

public record BoardOverviewResponse(
        long totalCount,
        long generalCount,
        long noticeCount,
        long freeCount,
        long reviewCount,
        List<BoardChallengeReviewSummaryResponse> topReviewChallenges) {
}
