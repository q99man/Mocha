package com.motionchallenge.motion.service;

import com.motionchallenge.video.service.StoredVideo;
import org.springframework.stereotype.Component;

@Component
public class MediaPipeBridgeRequestFactory {

    private final MotionAnalysisProperties motionAnalysisProperties;

    public MediaPipeBridgeRequestFactory(MotionAnalysisProperties motionAnalysisProperties) {
        this.motionAnalysisProperties = motionAnalysisProperties;
    }

    public MediaPipeBridgeRequest create(StoredVideo storedVideo, String analysisPhase) {
        return new MediaPipeBridgeRequest(
                motionAnalysisProperties.getSchemaVersion(),
                analysisPhase,
                storedVideo.originalFileName(),
                storedVideo.absolutePath().toString(),
                storedVideo.contentType(),
                storedVideo.size(),
                motionAnalysisProperties.getMediapipe().getEndpoint(),
                motionAnalysisProperties.getMediapipe().getAnalyzePath(),
                motionAnalysisProperties.getMediapipe().getTimeoutMillis());
    }
}
