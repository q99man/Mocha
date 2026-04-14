package com.motionchallenge.motion.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MotionAnalysisModeSupportTest {

    @Test
    void detectsStubAnalyzerNames() {
        assertThat(MotionAnalysisModeSupport.isStubAnalyzerName("mediapipe-fastapi-contract-stub")).isTrue();
        assertThat(MotionAnalysisModeSupport.isStubAnalyzerName(" mediapipe-reference-adapter-stub ")).isTrue();
    }

    @Test
    void keepsRealAnalyzerNamesUsable() {
        assertThat(MotionAnalysisModeSupport.isStubAnalyzerName("mediapipe-fastapi-pose-v1")).isFalse();
        assertThat(MotionAnalysisModeSupport.isStubAnalyzerName(null)).isFalse();
    }
}
