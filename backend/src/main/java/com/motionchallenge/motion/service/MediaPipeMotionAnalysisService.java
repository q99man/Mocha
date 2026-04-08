package com.motionchallenge.motion.service;

import com.motionchallenge.video.service.StoredVideo;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "app.motion.analysis", name = "provider", havingValue = "mediapipe")
public class MediaPipeMotionAnalysisService implements MotionAnalysisService {

    private final MediaPipeBridgeRequestFactory requestFactory;
    private final MediaPipeBridgeClient bridgeClient;
    private final MediaPipeBridgeResultMapper resultMapper;

    public MediaPipeMotionAnalysisService(
            MediaPipeBridgeRequestFactory requestFactory,
            MediaPipeBridgeClient bridgeClient,
            MediaPipeBridgeResultMapper resultMapper) {
        this.requestFactory = requestFactory;
        this.bridgeClient = bridgeClient;
        this.resultMapper = resultMapper;
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
        MediaPipeBridgeRequest request = requestFactory.create(storedVideo, analysisPhase);
        MediaPipeBridgeResponse response = bridgeClient.analyze(request);
        return resultMapper.map(storedVideo, analysisPhase, response);
    }
}
