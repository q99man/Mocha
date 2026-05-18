package com.motionchallenge.scoring.application;

public record AttemptResultPresentation(
        boolean scoreAvailable,
        String resultHeadline,
        String resultSummary) {
}
