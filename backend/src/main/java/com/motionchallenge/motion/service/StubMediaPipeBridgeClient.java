package com.motionchallenge.motion.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.motion.analysis.mediapipe", name = "stub-enabled", havingValue = "true")
public class StubMediaPipeBridgeClient implements MediaPipeBridgeClient {

    @Override
    public MediaPipeBridgeResponse analyze(MediaPipeBridgeRequest request) {
        int signature = buildSignature(request);
        int sampleCount = Math.max(16, (int) Math.min(300, request.fileSize() / 1536L));
        long durationMs = Math.max(4_000L, Math.min(90_000L, request.fileSize() / 12L));
        String analyzerName = "mediapipe-" + request.analysisPhase() + "-adapter-stub";

        Map<String, Object> extras = new LinkedHashMap<>();
        extras.put("endpoint", request.endpoint());
        extras.put("analyzePath", request.analyzePath());
        extras.put("timeoutMillis", request.timeoutMillis());
        extras.put("stubEnabled", true);
        extras.put("bridgeMode", "STUB");
        extras.put("transport", "IN_PROCESS");

        return new MediaPipeBridgeResponse(
                "mediapipe",
                analyzerName,
                signature,
                sampleCount,
                durationMs,
                List.of(
                        "MediaPipe bridge stub path is active.",
                        "Replace this client with a real FastAPI bridge implementation."),
                List.of(),
                extras);
    }

    private int buildSignature(MediaPipeBridgeRequest request) {
        String seed = "mediapipe|" + request.analysisPhase() + "|" + request.originalFileName() + "|" + request.fileSize();
        return Math.abs(seed.hashCode() % 10_000);
    }
}
