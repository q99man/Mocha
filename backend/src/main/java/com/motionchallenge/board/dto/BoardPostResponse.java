package com.motionchallenge.board.dto;

import com.motionchallenge.board.entity.BoardCategory;
import com.motionchallenge.board.entity.BoardPostSourceType;
import java.time.LocalDateTime;

public record BoardPostResponse(
        Long id,
        BoardCategory category,
        BoardPostSourceType sourceType,
        String title,
        String content,
        Long authorId,
        String authorDisplayName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        long viewCount,
        long commentCount,
        boolean mine,
        boolean pinned,
        Long reviewId,
        Long challengeId,
        String challengeTitle,
        Integer reviewRating) {
}
