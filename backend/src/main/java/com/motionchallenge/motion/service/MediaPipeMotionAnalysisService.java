package com.motionchallenge.motion.service;

import com.motionchallenge.video.service.StoredVideo;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@ConditionalOnProperty(prefix = "app.motion.analysis", name = "provider", havingValue = "mediapipe")
public class MediaPipeMotionAnalysisService implements MotionAnalysisService {

    private final MotionAnalysisProperties motionAnalysisProperties;
    private final MotionAnalysisProfilePayloadFactory payloadFactory;

    public MediaPipeMotionAnalysisService(
            MotionAnalysisProperties motionAnalysisProperties,
            MotionAnalysisProfilePayloadFactory payloadFactory) {
        this.motionAnalysisProperties = motionAnalysisProperties;
        this.payloadFactory = payloadFactory;
    }

    @Override
    public MotionAnalysisResult analyzeReferenceVideo(StoredVideo storedVideo) {
        return analyze(storedVideo, "reference");
    }

    @Override
    public MotionAnalysisResult analyzeAttemptVideo(StoredVideo storedVideo) {
        return analyze(storedVideo, "attempt");
    }

    private MotionAnalysisResult analyze(StoredVideo storedVideo, String analysisPhase) {
        if (!motionAnalysisProperties.getMediapipe().isStubEnabled()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_IMPLEMENTED,
                    "MediaPipe 분석 provider가 선택되었지만 아직 실제 연동이 연결되지 않았습니다.");
        }

        int signature = buildSignature(storedVideo, analysisPhase);
        int sampleCount = Math.max(16, (int) Math.min(300, storedVideo.size() / 1536L));
        long durationMs = Math.max(4_000L, Math.min(90_000L, storedVideo.size() / 12L));
        String analyzerName = "mediapipe-" + analysisPhase + "-adapter-stub";
        Map<String, Object> extras = new LinkedHashMap<>();
        extras.put("endpoint", motionAnalysisProperties.getMediapipe().getEndpoint());
        extras.put("timeoutMillis", motionAnalysisProperties.getMediapipe().getTimeoutMillis());
        extras.put("stubEnabled", true);

        String rawProfileData = payloadFactory.buildPayload(
                storedVideo,
                "mediapipe",
                analyzerName,
                analysisPhase,
                signature,
                sampleCount,
                durationMs,
                List.of(
                        "MediaPipe adapter stub path is active.",
                        "Replace this branch with real bridge integration."),
                extras);

        return new MotionAnalysisResult(rawProfileData, signature, sampleCount, durationMs, analyzerName);
    }

    private int buildSignature(StoredVideo storedVideo, String analysisPhase) {
        String seed = "mediapipe|" + analysisPhase + "|" + storedVideo.originalFileName() + "|" + storedVideo.size();
        return Math.abs(seed.hashCode() % 10_000);
    }
}
