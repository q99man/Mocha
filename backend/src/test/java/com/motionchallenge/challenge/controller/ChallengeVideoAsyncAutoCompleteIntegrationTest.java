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
@ActiveProfiles("mysql")
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.storage.local-root=build/test-uploads-async-auto",
        "app.attempt.video-processing-mode=async-pending-stub",
        "app.attempt.async-pending-auto-complete-enabled=true",
        "app.attempt.async-pending-auto-complete-delay-millis=50",
        "app.attempt.async-pending-auto-complete-retry-delay-millis=50",
        "app.attempt.async-pending-auto-complete-max-attempts=3"
})
class ChallengeVideoAsyncAutoCompleteIntegrationTest {

    private static final Path TEST_UPLOAD_ROOT = Path.of("build", "test-uploads-async-auto");

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
    void asyncPendingJobAutoCompletesInBackground() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "auto-attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-auto-complete".getBytes());

        MvcResult pendingUploadResult = mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "async auto completion integration test"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pendingTrackingId").isString())
                .andExpect(jsonPath("$.processingMode").value("ASYNC_JOB_PENDING"))
                .andExpect(jsonPath("$.processingComplete").value(false))
                .andReturn();

        String trackingId = objectMapper
                .readTree(pendingUploadResult.getResponse().getContentAsString())
                .get("pendingTrackingId")
                .asText();
        assertThat(trackingId).isNotBlank();

        Thread.sleep(400L);

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId))
                        .param("trackingId", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completionStrategy").value("AUTO_RUNNER"))
                .andExpect(jsonPath("$.runtimeState").value("SCORING_COMPLETED"))
                .andExpect(jsonPath("$.failureSeverity").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.failureAction").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.retryRecommended").value(false))
                .andExpect(jsonPath("$.processingAttempts").value(1))
                .andExpect(jsonPath("$.retryCount").value(0))
                .andExpect(jsonPath("$.autoRetryEnabled").value(true))
                .andExpect(jsonPath("$.remainingAutoRetryCount").value(2))
                .andExpect(jsonPath("$.autoRetryExhausted").value(false))
                .andExpect(jsonPath("$.resultAttemptId").isNumber())
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString())
                .andExpect(jsonPath("$.elapsedSeconds").isNumber());

        mockMvc.perform(get("/api/challenges/{id}/motion-session", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runtimeState").value("SCORING_COMPLETED"))
                .andExpect(jsonPath("$.latestAttemptResultSource").value("VIDEO_UPLOAD_AUTOSCORED"))
                .andExpect(jsonPath("$.scoreAvailable").value(true));
    }

    @Test
    void asyncPendingJobAutoCompletesInBackgroundFromDurableJob() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "auto-no-registry-attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-auto-no-registry".getBytes());

        MvcResult pendingUploadResult = mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "async auto no registry integration test"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pendingTrackingId").isString())
                .andReturn();

        String trackingId = objectMapper
                .readTree(pendingUploadResult.getResponse().getContentAsString())
                .get("pendingTrackingId")
                .asText();
        assertThat(trackingId).isNotBlank();

        Thread.sleep(450L);

        mockMvc.perform(get("/api/attempts/video-processing-progress/{trackingId}", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completionStrategy").value("AUTO_RUNNER"))
                .andExpect(jsonPath("$.runtimeState").value("SCORING_COMPLETED"))
                .andExpect(jsonPath("$.resultAttemptId").isNumber())
                .andExpect(jsonPath("$.originalFileName").value("auto-no-registry-attempt.mp4"));
    }

    @Test
    void asyncPendingJobRetriesInBackgroundAfterSingleFailure() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "auto-retry-attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-auto-retry".getBytes());

        doThrow(new RuntimeException("forced auto retry failure"))
                .doCallRealMethod()
                .when(motionAnalysisService)
                .analyzeAttemptVideo(any());

        MvcResult pendingUploadResult = mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "async auto retry integration test"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pendingTrackingId").isString())
                .andReturn();

        String trackingId = objectMapper
                .readTree(pendingUploadResult.getResponse().getContentAsString())
                .get("pendingTrackingId")
                .asText();
        assertThat(trackingId).isNotBlank();

        Thread.sleep(650L);

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId))
                        .param("trackingId", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.completionStrategy").value("AUTO_RUNNER"))
                .andExpect(jsonPath("$.runtimeState").value("SCORING_COMPLETED"))
                .andExpect(jsonPath("$.processingAttempts").value(2))
                .andExpect(jsonPath("$.retryCount").value(1))
                .andExpect(jsonPath("$.autoRetryEnabled").value(true))
                .andExpect(jsonPath("$.remainingAutoRetryCount").value(1))
                .andExpect(jsonPath("$.autoRetryExhausted").value(false))
                .andExpect(jsonPath("$.resultAttemptId").isNumber());
    }

    private Long createChallengeWithReferenceVideo() throws Exception {
        MockMultipartFile referenceVideo = new MockMultipartFile(
                "referenceVideo",
                "reference.mp4",
                "video/mp4",
                "reference-video-content-for-auto".getBytes());

        MvcResult result = mockMvc.perform(multipart("/api/challenges")
                        .file(referenceVideo)
                        .param("title", "async auto challenge")
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