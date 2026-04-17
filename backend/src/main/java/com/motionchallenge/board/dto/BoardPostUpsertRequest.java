package com.motionchallenge.board.dto;

import com.motionchallenge.board.entity.BoardCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BoardPostUpsertRequest(
        @NotNull BoardCategory category,
        @NotBlank @Size(max = 120) String title,
        @NotBlank @Size(max = 5000) String content,
        boolean pinned) {
}
