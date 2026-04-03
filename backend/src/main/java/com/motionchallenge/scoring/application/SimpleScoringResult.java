package com.motionchallenge.scoring.application;

public record SimpleScoringResult(
        boolean scoreAvailable,
        String resultHeadline,
        String resultSummary) {
}