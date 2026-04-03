package com.motionchallenge.motion.service;

public record MotionAnalysisResult(
        String rawProfileData,
        int signature,
        int sampleCount,
        long durationMs,
        String analyzerName) {
}