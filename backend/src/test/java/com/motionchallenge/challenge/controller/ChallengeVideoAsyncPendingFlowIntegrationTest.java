package com.motionchallenge.challenge.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.attempt.entity.AttemptProcessingJobStatus;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
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
    void pendingProgressStillResolvesFromDurableJobImmediately() throws Exception {
        Long challengeId = createAnalyzedChallengeWithPendingUpload("durable-first-attempt.mp4");

        MvcResult progressResult = mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId)))
                .andExpect(status().isOk())
                .andReturn();

        String trackingId = objectMapper
                .readTree(progressResult.getResponse().getContentAsString())
                .get("trackingId")
                .asText();
        assertThat(trackingId).isNotBlank();

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId))
                        .param("trackingId", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId))
                .andExpect(jsonPath("$.status").value(AttemptProcessingJobStatus.PENDING.name()))
                .andExpect(jsonPath("$.runtimeState").value("UPLOAD_PENDING"))
                .andExpect(jsonPath("$.originalFileName").value("durable-first-attempt.mp4"));
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

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId))
                        .param("trackingId", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId))
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.status").value(AttemptProcessingJobStatus.PENDING.name()))
                .andExpect(jsonPath("$.processingMode").value("ASYNC_JOB_PENDING"))
                .andExpect(jsonPath("$.completionStrategy").value("MANUAL_COMPLETION"))
                .andExpect(jsonPath("$.runtimeState").value("UPLOAD_PENDING"))
                .andExpect(jsonPath("$.processingNotice").isString())
                .andExpect(jsonPath("$.failureCode").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.failureSeverity").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.failureAction").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.retryRecommended").value(false))
                .andExpect(jsonPath("$.processingAttempts").value(0))
                .andExpect(jsonPath("$.retryCount").value(0))
                .andExpect(jsonPath("$.autoRetryEnabled").value(false))
                .andExpect(jsonPath("$.remainingAutoRetryCount").value(0))
                .andExpect(jsonPath("$.autoRetryExhausted").value(false))
                .andExpect(jsonPath("$.resultAttemptId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.originalFileName").value("attempt.mp4"))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString())
                .andExpect(jsonPath("$.elapsedSeconds").isNumber());

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

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId))
                        .param("trackingId", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId))
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.status").value(AttemptProcessingJobStatus.COMPLETED.name()))
                .andExpect(jsonPath("$.processingMode").value("ASYNC_JOB_PENDING"))
                .andExpect(jsonPath("$.completionStrategy").value("MANUAL_COMPLETION"))
                .andExpect(jsonPath("$.runtimeState").value("SCORING_COMPLETED"))
                .andExpect(jsonPath("$.processingNotice").isString())
                .andExpect(jsonPath("$.failureCode").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.failureSeverity").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.failureAction").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.retryRecommended").value(false))
                .andExpect(jsonPath("$.processingAttempts").value(1))
                .andExpect(jsonPath("$.retryCount").value(0))
                .andExpect(jsonPath("$.autoRetryEnabled").value(false))
                .andExpect(jsonPath("$.remainingAutoRetryCount").value(0))
                .andExpect(jsonPath("$.autoRetryExhausted").value(false))
                .andExpect(jsonPath("$.resultAttemptId").value(attemptId))
                .andExpect(jsonPath("$.originalFileName").value("attempt.mp4"))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString())
                .andExpect(jsonPath("$.elapsedSeconds").isNumber());

        mockMvc.perform(get("/api/challenges/{id}/motion-session", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runtimeState").value("SCORING_COMPLETED"))
                .andExpect(jsonPath("$.latestAttemptId").value(attemptId))
                .andExpect(jsonPath("$.latestAttemptResultSource").value("VIDEO_UPLOAD_AUTOSCORED"))
                .andExpect(jsonPath("$.scoreAvailable").value(true));
    }

    @Test
    void videoProcessingProgressReturnsNotFoundForUnknownTrackingId() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId))
                        .param("trackingId", "missing-tracking-id"))
                .andExpect(status().isNotFound());
    }

    @Test
    void videoProcessingProgressReturnsBadRequestWhenTrackingIdBelongsToAnotherChallenge() throws Exception {
        Long firstChallengeId = createAnalyzedChallengeWithPendingUpload("first-attempt.mp4");
        Long secondChallengeId = createChallengeWithReferenceVideo();

        MvcResult pendingUploadResult = mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(firstChallengeId)))
                .andExpect(status().isOk())
                .andReturn();

        String trackingId = objectMapper
                .readTree(pendingUploadResult.getResponse().getContentAsString())
                .get("trackingId")
                .asText();

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(secondChallengeId))
                        .param("trackingId", trackingId))
                .andExpect(status().isBadRequest());
    }

    @Test
    void videoProcessingProgressReturnsLatestJobWhenTrackingIdIsOmitted() throws Exception {
        Long challengeId = createAnalyzedChallengeWithPendingUpload("latest-attempt.mp4");

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.status").value(AttemptProcessingJobStatus.PENDING.name()))
                .andExpect(jsonPath("$.processingMode").value("ASYNC_JOB_PENDING"))
                .andExpect(jsonPath("$.completionStrategy").value("MANUAL_COMPLETION"))
                .andExpect(jsonPath("$.runtimeState").value("UPLOAD_PENDING"))
                .andExpect(jsonPath("$.failureSeverity").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.failureAction").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.retryRecommended").value(false))
                .andExpect(jsonPath("$.processingAttempts").value(0))
                .andExpect(jsonPath("$.retryCount").value(0))
                .andExpect(jsonPath("$.autoRetryEnabled").value(false))
                .andExpect(jsonPath("$.remainingAutoRetryCount").value(0))
                .andExpect(jsonPath("$.autoRetryExhausted").value(false))
                .andExpect(jsonPath("$.originalFileName").value("latest-attempt.mp4"))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString())
                .andExpect(jsonPath("$.elapsedSeconds").isNumber());
    }
    @Test
    void videoProcessingProgressByTrackingIdReturnsProgressWithoutChallengeId() throws Exception {
        Long challengeId = createAnalyzedChallengeWithPendingUpload("tracking-only-attempt.mp4");

        MvcResult progressResult = mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId)))
                .andExpect(status().isOk())
                .andReturn();

        String trackingId = objectMapper
                .readTree(progressResult.getResponse().getContentAsString())
                .get("trackingId")
                .asText();

        mockMvc.perform(get("/api/attempts/video-processing-progress/{trackingId}", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId))
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.status").value(AttemptProcessingJobStatus.PENDING.name()))
                .andExpect(jsonPath("$.processingMode").value("ASYNC_JOB_PENDING"))
                .andExpect(jsonPath("$.completionStrategy").value("MANUAL_COMPLETION"));
    }


    @Test
    void asyncPendingCompletionFailureUpdatesProgressAndMotionSession() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "failing-attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-failure".getBytes());

        MvcResult pendingUploadResult = mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "async pending failure integration test"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pendingTrackingId").isString())
                .andReturn();

        String trackingId = objectMapper
                .readTree(pendingUploadResult.getResponse().getContentAsString())
                .get("pendingTrackingId")
                .asText();

        doThrow(new RuntimeException("forced analysis failure"))
                .when(motionAnalysisService)
                .analyzeAttemptVideo(any());

        mockMvc.perform(post("/api/scoring/async-pending-completion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" +
                                "\"challengeId\":" + challengeId + "," +
                                "\"trackingId\":\"" + trackingId + "\"," +
                                "\"notes\":\"async pending failure integration test\"}"))
                .andExpect(status().is5xxServerError());

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId))
                        .param("trackingId", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackingId").value(trackingId))
                .andExpect(jsonPath("$.status").value(AttemptProcessingJobStatus.FAILED.name()))
                .andExpect(jsonPath("$.completionStrategy").value("MANUAL_COMPLETION"))
                .andExpect(jsonPath("$.runtimeState").value("FAILED_RETRYABLE"))
                .andExpect(jsonPath("$.failureCode").value("ANALYSIS_FAILED"))
                .andExpect(jsonPath("$.failureSeverity").value("WARN"))
                .andExpect(jsonPath("$.failureAction").value("RETRY_ANALYSIS"))
                .andExpect(jsonPath("$.retryRecommended").value(true))
                .andExpect(jsonPath("$.processingAttempts").value(1))
                .andExpect(jsonPath("$.retryCount").value(0))
                .andExpect(jsonPath("$.autoRetryEnabled").value(false))
                .andExpect(jsonPath("$.remainingAutoRetryCount").value(0))
                .andExpect(jsonPath("$.autoRetryExhausted").value(false))
                .andExpect(jsonPath("$.resultAttemptId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString())
                .andExpect(jsonPath("$.elapsedSeconds").isNumber());

        mockMvc.perform(get("/api/challenges/{id}/motion-session", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runtimeState").value("FAILED_RETRYABLE"))
                .andExpect(jsonPath("$.lastFailureCode").value("ANALYSIS_FAILED"))
                .andExpect(jsonPath("$.lastFailureMessage").isString());
    }

    @Test
    void asyncPendingRetryIncrementsAttemptsAndRetryCount() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "retry-attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-retry".getBytes());

        MvcResult pendingUploadResult = mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "async retry integration test"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pendingTrackingId").isString())
                .andReturn();

        String trackingId = objectMapper
                .readTree(pendingUploadResult.getResponse().getContentAsString())
                .get("pendingTrackingId")
                .asText();

        doThrow(new RuntimeException("forced retryable analysis failure"))
                .when(motionAnalysisService)
                .analyzeAttemptVideo(any());

        mockMvc.perform(post("/api/scoring/async-pending-completion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" +
                                "\"challengeId\":" + challengeId + "," +
                                "\"trackingId\":\"" + trackingId + "\"," +
                                "\"notes\":\"first failure before retry\"}"))
                .andExpect(status().is5xxServerError());

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId))
                        .param("trackingId", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(AttemptProcessingJobStatus.FAILED.name()))
                .andExpect(jsonPath("$.processingAttempts").value(1))
                .andExpect(jsonPath("$.retryCount").value(0));

        reset(motionAnalysisService);

        MvcResult retryCompletionResult = mockMvc.perform(post("/api/scoring/async-pending-completion")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" +
                                "\"challengeId\":" + challengeId + "," +
                                "\"trackingId\":\"" + trackingId + "\"," +
                                "\"notes\":\"retry completion after failure\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attemptId").isNumber())
                .andReturn();

        long attemptId = objectMapper
                .readTree(retryCompletionResult.getResponse().getContentAsString())
                .get("attemptId")
                .asLong();

        mockMvc.perform(get("/api/attempts/video-processing-progress")
                        .param("challengeId", String.valueOf(challengeId))
                        .param("trackingId", trackingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(AttemptProcessingJobStatus.COMPLETED.name()))
                .andExpect(jsonPath("$.processingAttempts").value(2))
                .andExpect(jsonPath("$.retryCount").value(1))
                .andExpect(jsonPath("$.resultAttemptId").value(attemptId));

        mockMvc.perform(get("/api/challenges/{id}/motion-session", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runtimeState").value("SCORING_COMPLETED"))
                .andExpect(jsonPath("$.latestAttemptId").value(attemptId));
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

    private Long createAnalyzedChallengeWithPendingUpload(String fileName) throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                fileName,
                "video/mp4",
                ("attempt-video-content-" + fileName).getBytes());

        mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "pending upload setup"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pendingTrackingId").isString())
                .andExpect(jsonPath("$.processingMode").value("ASYNC_JOB_PENDING"))
                .andExpect(jsonPath("$.processingComplete").value(false));

        return challengeId;
    }
}
