package com.motionchallenge.member.controller;

import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.attempt.repository.AttemptVideoRepository;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.member.repository.MemberRepository;
import org.springframework.mock.web.MockMultipartFile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
        "app.storage.local-root=build/test-uploads",
        "app.motion.analysis.mediapipe.model-directory=build/test-models"
})
@Transactional
class AuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private AttemptVideoRepository attemptVideoRepository;

    @Autowired
    private AttemptProcessingJobRepository attemptProcessingJobRepository;

    @Autowired
    private AttemptRepository attemptRepository;

    @Autowired
    private ChallengeRepository challengeRepository;

    @BeforeEach
    void resetMembers() {
        attemptVideoRepository.deleteAllInBatch();
        attemptProcessingJobRepository.deleteAllInBatch();
        attemptRepository.deleteAllInBatch();
        challengeRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    @Test
    void firstRegisteredMemberBecomesAdminAndCanAccessAdminApi() throws Exception {
        MvcResult registerResult = mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "admin@example.com",
                                  "password": "password123",
                                  "displayName": "Admin User"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("admin@example.com"))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andReturn();

        MockHttpSession session = (MockHttpSession) registerResult.getRequest().getSession(false);

        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.displayName").value("Admin User"));

        mockMvc.perform(get("/api/admin/model-assets/pose-landmarker").session(session))
                .andExpect(status().isOk());
    }

    @Test
    void unauthenticatedAdminApiRequestIsRejected() throws Exception {
        mockMvc.perform(get("/api/admin/model-assets/pose-landmarker"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanDeleteUploadedModelAsset() throws Exception {
        MvcResult registerResult = mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "admin@example.com",
                                  "password": "password123",
                                  "displayName": "Admin User"
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        MockHttpSession session = (MockHttpSession) registerResult.getRequest().getSession(false);
        MockMultipartFile modelFile = new MockMultipartFile(
                "modelFile",
                "pose_landmarker_lite.task",
                "application/octet-stream",
                "fake-model".getBytes());

        String responseBody = mockMvc.perform(multipart("/api/admin/model-assets/pose-landmarker")
                        .file(modelFile)
                        .param("versionLabel", "test-v1")
                        .session(session))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String assetId = responseBody.replaceAll(".*\"id\":(\\d+).*", "$1");

        mockMvc.perform(delete("/api/admin/model-assets/pose-landmarker/{id}", assetId).session(session))
                .andExpect(status().isNoContent());
    }

    @Test
    void secondRegisteredMemberBecomesUser() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "admin@example.com",
                                  "password": "password123",
                                  "displayName": "Admin User"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "member@example.com",
                                  "password": "password123",
                                  "displayName": "Member User"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void adminChallengeApiReturnsInactiveChallengesForAdminConsole() throws Exception {
        MvcResult registerResult = mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "admin@example.com",
                                  "password": "password123",
                                  "displayName": "Admin User"
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        MockHttpSession session = (MockHttpSession) registerResult.getRequest().getSession(false);

        Challenge activeChallenge = challengeRepository.save(new Challenge(
                "Active Challenge",
                "Visible challenge",
                "퍼포먼스",
                "보통",
                null,
                null,
                30,
                true));
        Challenge inactiveChallenge = challengeRepository.save(new Challenge(
                "Inactive Challenge",
                "Hidden from public catalog",
                "테스트",
                "쉬움",
                null,
                null,
                20,
                false));

        mockMvc.perform(get("/api/admin/challenges").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == %s)].title".formatted(activeChallenge.getId())).value("Active Challenge"))
                .andExpect(jsonPath("$[?(@.id == %s)].title".formatted(inactiveChallenge.getId())).value("Inactive Challenge"));

        mockMvc.perform(get("/api/challenges"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == %s)]".formatted(inactiveChallenge.getId())).isEmpty());
    }
}
