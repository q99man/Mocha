package com.motionchallenge.scoring.api;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ScoringStubRequest(
        @NotNull Long challengeId,
        @Min(1) @Max(100) int score,
        String notes) {
}