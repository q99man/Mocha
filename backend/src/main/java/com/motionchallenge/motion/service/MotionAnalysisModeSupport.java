package com.motionchallenge.motion.service;

public final class MotionAnalysisModeSupport {

    private MotionAnalysisModeSupport() {
    }

    public static boolean isStubAnalyzerName(String analyzerName) {
        if (analyzerName == null) {
            return false;
        }
        return analyzerName.trim().toLowerCase().contains("stub");
    }
}
