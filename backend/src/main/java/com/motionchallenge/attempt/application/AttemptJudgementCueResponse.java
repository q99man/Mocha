package com.motionchallenge.attempt.application;

public record AttemptJudgementCueResponse(
        int id,
        int beatIndex,
        int second,
        int triggerMs,
        int windowMs,
        int lane,
        boolean accent,
        int combo,
        String verdict,
        String source,
        int offsetMs,
        double confidence) {
}
