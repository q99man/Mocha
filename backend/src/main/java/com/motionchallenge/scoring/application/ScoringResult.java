package com.motionchallenge.scoring.application;

public record ScoringResult(
        int score,
        String summary,
        int poseSimilarity,
        int timingSimilarity,
        int stabilitySimilarity,
        String strongestArea,
        String weakestArea) {
}
