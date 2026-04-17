package com.motionchallenge.board.dto;

import java.util.List;

public record BoardPostListResponse(
        List<BoardPostSummaryResponse> items,
        long totalCount,
        int page,
        int size) {
}
