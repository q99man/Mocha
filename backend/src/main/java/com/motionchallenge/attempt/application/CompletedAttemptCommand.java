package com.motionchallenge.attempt.application;

public record CompletedAttemptCommand(
        Long challengeId,
        int score,
        String notes) {
}