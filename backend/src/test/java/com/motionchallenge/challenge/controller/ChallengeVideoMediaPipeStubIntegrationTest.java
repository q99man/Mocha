package com.motionchallenge.challenge.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
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
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.storage.local-root=build/test-uploads-mediapipe-stub",
        "app.motion.analysis.provider=mediapipe",
        "app.motion.analysis.mediapipe.stub-enabled=true"
})
class ChallengeVideoMediaPipeStubIntegrationTest {

    private static final Path TEST_UPLOAD_ROOT = Path.of("build", "test-uploads-mediapipe-stub");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

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
    void challengeCreateAnalyzeAndAttemptUploadFlowWorksWithMediaPipeStubProvider() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.referenceMotionProfileReady").value(true))
                .andExpect(jsonPath("$.analyzerName").value("mediapipe-reference-adapter-stub"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-mediapipe-stub".getBytes());

        mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "mediapipe stub integration test attempt"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.status").isString())
                .andExpect(jsonPath("$.analyzerName").value("mediapipe-attempt-adapter-stub"))
                .andExpect(jsonPath("$.processingMode").value("SYNC_INLINE"))
                .andExpect(jsonPath("$.processingComplete").value(true))
                .andExpect(jsonPath("$.processingNotice").isString())
                .andExpect(jsonPath("$.videoOriginalFileName").value("attempt.mp4"))
                .andExpect(jsonPath("$.resultHeadline").isString())
                .andExpect(jsonPath("$.scoreAvailable").value(true))
                .andExpect(jsonPath("$.score").isNumber())
                .andExpect(jsonPath("$.score").value(org.hamcrest.Matchers.greaterThanOrEqualTo(0)))
                .andExpect(jsonPath("$.score").value(org.hamcrest.Matchers.lessThanOrEqualTo(100)));
    }

    private Long createChallengeWithReferenceVideo() throws Exception {
        MockMultipartFile referenceVideo = new MockMultipartFile(
                "referenceVideo",
                "reference.mp4",
                "video/mp4",
                "reference-video-content-for-mediapipe-stub".getBytes());

        MvcResult result = mockMvc.perform(multipart("/api/challenges")
                        .file(referenceVideo)
                        .param("title", "mediapipe stub reference challenge")
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
