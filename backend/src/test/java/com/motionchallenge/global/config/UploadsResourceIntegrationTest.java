package com.motionchallenge.global.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.storage.local-root=build/test-uploads"
})
class UploadsResourceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void missingUploadVideoReturnsEmptyNotFoundInsteadOfJsonErrorBody() throws Exception {
        mockMvc.perform(get("/uploads/missing-video.mp4").accept(MediaType.valueOf("video/mp4")))
                .andExpect(status().isNotFound())
                .andExpect(content().string(""));
    }
}
