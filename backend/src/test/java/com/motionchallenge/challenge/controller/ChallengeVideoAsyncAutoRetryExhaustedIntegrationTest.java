package com.motionchallenge.challenge.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.motion.service.MotionAnalysisService;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.storage.local-root=build/test-uploads-async-auto-exhausted",
        "app.attempt.video-processing-mode=async-pending-stub",
        "app.attempt.async-pending-auto-complete-enabled=true",
        "app.attempt.async-pending-auto-complete-delay-millis=50",
        "app.attempt.async-pending-auto-complete-retry-delay-millis=50",
        "app.attempt.async-pending-auto-complete-max-attempts=2"
})
class ChallengeVideoAsyncAutoRetryExhaustedIntegrationTest {

    private static final Path TEST_UPLOAD_ROOT = Path.of("build", "test-uploads-async-auto-exhausted");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @SpyBean
    private MotionAnalysisService motionAnalysisService;

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
    void asyncPendingJobMarksTerminalFailureWhenAutoRetryBudgetIsExhausted() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "auto-exhausted-attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-auto-exhausted".getBytes());

        doThrow(new RuntimeException("forced terminal analysis failure"))
                .when(motionAnalysisService)
                .analyzeAttemptVideo(any());

        MvcResult pendingUploadResult = mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "async auto exhausted integration test"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pendingTrackingId").isString())
                .andReturn();

        String trackingId = objectMapper
                .readTree(pendingUploadResult.getResponse().getContentAsString())
                .get("pendingTrackingId")
                .asText();
        assertThat(trackingId).isNotBlank();

        Thread.sleep(500L);

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId))
                        .param("trackingId", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId))
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.completionStrategy").value("AUTO_RUNNER"))
                .andExpect(jsonPath("$.runtimeState").value("FAILED_RETRYABLE"))
                .andExpect(jsonPath("$.failureCode").value("ANALYSIS_FAILED"))
                .andExpect(jsonPath("$.failureSeverity").value("WARN"))
                .andExpect(jsonPath("$.failureAction").value("RETRY_ANALYSIS"))
                .andExpect(jsonPath("$.retryRecommended").value(true))
                .andExpect(jsonPath("$.processingAttempts").value(2))
                .andExpect(jsonPath("$.retryCount").value(1))
                .andExpect(jsonPath("$.autoRetryEnabled").value(true))
                .andExpect(jsonPath("$.remainingAutoRetryCount").value(0))
                .andExpect(jsonPath("$.autoRetryExhausted").value(true))
                .andExpect(jsonPath("$.resultAttemptId").value(org.hamcrest.Matchers.nullValue()));

        mockMvc.perform(get("/api/challenges/{id}/motion-session", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runtimeState").value("FAILED_RETRYABLE"))
                .andExpect(jsonPath("$.lastFailureCode").value("ANALYSIS_FAILED"))
                .andExpect(jsonPath("$.failureSeverity").value("WARN"))
                .andExpect(jsonPath("$.failureAction").value("RETRY_ANALYSIS"))
                .andExpect(jsonPath("$.retryCount").value(1))
                .andExpect(jsonPath("$.autoRetryExhausted").value(true))
                .andExpect(jsonPath("$.inspectRecommended").value(true))
                .andExpect(jsonPath("$.terminalState").value("AUTO_RETRY_EXHAUSTED"))
                .andExpect(jsonPath("$.terminalMessage").isString());
    }

    private Long createChallengeWithReferenceVideo() throws Exception {
        MockMultipartFile referenceVideo = new MockMultipartFile(
                "referenceVideo",
                "reference.mp4",
                "video/mp4",
                "reference-video-content-for-auto-exhausted".getBytes());

        MvcResult result = mockMvc.perform(multipart("/api/challenges")
                        .file(referenceVideo)
                        .param("title", "async auto exhausted challenge")
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
}
