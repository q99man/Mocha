package com.motionchallenge.scoring.api;

import jakarta.validation.constraints.NotNull;

public record AsyncPendingCompletionRequest(
        @NotNull Long challengeId,
        String trackingId,
        String notes) {
}