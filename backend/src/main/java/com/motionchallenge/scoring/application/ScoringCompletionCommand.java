package com.motionchallenge.scoring.application;

public record ScoringCompletionCommand(
        Long challengeId,
        int score,
        String notes) {
}