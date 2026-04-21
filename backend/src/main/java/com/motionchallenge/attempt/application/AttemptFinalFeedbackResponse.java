package com.motionchallenge.attempt.application;

public record AttemptFinalFeedbackResponse(
        String grade,
        String badge,
        String headline,
        String summary,
        String rhythmLabel,
        String focusLabel,
        boolean cleared) {
}
