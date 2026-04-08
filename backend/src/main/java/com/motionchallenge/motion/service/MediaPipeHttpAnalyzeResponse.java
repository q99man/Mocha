package com.motionchallenge.motion.service;

import java.util.List;
import java.util.Map;

public record MediaPipeHttpAnalyzeResponse(
        String provider,
        String analyzerName,
        Integer signature,
        Integer sampleCount,
        Long durationMs,
        List<String> notes,
        List<Map<String, Object>> landmarks,
        Map<String, Object> extras) {
}
