package com.motionchallenge.attempt.application;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record AttemptCreateRequest(
        @NotNull Long challengeId,
        @Min(0) @Max(100) int score,
        String notes,
        String recordType) {
}