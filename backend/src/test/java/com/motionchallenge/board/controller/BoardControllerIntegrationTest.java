package com.motionchallenge.board.controller;

import com.motionchallenge.board.repository.BoardCommentRepository;
import com.motionchallenge.board.repository.BoardPostRepository;
import com.motionchallenge.member.repository.MemberRepository;
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
class BoardControllerIntegrationTest {

    private static final Pattern ID_PATTERN = Pattern.compile("\"id\":(\\d+)");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private BoardCommentRepository boardCommentRepository;

    @Autowired
    private BoardPostRepository boardPostRepository;

    @Autowired
    private MemberRepository memberRepository;

    @BeforeEach
    void resetData() {
        boardCommentRepository.deleteAllInBatch();
        boardPostRepository.deleteAllInBatch();
        memberRepository.deleteAllInBatch();
    }

    @Test
    void authenticatedUserCanManagePostAndCommentCrud() throws Exception {
        register("admin@example.com", "Admin User");
        MockHttpSession userSession = register("member@example.com", "Member User");

        String postId = extractId(mockMvc.perform(post("/api/board/posts")
                        .session(userSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "category": "FREE",
                                  "title": "First board post",
                                  "content": "Preparing the board CRUD flow.",
                                  "pinned": false
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("First board post"))
                .andExpect(jsonPath("$.mine").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString());

        String commentId = extractId(mockMvc.perform(post("/api/board/posts/{postId}/comments", postId)
                        .session(userSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "content": "First comment for this post."
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("First comment for this post."))
                .andExpect(jsonPath("$.mine").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString());

        mockMvc.perform(get("/api/board/posts?page=1&size=10&sourceType=GENERAL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].title").value("First board post"))
                .andExpect(jsonPath("$.items[0].authorDisplayName").value("Member User"))
                .andExpect(jsonPath("$.items[0].commentCount").value(1));

        mockMvc.perform(get("/api/board/posts/me").session(userSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].title").value("First board post"))
                .andExpect(jsonPath("$.items[0].commentCount").value(1));

        mockMvc.perform(get("/api/board/posts/{postId}", postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("First board post"))
                .andExpect(jsonPath("$.viewCount").value(1))
                .andExpect(jsonPath("$.commentCount").value(1));

        mockMvc.perform(get("/api/board/posts/{postId}/comments", postId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].content").value("First comment for this post."));

        mockMvc.perform(patch("/api/board/comments/{commentId}", commentId)
                        .session(userSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "content": "Updated board comment."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Updated board comment."));

        mockMvc.perform(patch("/api/board/posts/{postId}", postId)
                        .session(userSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "category": "QNA",
                                  "title": "Updated board post",
                                  "content": "Checking the update flow as well.",
                                  "pinned": false
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").value("QNA"))
                .andExpect(jsonPath("$.title").value("Updated board post"))
                .andExpect(jsonPath("$.commentCount").value(1));

        mockMvc.perform(delete("/api/board/comments/{commentId}", commentId).session(userSession))
                .andExpect(status().isNoContent());

        mockMvc.perform(delete("/api/board/posts/{postId}", postId).session(userSession))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/board/posts/{postId}", postId))
                .andExpect(status().isNotFound());
    }

    @Test
    void unauthenticatedUserCannotCreatePostOrComment() throws Exception {
        register("admin@example.com", "Admin User");
        MockHttpSession userSession = register("member@example.com", "Member User");

        String postId = extractId(mockMvc.perform(post("/api/board/posts")
                        .session(userSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "category": "FREE",
                                  "title": "Member post",
                                  "content": "Post for auth checks.",
                                  "pinned": false
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());

        mockMvc.perform(post("/api/board/posts")
                        .contentType("application/json")
                        .content("""
                                {
                                  "category": "FREE",
                                  "title": "Guest post",
                                  "content": "Guests should not create posts.",
                                  "pinned": false
                                }
                                """))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/board/posts/{postId}/comments", postId)
                        .contentType("application/json")
                        .content("""
                                {
                                  "content": "Guests should not create comments."
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void nonOwnerCannotUpdateAnotherUsersPostOrComment() throws Exception {
        register("admin@example.com", "Admin User");
        MockHttpSession ownerSession = register("owner@example.com", "Owner User");
        MockHttpSession otherSession = register("other@example.com", "Other User");

        String postId = extractId(mockMvc.perform(post("/api/board/posts")
                        .session(ownerSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "category": "FREE",
                                  "title": "Owner post",
                                  "content": "Only the owner should update this.",
                                  "pinned": false
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());

        String commentId = extractId(mockMvc.perform(post("/api/board/posts/{postId}/comments", postId)
                        .session(ownerSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "content": "Owner comment."
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());

        mockMvc.perform(patch("/api/board/posts/{postId}", postId)
                        .session(otherSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "category": "FREE",
                                  "title": "Unauthorized update",
                                  "content": "This should be rejected.",
                                  "pinned": false
                                }
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/board/comments/{commentId}", commentId)
                        .session(otherSession)
                        .contentType("application/json")
                        .content("""
                                {
                                  "content": "Unauthorized comment update."
                                }
                                """))
                .andExpect(status().isForbidden());
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
