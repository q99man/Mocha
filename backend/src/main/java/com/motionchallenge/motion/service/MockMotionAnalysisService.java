package com.motionchallenge.motion.service;

import com.motionchallenge.video.service.StoredVideo;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "app.motion.analysis", name = "provider", havingValue = "mock", matchIfMissing = true)
public class MockMotionAnalysisService implements MotionAnalysisService {

    private final MotionAnalysisProfilePayloadFactory payloadFactory;

    public MockMotionAnalysisService(MotionAnalysisProfilePayloadFactory payloadFactory) {
        this.payloadFactory = payloadFactory;
    }

    @Override
    public MotionAnalysisResult analyzeReferenceVideo(StoredVideo storedVideo) {
        return analyze(storedVideo, "reference", "mock-reference-analyzer");
    }

    @Override
    public MotionAnalysisResult analyzeAttemptVideo(StoredVideo storedVideo) {
        return analyze(storedVideo, "attempt", "mock-attempt-analyzer");
    }

    private MotionAnalysisResult analyze(StoredVideo storedVideo, String analysisPhase, String analyzerName) {
        int signature = buildSignature(storedVideo);
        int sampleCount = Math.max(12, (int) Math.min(240, storedVideo.size() / 2048L));
        long durationMs = Math.max(3_000L, Math.min(60_000L, storedVideo.size() / 15L));
        String rawProfileData = payloadFactory.buildPayload(
                storedVideo,
                "mock",
                analyzerName,
                analysisPhase,
                signature,
                sampleCount,
                durationMs,
                List.of("Mock analyzer path is active."),
                List.of(),
                buildExtras());

        return new MotionAnalysisResult(rawProfileData, signature, sampleCount, durationMs, analyzerName);
    }

    private int buildSignature(StoredVideo storedVideo) {
        String seed = storedVideo.originalFileName() + "|" + storedVideo.size() + "|" + storedVideo.contentType();
        return Math.abs(seed.hashCode() % 10_000);
    }

    private Map<String, Object> buildExtras() {
        Map<String, Object> extras = new LinkedHashMap<>();
        extras.put("stubEnabled", true);
        extras.put("adapterReady", true);
        return extras;
    }
}
