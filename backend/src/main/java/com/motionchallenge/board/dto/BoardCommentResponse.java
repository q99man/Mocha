package com.motionchallenge.board.dto;

import java.time.LocalDateTime;

public record BoardCommentResponse(
        Long id,
        Long postId,
        Long memberId,
        String memberDisplayName,
        String content,
        boolean mine,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
