package com.motionchallenge.motion.service;

import java.util.List;
import java.util.Map;
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
                        "MediaPipe 브리지에서 빈 응답 본문이 반환되었습니다.");
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
                    "MediaPipe 브리지에 연결할 수 없습니다. FastAPI 서버 상태를 확인해 주세요.",
                    exception);
        } catch (RestClientResponseException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "MediaPipe 브리지에서 오류 응답을 반환했습니다: " + exception.getStatusCode(),
                    exception);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "분석 응답을 읽는 중 MediaPipe 브리지 호출에 실패했습니다.",
                    exception);
        }
    }

    private String buildUrl(MediaPipeBridgeRequest request) {
        String endpoint = request.endpoint();
        if (!StringUtils.hasText(endpoint)) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "MediaPipe 브리지 엔드포인트가 설정되어 있지 않습니다.");
        }

        return UriComponentsBuilder.fromUriString(endpoint)
                .path(request.analyzePath())
                .build()
                .toUriString();
    }

    private void validateResponse(MediaPipeHttpAnalyzeResponse response) {
        if (!StringUtils.hasText(response.provider())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MediaPipe 브리지 응답에 provider 값이 없습니다.");
        }
        if (!StringUtils.hasText(response.analyzerName())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MediaPipe 브리지 응답에 analyzerName 값이 없습니다.");
        }
        if (MotionAnalysisModeSupport.isStubAnalyzerName(response.analyzerName())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "MediaPipe HTTP bridge returned a stub analyzer response. Start the bridge in mediapipe mode.");
        }
        if (response.signature() == null || response.sampleCount() == null || response.durationMs() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "MediaPipe 브리지 응답에 필수 지표가 누락되어 있습니다.");
        }
    }
}
