package com.motionchallenge.challenge.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

abstract class AbstractMediaPipeBridgeIntegrationTest {

    private static HttpServer bridgeServer;
    private static int bridgePort;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @DynamicPropertySource
    static void registerBridgeProperties(DynamicPropertyRegistry registry) {
        ensureBridgeServerStarted();
        registry.add("app.motion.analysis.provider", () -> "mediapipe");
        registry.add("app.motion.analysis.mediapipe.endpoint", () -> "http://localhost:" + bridgePort);
        registry.add("app.motion.analysis.mediapipe.analyze-path", () -> "/api/v1/analyze");
    }

    private static synchronized void ensureBridgeServerStarted() {
        if (bridgeServer != null) {
            return;
        }
        try {
            bridgeServer = HttpServer.create(new InetSocketAddress(0), 0);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to start bridge test server.", exception);
        }
        bridgeServer.createContext("/api/v1/analyze", AbstractMediaPipeBridgeIntegrationTest::handleAnalyze);
        bridgeServer.start();
        bridgePort = bridgeServer.getAddress().getPort();
    }

    private static void handleAnalyze(HttpExchange exchange) throws IOException {
        JsonNode request = OBJECT_MAPPER.readTree(exchange.getRequestBody());
        String phase = request.path("analysisPhase").asText("reference");
        String fileName = request.path("sourceVideo").path("originalFileName").asText("video.mp4");
        String responseBody = buildResponse(phase, fileName);
        byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream outputStream = exchange.getResponseBody()) {
            outputStream.write(bytes);
        }
    }

    private static String buildResponse(String phase, String fileName) {
        int variant = variantFor(fileName, phase);
        double shoulderShift = variant * 0.012;
        double hipShift = variant * 0.01;
        int signature = 4281 + (variant * 137);

        return """
                {
                  "provider": "mediapipe",
                  "analyzerName": "mediapipe-fastapi-pose-v1",
                  "signature": %d,
                  "sampleCount": 3,
                  "durationMs": 18342,
                  "notes": ["Bridge integration test response is active."],
                  "landmarks": [
                    {
                      "frameIndex": 0,
                      "phase": "%s",
                      "points": [
                        {"name": "nose", "x": %.6f, "y": 0.180000, "z": -0.040000, "visibility": 0.980000},
                        {"name": "left_shoulder", "x": %.6f, "y": 0.310000, "z": -0.080000, "visibility": 0.960000},
                        {"name": "right_shoulder", "x": %.6f, "y": 0.300000, "z": -0.070000, "visibility": 0.950000},
                        {"name": "left_hip", "x": %.6f, "y": 0.550000, "z": -0.030000, "visibility": 0.930000},
                        {"name": "right_hip", "x": %.6f, "y": 0.540000, "z": -0.020000, "visibility": 0.920000}
                      ]
                    },
                    {
                      "frameIndex": 12,
                      "phase": "%s",
                      "points": [
                        {"name": "nose", "x": %.6f, "y": 0.170000, "z": -0.040000, "visibility": 0.970000},
                        {"name": "left_shoulder", "x": %.6f, "y": 0.300000, "z": -0.080000, "visibility": 0.950000},
                        {"name": "right_shoulder", "x": %.6f, "y": 0.290000, "z": -0.070000, "visibility": 0.950000},
                        {"name": "left_hip", "x": %.6f, "y": 0.540000, "z": -0.030000, "visibility": 0.920000},
                        {"name": "right_hip", "x": %.6f, "y": 0.530000, "z": -0.020000, "visibility": 0.910000}
                      ]
                    },
                    {
                      "frameIndex": 24,
                      "phase": "%s",
                      "points": [
                        {"name": "nose", "x": %.6f, "y": 0.190000, "z": -0.040000, "visibility": 0.980000},
                        {"name": "left_shoulder", "x": %.6f, "y": 0.320000, "z": -0.080000, "visibility": 0.960000},
                        {"name": "right_shoulder", "x": %.6f, "y": 0.310000, "z": -0.070000, "visibility": 0.950000},
                        {"name": "left_hip", "x": %.6f, "y": 0.560000, "z": -0.030000, "visibility": 0.930000},
                        {"name": "right_hip", "x": %.6f, "y": 0.550000, "z": -0.020000, "visibility": 0.920000}
                      ]
                    }
                  ],
                  "extras": {
                    "bridgeMode": "FASTAPI",
                    "analysisMode": "mediapipe",
                    "bridgeVersion": "v1",
                    "poseModel": "mediapipe-pose-landmarker",
                    "processedFrames": 3,
                    "framesWithPose": 3
                  }
                }
                """.formatted(
                signature,
                phase,
                0.510000 + (variant * 0.004),
                0.410000 + shoulderShift,
                0.620000 - shoulderShift,
                0.460000 + hipShift,
                0.570000 - hipShift,
                phase,
                0.500000 + (variant * 0.004),
                0.400000 + shoulderShift,
                0.610000 - shoulderShift,
                0.450000 + hipShift,
                0.560000 - hipShift,
                phase,
                0.520000 + (variant * 0.004),
                0.420000 + shoulderShift,
                0.630000 - shoulderShift,
                0.470000 + hipShift,
                0.580000 - hipShift);
    }

    private static int variantFor(String fileName, String phase) {
        if ("reference".equalsIgnoreCase(phase)) {
            return 0;
        }
        String normalized = fileName.toLowerCase(Locale.ROOT);
        if (normalized.contains("third")) {
            return 3;
        }
        if (normalized.contains("second")) {
            return 2;
        }
        if (normalized.contains("first")) {
            return 1;
        }
        if (normalized.contains("retry") || normalized.contains("attempt")) {
            return Math.abs(normalized.hashCode()) % 3 + 1;
        }
        return 1;
    }
}
