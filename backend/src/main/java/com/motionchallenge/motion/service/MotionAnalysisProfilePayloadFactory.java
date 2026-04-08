package com.motionchallenge.motion.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.video.service.StoredVideo;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class MotionAnalysisProfilePayloadFactory {

    private final ObjectMapper objectMapper;
    private final MotionAnalysisProperties motionAnalysisProperties;

    public MotionAnalysisProfilePayloadFactory(
            ObjectMapper objectMapper,
            MotionAnalysisProperties motionAnalysisProperties) {
        this.objectMapper = objectMapper;
        this.motionAnalysisProperties = motionAnalysisProperties;
    }

    public String buildPayload(
            StoredVideo storedVideo,
            String provider,
            String analyzerName,
            String analysisPhase,
            int signature,
            int sampleCount,
            long durationMs,
            List<String> notes,
            List<Map<String, Object>> landmarks,
            Map<String, Object> extras) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("schemaVersion", motionAnalysisProperties.getSchemaVersion());
        payload.put("provider", provider);
        payload.put("analyzerName", analyzerName);
        payload.put("analysisPhase", analysisPhase);
        payload.put("sourceVideo", buildSourceVideo(storedVideo));
        payload.put("metrics", buildMetrics(signature, sampleCount, durationMs));
        payload.put("landmarks", landmarks == null ? List.of() : landmarks);
        payload.put("notes", notes);
        payload.put("extras", extras);

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "분석 결과 프로필을 직렬화하지 못했습니다.");
        }
    }

    private Map<String, Object> buildSourceVideo(StoredVideo storedVideo) {
        Map<String, Object> sourceVideo = new LinkedHashMap<>();
        sourceVideo.put("originalFileName", storedVideo.originalFileName());
        sourceVideo.put("storagePath", storedVideo.storagePath());
        sourceVideo.put("contentType", storedVideo.contentType());
        sourceVideo.put("size", storedVideo.size());
        return sourceVideo;
    }

    private Map<String, Object> buildMetrics(int signature, int sampleCount, long durationMs) {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("signature", signature);
        metrics.put("sampleCount", sampleCount);
        metrics.put("durationMs", durationMs);
        return metrics;
    }
}
