package com.motionchallenge.motion.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.video.service.StoredVideo;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MockMotionAnalysisService implements MotionAnalysisService {

    private final ObjectMapper objectMapper;

    public MockMotionAnalysisService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public MotionAnalysisResult analyzeReferenceVideo(StoredVideo storedVideo) {
        return analyze(storedVideo, "mock-reference-analyzer");
    }

    @Override
    public MotionAnalysisResult analyzeAttemptVideo(StoredVideo storedVideo) {
        return analyze(storedVideo, "mock-attempt-analyzer");
    }

    private MotionAnalysisResult analyze(StoredVideo storedVideo, String analyzerName) {
        int signature = buildSignature(storedVideo);
        int sampleCount = Math.max(12, (int) Math.min(240, storedVideo.size() / 2048L));
        long durationMs = Math.max(3_000L, Math.min(60_000L, storedVideo.size() / 15L));
        String rawProfileData = buildRawProfileData(storedVideo, analyzerName, signature, sampleCount, durationMs);

        // TODO: 異뷀썑 Python/FastAPI + MediaPipe 遺꾩꽍湲곕줈 援먯껜??????援ы쁽???泥댄븯硫??⑸땲??
        return new MotionAnalysisResult(rawProfileData, signature, sampleCount, durationMs, analyzerName);
    }

    private int buildSignature(StoredVideo storedVideo) {
        String seed = storedVideo.originalFileName() + "|" + storedVideo.size() + "|" + storedVideo.contentType();
        return Math.abs(seed.hashCode() % 10_000);
    }

    private String buildRawProfileData(
            StoredVideo storedVideo,
            String analyzerName,
            int signature,
            int sampleCount,
            long durationMs) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("originalFileName", storedVideo.originalFileName());
        payload.put("storagePath", storedVideo.storagePath());
        payload.put("contentType", storedVideo.contentType());
        payload.put("size", storedVideo.size());
        payload.put("analyzerName", analyzerName);
        payload.put("signature", signature);
        payload.put("sampleCount", sampleCount);
        payload.put("durationMs", durationMs);

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "紐⑥뀡 ?꾨줈???곗씠???앹꽦???ㅽ뙣?덉뒿?덈떎.");
        }
    }
}