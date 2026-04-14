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
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.storage.local-root=build/test-uploads"
})
@WithMockUser(username = "admin@example.com", roles = "ADMIN")
class ChallengeVideoFlowIntegrationTest extends AbstractMediaPipeBridgeIntegrationTest {

    private static final Path TEST_UPLOAD_ROOT = Path.of("build", "test-uploads");
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
    void challengeCreateAnalyzeAndAttemptUploadFlowWorks() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/admin/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.referenceMotionProfileReady").value(true))
                .andExpect(jsonPath("$.analyzerName").value("mediapipe-fastapi-pose-v1"));

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-demo".getBytes());

        mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId))
                        .param("notes", "integration test attempt"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.challengeId").value(challengeId))
                .andExpect(jsonPath("$.status").isString())
                .andExpect(jsonPath("$.analyzerName").value("mediapipe-fastapi-pose-v1"))
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

    @Test
    void attemptUploadFailsWhenReferenceAnalysisIsMissing() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        MockMultipartFile attemptVideo = new MockMultipartFile(
                "attemptVideo",
                "attempt.mp4",
                "video/mp4",
                "attempt-video-content-for-demo".getBytes());

        mockMvc.perform(multipart("/api/attempts/video")
                        .file(attemptVideo)
                        .param("challengeId", String.valueOf(challengeId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void challengeDeleteRemovesChallengeFromActiveQueries() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(delete("/api/admin/challenges/{id}", challengeId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/challenges/{id}", challengeId))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/challenges"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == %s)]", challengeId).doesNotExist());
    }

    @Test
    void challengeUpdateChangesFieldsAndCanReplaceReferenceVideo() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(post("/api/admin/challenges/{id}/analyze-reference", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisStatus").value("COMPLETED"));

        MockMultipartFile replacementReferenceVideo = new MockMultipartFile(
                "referenceVideo",
                "replacement.mp4",
                "video/mp4",
                "replacement-reference-video".getBytes());

        mockMvc.perform(multipart("/api/admin/challenges/{id}", challengeId)
                        .file(replacementReferenceVideo)
                        .param("title", "updated challenge title")
                        .param("description", "updated challenge description")
                        .param("category", "updated category")
                        .param("difficulty", "hard")
                        .param("durationSec", "33")
                        .param("thumbnailUrl", "https://example.com/thumb.png")
                        .param("guideVideoUrl", "https://example.com/guide.mp4")
                        .with(request -> {
                            request.setMethod("PUT");
                            return request;
                        }))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("updated challenge title"))
                .andExpect(jsonPath("$.description").value("updated challenge description"))
                .andExpect(jsonPath("$.category").value("updated category"))
                .andExpect(jsonPath("$.difficulty").value("hard"))
                .andExpect(jsonPath("$.durationSec").value(33))
                .andExpect(jsonPath("$.thumbnailUrl").value("https://example.com/thumb.png"))
                .andExpect(jsonPath("$.guideVideoUrl").value("https://example.com/guide.mp4"))
                .andExpect(jsonPath("$.referenceAnalysisStatus").value("NOT_ANALYZED"))
                .andExpect(jsonPath("$.referenceVideoOriginalFileName").value("replacement.mp4"))
                .andExpect(jsonPath("$.referenceMotionProfileReady").value(false));
    }

    @Test
    void challengeActivePatchTogglesVisibilityFromActiveQueries() throws Exception {
        Long challengeId = createChallengeWithReferenceVideo();

        mockMvc.perform(patch("/api/admin/challenges/{id}/active", challengeId)
                        .contentType("application/json")
                        .content("{\"isActive\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(challengeId))
                .andExpect(jsonPath("$.isActive").value(false));

        mockMvc.perform(get("/api/challenges/{id}", challengeId))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/challenges"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == %s)]", challengeId).doesNotExist());

        mockMvc.perform(patch("/api/admin/challenges/{id}/active", challengeId)
                        .contentType("application/json")
                        .content("{\"isActive\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isActive").value(true));

        mockMvc.perform(get("/api/challenges/{id}", challengeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(challengeId))
                .andExpect(jsonPath("$.isActive").value(true));
    }

    private Long createChallengeWithReferenceVideo() throws Exception {
        MockMultipartFile referenceVideo = new MockMultipartFile(
                "referenceVideo",
                "reference.mp4",
                "video/mp4",
                "reference-video-content-for-demo".getBytes());

        MvcResult result = mockMvc.perform(multipart("/api/admin/challenges")
                        .file(referenceVideo)
                        .param("title", "test reference challenge")
                        .param("description", "integration test reference upload")
                        .param("category", "test")
                        .param("difficulty", "medium")
                        .param("durationSec", "18"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.referenceAnalysisStatus").value("NOT_ANALYZED"))
                .andExpect(jsonPath("$.referenceVideoUploaded").value(true))
                .andExpect(jsonPath("$.fallbackThumbnailVideoUrl").value(org.hamcrest.Matchers.startsWith("/uploads/challenges/")))
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        Long challengeId = response.get("id").asLong();
        assertThat(challengeId).isPositive();
        return challengeId;
    }
}
