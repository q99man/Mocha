package com.motionchallenge.motion.service;

import com.motionchallenge.video.service.StoredVideo;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class MediaPipeBridgeResultMapper {

    private final MotionAnalysisProfilePayloadFactory payloadFactory;

    public MediaPipeBridgeResultMapper(MotionAnalysisProfilePayloadFactory payloadFactory) {
        this.payloadFactory = payloadFactory;
    }

    public MotionAnalysisResult map(
            StoredVideo storedVideo,
            String analysisPhase,
            MediaPipeBridgeResponse response) {
        Map<String, Object> extras = new LinkedHashMap<>();
        if (response.extras() != null) {
            extras.putAll(response.extras());
        }

        String rawProfileData = payloadFactory.buildPayload(
                storedVideo,
                response.provider(),
                response.analyzerName(),
                analysisPhase,
                response.signature(),
                response.sampleCount(),
                response.durationMs(),
                response.notes(),
                response.landmarks(),
                extras);

        return new MotionAnalysisResult(
                rawProfileData,
                response.signature(),
                response.sampleCount(),
                response.durationMs(),
                response.analyzerName());
    }
}
