package com.motionchallenge.motion.service;

import java.util.List;
import java.util.Map;

public record MediaPipeBridgeResponse(
        String provider,
        String analyzerName,
        int signature,
        int sampleCount,
        long durationMs,
        List<String> notes,
        List<Map<String, Object>> landmarks,
        Map<String, Object> extras) {
}
