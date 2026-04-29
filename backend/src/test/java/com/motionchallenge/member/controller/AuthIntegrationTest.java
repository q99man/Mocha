package com.motionchallenge.member.controller;

import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.entity.AttemptVideo;
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

import static org.hamcrest.Matchers.containsString;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD;
import static org.springframework.http.HttpHeaders.ORIGIN;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
    void disabledOAuthProviderRedirectsToAuthFailureInsteadOf404() throws Exception {
        mockMvc.perform(get("/oauth2/authorization/kakao")
                        .param("redirect", "/challenges"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", containsString("/auth?error=social")))
                .andExpect(header().string("Location", containsString("social=failure")))
                .andExpect(header().string("Location", containsString("provider=kakao")))
                .andExpect(header().string("Location", containsString("reason=disabled")))
                .andExpect(header().string("Location", containsString("redirect=/challenges")));
    }

    @Test
    void corsAllowsLocalFrontendPortsForLoginPreflight() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                        .header(ORIGIN, "http://localhost:5174")
                        .header(ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5174"))
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
    }

    @Test
    void currentSessionReturnsNoContentWhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isNoContent());
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
    void challengeRetrySummaryIsScopedToCurrentMember() throws Exception {
        MvcResult adminResult = mockMvc.perform(post("/api/auth/register")
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

        MockHttpSession adminSession = (MockHttpSession) adminResult.getRequest().getSession(false);

        Challenge challenge = challengeRepository.save(new Challenge(
                "Scoped challenge",
                "Retry summary should stay per member",
                "test",
                "medium",
                null,
                null,
                18,
                true));
        Attempt uploadedAttempt = attemptRepository.save(new Attempt(
                challenge,
                memberRepository.findByEmail("admin@example.com").orElseThrow(),
                87,
                "Completed",
                "SYNC_INLINE",
                true,
                "Upload completed",
                "admin attempt",
                "Strong retry",
                null,
                84,
                79,
                81,
                "pose shape",
                "pose timing"));
        attemptVideoRepository.save(new AttemptVideo(
                uploadedAttempt,
                "attempt.mp4",
                "attempts/test-attempt.mp4",
                "video/mp4",
                128L));

        mockMvc.perform(get("/api/challenges/{id}", challenge.getId()).session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latestRetrySummary.latestAttemptId").isNumber());

        MvcResult memberResult = mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "member@example.com",
                                  "password": "password123",
                                  "displayName": "Member User"
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();

        MockHttpSession memberSession = (MockHttpSession) memberResult.getRequest().getSession(false);

        mockMvc.perform(get("/api/challenges/{id}", challenge.getId()).session(memberSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latestRetrySummary").doesNotExist());
    }

    @Test
    void adminMemberOverviewReturnsRoleCountsAndRecentMembers() throws Exception {
        MvcResult adminResult = mockMvc.perform(post("/api/auth/register")
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

        MockHttpSession adminSession = (MockHttpSession) adminResult.getRequest().getSession(false);

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "member-one@example.com",
                                  "password": "password123",
                                  "displayName": "Member One"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "member-two@example.com",
                                  "password": "password123",
                                  "displayName": "Member Two"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/admin/members/overview").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(3))
                .andExpect(jsonPath("$.adminCount").value(1))
                .andExpect(jsonPath("$.userCount").value(2))
                .andExpect(jsonPath("$.recentMembers[0].email").value("member-two@example.com"))
                .andExpect(jsonPath("$.recentMembers[1].email").value("member-one@example.com"))
                .andExpect(jsonPath("$.recentMembers[2].email").value("admin@example.com"));
    }

    @Test
    void adminMemberCrudApiSupportsCreateUpdateDelete() throws Exception {
        MvcResult adminResult = mockMvc.perform(post("/api/auth/register")
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

        MockHttpSession adminSession = (MockHttpSession) adminResult.getRequest().getSession(false);

        String createdBody = mockMvc.perform(post("/api/admin/members")
                        .session(adminSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "ops@example.com",
                                  "displayName": "Ops User",
                                  "password": "password123",
                                  "role": "USER"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("ops@example.com"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.canDelete").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String memberId = createdBody.replaceAll(".*\"id\":(\\d+).*", "$1");

        mockMvc.perform(get("/api/admin/members").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].email").value("ops@example.com"));

        mockMvc.perform(patch("/api/admin/members/{id}", memberId)
                        .session(adminSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "ops@example.com",
                                  "displayName": "Ops Manager",
                                  "role": "ADMIN",
                                  "password": "password999"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Ops Manager"))
                .andExpect(jsonPath("$.role").value("ADMIN"));

        mockMvc.perform(delete("/api/admin/members/{id}", memberId).session(adminSession))
                .andExpect(status().isNoContent());
    }

    @Test
    void adminCanUpdateUploadedModelAssetMetadata() throws Exception {
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
                .andReturn()
                .getResponse()
                .getContentAsString();

        String assetId = responseBody.replaceAll(".*\"id\":(\\d+).*", "$1");

        mockMvc.perform(patch("/api/admin/model-assets/pose-landmarker/{id}", assetId)
                        .session(session)
                        .contentType("application/json")
                        .content("""
                                {
                                  "versionLabel": "test-v2"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versionLabel").value("test-v2"))
                .andExpect(jsonPath("$.active").value(true));
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
