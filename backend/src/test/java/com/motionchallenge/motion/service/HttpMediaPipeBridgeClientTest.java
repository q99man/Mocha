package com.motionchallenge.motion.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HttpMediaPipeBridgeClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void analyzePostsToConfiguredFastApiEndpointAndMapsResponse() throws Exception {
        AtomicReference<String> method = new AtomicReference<>();
        AtomicReference<String> contentType = new AtomicReference<>();
        AtomicReference<String> requestBody = new AtomicReference<>();
        HttpServer server = startServer(exchange -> {
            method.set(exchange.getRequestMethod());
            contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            writeJsonResponse(exchange, 200, """
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
                    """);
        });

        try {
            HttpMediaPipeBridgeClient client = new HttpMediaPipeBridgeClient(RestClient.builder());
            MediaPipeBridgeResponse response = client.analyze(new MediaPipeBridgeRequest(
                    "v1",
                    "reference",
                    "reference.mp4",
                    "uploads/challenges/1/reference.mp4",
                    "video/mp4",
                    2_483_201L,
                    "http://localhost:" + server.getAddress().getPort(),
                    "/api/v1/analyze",
                    5000L));

            assertThat(response.provider()).isEqualTo("mediapipe");
            assertThat(response.analyzerName()).isEqualTo("mediapipe-fastapi-v1");
            assertThat(response.signature()).isEqualTo(4281);
            assertThat(response.sampleCount()).isEqualTo(64);
            assertThat(response.durationMs()).isEqualTo(18342L);
            assertThat(response.notes()).containsExactly("Pose landmarks extracted successfully.");
            assertThat(response.extras()).containsEntry("bridgeMode", "FASTAPI");

            assertThat(method.get()).isEqualTo(HttpMethod.POST.name());
            assertThat(contentType.get()).startsWith("application/json");

            JsonNode payload = objectMapper.readTree(requestBody.get());
            assertThat(payload.path("schemaVersion").asText()).isEqualTo("v1");
            assertThat(payload.path("analysisPhase").asText()).isEqualTo("reference");
            assertThat(payload.path("sourceVideo").path("originalFileName").asText()).isEqualTo("reference.mp4");
            assertThat(payload.path("sourceVideo").path("storagePath").asText())
                    .isEqualTo("uploads/challenges/1/reference.mp4");
            assertThat(payload.path("sourceVideo").path("contentType").asText()).isEqualTo("video/mp4");
            assertThat(payload.path("sourceVideo").path("size").asLong()).isEqualTo(2_483_201L);
            assertThat(payload.path("runtime").path("timeoutMillis").asLong()).isEqualTo(5000L);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void analyzeRaisesBadGatewayWhenFastApiResponseMissesRequiredMetrics() throws Exception {
        HttpServer server = startServer(exchange -> writeJsonResponse(exchange, 200, """
                {
                  "provider": "mediapipe",
                  "analyzerName": "mediapipe-fastapi-v1",
                  "sampleCount": 64,
                  "notes": [],
                  "landmarks": [],
                  "extras": {}
                }
                """));

        try {
            HttpMediaPipeBridgeClient client = new HttpMediaPipeBridgeClient(RestClient.builder());
            assertThatThrownBy(() -> client.analyze(new MediaPipeBridgeRequest(
                    "v1",
                    "attempt",
                    "attempt.mp4",
                    "uploads/attempts/1/attempt.mp4",
                    "video/mp4",
                    1_824_000L,
                    "http://localhost:" + server.getAddress().getPort(),
                    "/api/v1/analyze",
                    5000L)))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> {
                        ResponseStatusException exception = (ResponseStatusException) error;
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
                        assertThat(exception.getReason()).contains("MediaPipe");
                    });
        } finally {
            server.stop(0);
        }
    }

    private HttpServer startServer(ThrowingHttpHandler handler) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/api/v1/analyze", exchange -> {
            try {
                handler.handle(exchange);
            } finally {
                exchange.close();
            }
        });
        server.start();
        return server;
    }

    private void writeJsonResponse(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] payload = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(statusCode, payload.length);
        try (OutputStream outputStream = exchange.getResponseBody()) {
            outputStream.write(payload);
        }
    }

    @FunctionalInterface
    private interface ThrowingHttpHandler {
        void handle(HttpExchange exchange) throws IOException;
    }
}
