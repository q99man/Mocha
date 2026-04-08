package com.motionchallenge.challenge.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
class ChallengeVideoMediaPipeHttpBridgeIntegrationTest {

    private static final Path TEST_UPLOAD_ROOT = Path.of("build", "test-uploads-mediapipe-http-bridge");

    private static HttpServer bridgeServer;
    private static int bridgePort;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        ensureBridgeServerStarted();
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        registry.add("app.storage.local-root", () -> "build/test-uploads-mediapipe-http-bridge");
        registry.add("app.motion.analysis.provider", () -> "mediapipe");
        registry.add("app.motion.analysis.mediapipe.stub-enabled", () -> "false");
        registry.add("app.motion.analysis.mediapipe.endpoint", () -> "http://localhost:" + bridgePort);
        registry.add("app.motion.analysis.mediapipe.analyze-path", () -> "/api/v1/analyze");
    }

    @AfterAll
    static void stopBridgeServer() {
        if (bridgeServer != null) {
            bridgeServer.stop(0);
            bridgeServer = null;
        }
    }

    @BeforeEach
    void cleanUploads() throws IOException {
        if (Files.exists(TEST_UPLOAD_ROOT)) {
            try (var paths = Files.walk(TEST_UPLOAD_ROOT)) {
                paths.sorted((left, right) -> right.compareTo(left))
                        .forEach(path -> {
                            try {
                                Files.deleteIfExists(path);
                            } catch (IOException ignored) {
                            }
                        });
            }
        }
    }

    @Test
    void challengeCreateAnalyzeAndAttemptUploadFlowWorksWithMediaPipeHttpBridge() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.referenceMotionProfileReady").value(true))
                .andExpect(jsonPath("$.analyzerName").value("mediapipe-fastapi-contract-stub"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-mediapipe-http-bridge".getBytes());

        mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "mediapipe http bridge integration test attempt"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.status").isString())
                .andExpect(jsonPath("$.analyzerName").value("mediapipe-fastapi-contract-stub"))
                .andExpect(jsonPath("$.processingMode").value("SYNC_INLINE"))
                .andExpect(jsonPath("$.processingComplete").value(true))
                .andExpect(jsonPath("$.processingNotice").isString())
                .andExpect(jsonPath("$.videoOriginalFileName").value("attempt.mp4"))
                .andExpect(jsonPath("$.resultHeadline").isString())
                .andExpect(jsonPath("$.scoreAvailable").value(true))
                .andExpect(jsonPath("$.score").isNumber());
    }

    private Long createChallengeWithReferenceVideo() throws Exception {
        MockMultipartFile referenceVideo = new MockMultipartFile(
                "referenceVideo",
                "reference.mp4",
                "video/mp4",
                "reference-video-content-for-mediapipe-http-bridge".getBytes());

        MvcResult result = mockMvc.perform(multipart("/api/challenges")
                        .file(referenceVideo)
                        .param("title", "mediapipe http bridge reference challenge")
                        .param("description", "integration test reference upload")
                        .param("category", "test")
                        .param("difficulty", "medium")
                        .param("durationSec", "18"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.referenceAnalysisStatus").value("NOT_ANALYZED"))
                .andExpect(jsonPath("$.referenceVideoUploaded").value(true))
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        Long challengeId = response.get("id").asLong();
        assertThat(challengeId).isPositive();
        return challengeId;
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

        bridgeServer.createContext("/api/v1/analyze", ChallengeVideoMediaPipeHttpBridgeIntegrationTest::handleAnalyze);
        bridgeServer.start();
        bridgePort = bridgeServer.getAddress().getPort();
    }

    private static void handleAnalyze(HttpExchange exchange) throws IOException {
        String responseBody = """
                {
                  "provider": "mediapipe",
                  "analyzerName": "mediapipe-fastapi-contract-stub",
                  "signature": 4281,
                  "sampleCount": 64,
                  "durationMs": 18342,
                  "notes": ["FastAPI contract bridge test stub is active."],
                  "landmarks": [],
                  "extras": {
                    "bridgeMode": "FASTAPI",
                    "bridgeVersion": "v1",
                    "poseModel": "mediapipe-pose"
                  }
                }
                """;
        byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream outputStream = exchange.getResponseBody()) {
            outputStream.write(bytes);
        }
    }
}
