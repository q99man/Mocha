package com.motionchallenge.review.controller;

import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.board.repository.BoardCommentRepository;
import com.motionchallenge.board.repository.BoardPostRepository;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.member.repository.MemberRepository;
import com.motionchallenge.review.repository.ReviewRepository;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class ReviewBoardSyncIntegrationTest {

    private static final Pattern ID_PATTERN = Pattern.compile("\"id\":(\\d+)");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AttemptRepository attemptRepository;

    @Autowired
    private BoardCommentRepository boardCommentRepository;

    @Autowired
    private BoardPostRepository boardPostRepository;

    @Autowired
    private ChallengeRepository challengeRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @BeforeEach
    void resetData() {
        boardCommentRepository.deleteAllInBatch();
        boardPostRepository.deleteAllInBatch();
        reviewRepository.deleteAllInBatch();
        attemptRepository.deleteAllInBatch();
        challengeRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    @Test
    void challengeReviewIsSyncedToBoardPostAndRemovedWithReview() throws Exception {
        register("admin@example.com", "Admin User");
        MockHttpSession userSession = register("member@example.com", "Member User");
        Challenge challenge = challengeRepository.save(new Challenge(
                "Balance Mission",
                "Keep your posture stable.",
                "Balance",
                "Normal",
                null,
                null,
                30,
                true));
        attemptRepository.save(new Attempt(
                challenge,
                memberRepository.findByEmail("member@example.com").orElseThrow(),
                92,
                "Completed",
                "completed review eligible"));

        String reviewId = extractId(mockMvc.perform(post("/api/challenges/{id}/reviews", challenge.getId())
                        .session(userSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "rating": 5,
                                  "content": "The posture guide was surprisingly clear."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challengeTitle").value("Balance Mission"))
                .andExpect(jsonPath("$.boardPostId").isNumber())
                .andReturn()
                .getResponse()
                .getContentAsString());

        mockMvc.perform(get("/api/board/posts?category=REVIEW&page=1&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].sourceType").value("REVIEW_SYNC"))
                .andExpect(jsonPath("$.items[0].challengeTitle").value("Balance Mission"))
                .andExpect(jsonPath("$.items[0].reviewRating").value(5));

        mockMvc.perform(get("/api/board/posts?sourceType=REVIEW_SYNC&page=1&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].sourceType").value("REVIEW_SYNC"));

        mockMvc.perform(get("/api/board/posts?sourceType=REVIEW_SYNC&challengeId={challengeId}&page=1&size=10", challenge.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].challengeId").value(challenge.getId()));

        mockMvc.perform(get("/api/board/posts?sourceType=REVIEW_SYNC&challengeId=999999&page=1&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(0));

        mockMvc.perform(get("/api/board/posts/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.generalCount").value(0))
                .andExpect(jsonPath("$.reviewCount").value(1))
                .andExpect(jsonPath("$.topReviewChallenges[0].challengeTitle").value("Balance Mission"))
                .andExpect(jsonPath("$.topReviewChallenges[0].reviewCount").value(1));

        String boardPostId = extractId(mockMvc.perform(get("/api/board/posts/me").session(userSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].sourceType").value("REVIEW_SYNC"))
                .andReturn()
                .getResponse()
                .getContentAsString());

        mockMvc.perform(get("/api/board/posts/{postId}", boardPostId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceType").value("REVIEW_SYNC"))
                .andExpect(jsonPath("$.challengeTitle").value("Balance Mission"))
                .andExpect(jsonPath("$.reviewRating").value(5))
                .andExpect(jsonPath("$.content").value("The posture guide was surprisingly clear."));

        mockMvc.perform(get("/api/challenges/{id}/reviews", challenge.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].boardPostId").value(Long.parseLong(boardPostId)));

        mockMvc.perform(get("/api/reviews?limit=6"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].boardPostId").value(Long.parseLong(boardPostId)));

        mockMvc.perform(get("/api/reviews/me").session(userSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].boardPostId").value(Long.parseLong(boardPostId)));

        mockMvc.perform(patch("/api/reviews/{reviewId}", reviewId)
                        .session(userSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "rating": 4,
                                  "content": "Updated review content for board sync."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").value(4))
                .andExpect(jsonPath("$.boardPostId").value(Long.parseLong(boardPostId)));

        mockMvc.perform(get("/api/board/posts/{postId}", boardPostId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewRating").value(4))
                .andExpect(jsonPath("$.content").value("Updated review content for board sync."));

        mockMvc.perform(delete("/api/reviews/{reviewId}", reviewId).session(userSession))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/board/posts?category=REVIEW&page=1&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(0));
    }

    private MockHttpSession register(String email, String displayName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "password123",
                                  "displayName": "%s"
                                }
                                """.formatted(email, displayName)))
                .andExpect(status().isCreated())
                .andReturn();

        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private String extractId(String responseBody) {
        Matcher matcher = ID_PATTERN.matcher(responseBody);
        if (!matcher.find()) {
            throw new IllegalStateException("Failed to extract id from response: " + responseBody);
        }
        return matcher.group(1);
    }
}
