package com.motionchallenge.motion.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class HttpMediaPipeBridgeClientTest {

    @Test
    void analyzePostsToConfiguredFastApiEndpointAndMapsResponse() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpMediaPipeBridgeClient client = new HttpMediaPipeBridgeClient(builder);

        server.expect(requestTo("http://localhost:8000/api/v1/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        {
                          "schemaVersion": "v1",
                          "analysisPhase": "reference",
                          "sourceVideo": {
                            "originalFileName": "reference.mp4",
                            "storagePath": "uploads/challenges/1/reference.mp4",
                            "contentType": "video/mp4",
                            "size": 2483201
                          },
                          "runtime": {
                            "timeoutMillis": 5000
                          }
                        }
                        """, true))
                .andRespond(withSuccess("""
                        {
                          "provider": "mediapipe",
                          "analyzerName": "mediapipe-fastapi-v1",
                          "signature": 4281,
                          "sampleCount": 64,
                          "durationMs": 18342,
                          "notes": ["Pose landmarks extracted successfully."],
                          "landmarks": [],
                          "extras": {
                            "bridgeMode": "FASTAPI",
                            "bridgeVersion": "v1"
                          }
                        }
                        """, MediaType.APPLICATION_JSON));

        MediaPipeBridgeResponse response = client.analyze(new MediaPipeBridgeRequest(
                "v1",
                "reference",
                "reference.mp4",
                "uploads/challenges/1/reference.mp4",
                "video/mp4",
                2_483_201L,
                "http://localhost:8000",
                "/api/v1/analyze",
                5000L));

        assertThat(response.provider()).isEqualTo("mediapipe");
        assertThat(response.analyzerName()).isEqualTo("mediapipe-fastapi-v1");
        assertThat(response.signature()).isEqualTo(4281);
        assertThat(response.sampleCount()).isEqualTo(64);
        assertThat(response.durationMs()).isEqualTo(18342L);
        assertThat(response.notes()).containsExactly("Pose landmarks extracted successfully.");
        assertThat(response.extras()).containsEntry("bridgeMode", "FASTAPI");

        server.verify();
    }

    @Test
    void analyzeRaisesBadGatewayWhenFastApiResponseMissesRequiredMetrics() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpMediaPipeBridgeClient client = new HttpMediaPipeBridgeClient(builder);

        server.expect(requestTo("http://localhost:8000/api/v1/analyze"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {
                          "provider": "mediapipe",
                          "analyzerName": "mediapipe-fastapi-v1",
                          "sampleCount": 64,
                          "notes": [],
                          "landmarks": [],
                          "extras": {}
                        }
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.analyze(new MediaPipeBridgeRequest(
                "v1",
                "attempt",
                "attempt.mp4",
                "uploads/attempts/1/attempt.mp4",
                "video/mp4",
                1_824_000L,
                "http://localhost:8000",
                "/api/v1/analyze",
                5000L)))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> {
                    ResponseStatusException exception = (ResponseStatusException) error;
                    assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(exception.getReason()).contains("missing required metrics");
                });

        server.verify();
    }
}
