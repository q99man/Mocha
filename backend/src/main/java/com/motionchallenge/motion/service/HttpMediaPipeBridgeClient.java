package com.motionchallenge.motion.service;

import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@ConditionalOnProperty(prefix = "app.motion.analysis.mediapipe", name = "stub-enabled", havingValue = "false", matchIfMissing = true)
public class HttpMediaPipeBridgeClient implements MediaPipeBridgeClient {

    private final RestClient restClient;

    public HttpMediaPipeBridgeClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    @Override
    public MediaPipeBridgeResponse analyze(MediaPipeBridgeRequest request) {
        String url = buildUrl(request);
        MediaPipeHttpAnalyzeRequest payload = new MediaPipeHttpAnalyzeRequest(
                request.schemaVersion(),
                request.analysisPhase(),
                new MediaPipeHttpAnalyzeRequest.SourceVideo(
                        request.originalFileName(),
                        request.storagePath(),
                        request.contentType(),
                        request.fileSize()),
                new MediaPipeHttpAnalyzeRequest.Runtime(request.timeoutMillis()));

        try {
            MediaPipeHttpAnalyzeResponse response = restClient.post()
                    .uri(url)
                    .body(payload)
                    .retrieve()
                    .body(MediaPipeHttpAnalyzeResponse.class);

            if (response == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "MediaPipe bridge returned an empty response body.");
            }

            validateResponse(response);
            return new MediaPipeBridgeResponse(
                    response.provider(),
                    response.analyzerName(),
                    response.signature(),
                    response.sampleCount(),
                    response.durationMs(),
                    response.notes() == null ? List.of() : response.notes(),
                    response.landmarks() == null ? List.of() : response.landmarks(),
                    response.extras() == null ? Map.of() : response.extras());
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (ResourceAccessException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "MediaPipe bridge is unreachable. Check FastAPI server availability.",
                    exception);
        } catch (RestClientResponseException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "MediaPipe bridge returned an error response: " + exception.getStatusCode(),
                    exception);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "MediaPipe bridge call failed while reading the analysis response.",
                    exception);
        }
    }

    private String buildUrl(MediaPipeBridgeRequest request) {
        String endpoint = request.endpoint();
        if (!StringUtils.hasText(endpoint)) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "MediaPipe bridge endpoint is not configured.");
        }

        return UriComponentsBuilder.fromUriString(endpoint)
                .path(request.analyzePath())
                .build()
                .toUriString();
    }

    private void validateResponse(MediaPipeHttpAnalyzeResponse response) {
        if (!StringUtils.hasText(response.provider())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MediaPipe bridge response is missing provider.");
        }
        if (!StringUtils.hasText(response.analyzerName())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MediaPipe bridge response is missing analyzerName.");
        }
        if (response.signature() == null || response.sampleCount() == null || response.durationMs() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "MediaPipe bridge response is missing required metrics.");
        }
    }
}
