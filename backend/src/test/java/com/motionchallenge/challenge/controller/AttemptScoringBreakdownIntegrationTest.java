package com.motionchallenge.challenge.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
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
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.storage.local-root=build/test-uploads-breakdown"
})
@WithMockUser(username = "admin@example.com", roles = "ADMIN")
class AttemptScoringBreakdownIntegrationTest {

    private static final Path TEST_UPLOAD_ROOT = Path.of("build", "test-uploads-breakdown");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

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
    void uploadedAttemptPersistsScoringBreakdownInCreateAndReadResponses() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/admin/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-breakdown".getBytes());

        MvcResult firstUploadResult = mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "breakdown integration test"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attemptId").isNumber())
                .andExpect(jsonPath("$.poseSimilarity").isNumber())
                .andExpect(jsonPath("$.timingSimilarity").isNumber())
                .andExpect(jsonPath("$.stabilitySimilarity").isNumber())
                .andExpect(jsonPath("$.strongestArea").isString())
                .andExpect(jsonPath("$.weakestArea").isString())
                .andExpect(jsonPath("$.previousAttemptId").doesNotExist())
                .andReturn();

        JsonNode firstUploadJson = objectMapper.readTree(firstUploadResult.getResponse().getContentAsString());
        long firstAttemptId = firstUploadJson.get("attemptId").asLong();
        assertThat(firstAttemptId).isPositive();

        mockMvc.perform(get("/api/attempts/{id}", firstAttemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(firstAttemptId))
                .andExpect(jsonPath("$.resultSummary").value(firstUploadJson.get("resultSummary").asText()))
                .andExpect(jsonPath("$.poseSimilarity").value(firstUploadJson.get("poseSimilarity").asInt()))
                .andExpect(jsonPath("$.timingSimilarity").value(firstUploadJson.get("timingSimilarity").asInt()))
                .andExpect(jsonPath("$.stabilitySimilarity").value(firstUploadJson.get("stabilitySimilarity").asInt()))
                .andExpect(jsonPath("$.strongestArea").value(firstUploadJson.get("strongestArea").asText()))
                .andExpect(jsonPath("$.weakestArea").value(firstUploadJson.get("weakestArea").asText()))
                .andExpect(jsonPath("$.previousAttemptId").doesNotExist());

        MockMultipartFile secondAttemptVideo = new MockMultipartFile(
                "attemptVideo",
                "attempt-second.mp4",
                "video/mp4",
                "attempt-video-content-for-breakdown-second".getBytes());

        MvcResult secondUploadResult = mockMvc.perform(multipart("/api/attempts/video")
                        .file(secondAttemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "breakdown integration test second run"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attemptId").isNumber())
                .andExpect(jsonPath("$.previousAttemptId").value(firstAttemptId))
                .andExpect(jsonPath("$.previousAttemptScore").value(firstUploadJson.get("score").asInt()))
                .andExpect(jsonPath("$.scoreDeltaFromPrevious").isNumber())
                .andReturn();

        JsonNode secondUploadJson = objectMapper.readTree(secondUploadResult.getResponse().getContentAsString());
        long secondAttemptId = secondUploadJson.get("attemptId").asLong();
        assertThat(secondAttemptId).isPositive();

        mockMvc.perform(get("/api/attempts/{id}", secondAttemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(secondAttemptId))
                .andExpect(jsonPath("$.resultSummary").value(secondUploadJson.get("resultSummary").asText()))
                .andExpect(jsonPath("$.previousAttemptId").value(firstAttemptId))
                .andExpect(jsonPath("$.previousAttemptScore").value(firstUploadJson.get("score").asInt()))
                .andExpect(jsonPath("$.scoreDeltaFromPrevious").value(secondUploadJson.get("scoreDeltaFromPrevious").asInt()))
                .andExpect(jsonPath("$.poseDeltaFromPrevious").value(secondUploadJson.get("poseDeltaFromPrevious").asInt()))
                .andExpect(jsonPath("$.timingDeltaFromPrevious").value(secondUploadJson.get("timingDeltaFromPrevious").asInt()))
                .andExpect(jsonPath("$.stabilityDeltaFromPrevious").value(secondUploadJson.get("stabilityDeltaFromPrevious").asInt()));
    }

    @Test
    void uploadResponseAndReadResponseUseSamePreviousAttemptWhenCreatedAtTies() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/admin/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        JsonNode firstUploadJson = objectMapper.readTree(mockMvc.perform(multipart("/api/attempts/video")
                        .file(new MockMultipartFile(
                                "attemptVideo",
                                "attempt-first.mp4",
                                "video/mp4",
                                "attempt-video-content-order-first".getBytes()))
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "ordering regression first run"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());

        JsonNode secondUploadJson = objectMapper.readTree(mockMvc.perform(multipart("/api/attempts/video")
                        .file(new MockMultipartFile(
                                "attemptVideo",
                                "attempt-second.mp4",
                                "video/mp4",
                                "attempt-video-content-order-second".getBytes()))
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "ordering regression second run"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());

        long firstAttemptId = firstUploadJson.get("attemptId").asLong();
        long secondAttemptId = secondUploadJson.get("attemptId").asLong();
        Timestamp tiedTimestamp = Timestamp.valueOf(LocalDateTime.of(2026, 1, 1, 10, 0, 0));
        jdbcTemplate.update("update attempts set created_at = ?, updated_at = ? where id = ?", tiedTimestamp, tiedTimestamp, firstAttemptId);
        jdbcTemplate.update("update attempts set created_at = ?, updated_at = ? where id = ?", tiedTimestamp, tiedTimestamp, secondAttemptId);

        MvcResult thirdUploadResult = mockMvc.perform(multipart("/api/attempts/video")
                        .file(new MockMultipartFile(
                                "attemptVideo",
                                "attempt-third.mp4",
                                "video/mp4",
                                "attempt-video-content-order-third".getBytes()))
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "ordering regression third run"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.previousAttemptId").value(secondAttemptId))
                .andReturn();

        JsonNode thirdUploadJson = objectMapper.readTree(thirdUploadResult.getResponse().getContentAsString());
        long thirdAttemptId = thirdUploadJson.get("attemptId").asLong();

        mockMvc.perform(get("/api/attempts/{id}", thirdAttemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previousAttemptId").value(secondAttemptId))
                .andExpect(jsonPath("$.scoreDeltaFromPrevious").value(thirdUploadJson.get("scoreDeltaFromPrevious").asInt()));

        mockMvc.perform(get("/api/challenges/{id}", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latestRetrySummary.latestAttemptId").value(thirdAttemptId))
                .andExpect(jsonPath("$.latestRetrySummary.scoreDeltaFromPrevious").value(thirdUploadJson.get("scoreDeltaFromPrevious").asInt()));
    }
    private Long createChallengeWithReferenceVideo() throws Exception {
        MockMultipartFile referenceVideo = new MockMultipartFile(
                "referenceVideo",
                "reference.mp4",
                "video/mp4",
                "reference-video-content-for-breakdown".getBytes());

        MvcResult result = mockMvc.perform(multipart("/api/admin/challenges")
                        .file(referenceVideo)
                        .param("title", "breakdown challenge")
                        .param("description", "integration test reference upload")
                        .param("category", "test")
                        .param("difficulty", "medium")
                        .param("durationSec", "18"))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        Long challengeId = response.get("id").asLong();
        assertThat(challengeId).isPositive();
        return challengeId;
    }
}


