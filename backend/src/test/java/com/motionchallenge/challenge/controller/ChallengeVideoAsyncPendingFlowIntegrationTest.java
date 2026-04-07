package com.motionchallenge.challenge.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.entity.AttemptProcessingJobStatus;
import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
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
        "app.storage.local-root=build/test-uploads-async",
        "app.attempt.video-processing-mode=async-pending-stub"
})
class ChallengeVideoAsyncPendingFlowIntegrationTest {

    private static final Path TEST_UPLOAD_ROOT = Path.of("build", "test-uploads-async");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AttemptProcessingJobRepository attemptProcessingJobRepository;

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
    void attemptUploadReturnsAsyncPendingStubResponse() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-async-stub".getBytes());

        mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "async pending integration test"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attemptId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.pendingTrackingId").isString())
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.status").isString())
                .andExpect(jsonPath("$.score").value(0))
                .andExpect(jsonPath("$.scoreAvailable").value(false))
                .andExpect(jsonPath("$.processingMode").value("ASYNC_JOB_PENDING"))
                .andExpect(jsonPath("$.processingComplete").value(false))
                .andExpect(jsonPath("$.processingNotice").isString())
                .andExpect(jsonPath("$.analyzerName").value("async-pending-stub"))
                .andExpect(jsonPath("$.resultHeadline").isString())
                .andExpect(jsonPath("$.resultSummary").isString())
                .andExpect(jsonPath("$.videoOriginalFileName").value("attempt.mp4"));
        mockMvc.perform(get("/api/challenges/{id}/motion-session", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runtimeState").value("UPLOAD_PENDING"));
    }

    @Test
    void asyncPendingCompletionStubCreatesCompletedAttemptAndUpdatesMotionSession() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-async-stub".getBytes());

        MvcResult pendingUploadResult = mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "async pending integration test"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pendingTrackingId").isString())
                .andExpect(jsonPath("$.processingMode").value("ASYNC_JOB_PENDING"))
                .andExpect(jsonPath("$.processingComplete").value(false))
                .andReturn();

        JsonNode pendingResponse = objectMapper.readTree(pendingUploadResult.getResponse().getContentAsString());
        String trackingId = pendingResponse.get("pendingTrackingId").asText();
        assertThat(trackingId).isNotBlank();

        MvcResult completionResult = mockMvc.perform(post("/api/scoring/async-pending-completion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" +
                                "\"challengeId\":" + challengeId + "," +
                                "\"trackingId\":\"" + trackingId + "\"," +
                                "\"notes\":\"async pending completion integration test\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attemptId").isNumber())
                .andExpect(jsonPath("$.pendingTrackingId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.status").isString())
                .andExpect(jsonPath("$.processingMode").value("SYNC_INLINE"))
                .andExpect(jsonPath("$.processingComplete").value(true))
                .andExpect(jsonPath("$.processingNotice").isString())
                .andExpect(jsonPath("$.analyzerName").value("mock-attempt-analyzer"))
                .andReturn();

        JsonNode completionResponse = objectMapper.readTree(completionResult.getResponse().getContentAsString());
        long attemptId = completionResponse.get("attemptId").asLong();
        assertThat(attemptId).isPositive();

        mockMvc.perform(get("/api/challenges/{id}/motion-session", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runtimeState").value("SCORING_COMPLETED"))
                .andExpect(jsonPath("$.latestAttemptId").value(attemptId))
                .andExpect(jsonPath("$.latestAttemptResultSource").value("VIDEO_UPLOAD_AUTOSCORED"))
                .andExpect(jsonPath("$.scoreAvailable").value(true));
    }
    private Long createChallengeWithReferenceVideo() throws Exception {
        MockMultipartFile referenceVideo = new MockMultipartFile(
                "referenceVideo",
                "reference.mp4",
                "video/mp4",
                "reference-video-content-for-demo".getBytes());

        MvcResult result = mockMvc.perform(multipart("/api/challenges")
                        .file(referenceVideo)
                        .param("title", "async pending challenge")
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