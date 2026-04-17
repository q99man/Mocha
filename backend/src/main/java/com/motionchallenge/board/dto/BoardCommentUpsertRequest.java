package com.motionchallenge.board.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BoardCommentUpsertRequest(
        @NotBlank @Size(max = 1200) String content) {
}
