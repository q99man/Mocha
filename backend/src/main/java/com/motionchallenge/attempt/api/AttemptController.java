package com.motionchallenge.attempt.api;

import com.motionchallenge.attempt.application.AttemptCreateRequest;
import com.motionchallenge.attempt.application.AttemptProcessingJobProgressResponse;
import com.motionchallenge.attempt.application.AttemptResultResponse;
import com.motionchallenge.attempt.application.AttemptService;
import com.motionchallenge.attempt.application.AttemptSummaryResponse;
import com.motionchallenge.attempt.application.AttemptVideoUploadRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/attempts")
public class AttemptController {

    private final AttemptService attemptService;

    public AttemptController(AttemptService attemptService) {
        this.attemptService = attemptService;
    }

    @GetMapping
    public List<AttemptSummaryResponse> getAttempts() {
        return attemptService.getAttempts();
    }

    @GetMapping("/{id}")
    public AttemptSummaryResponse getAttempt(@PathVariable Long id) {
        return attemptService.getAttempt(id);
    }

    // Fallback-only endpoint. Prefer trackingId direct lookup for active UI flows.
    @GetMapping("/video-processing-progress")
    public AttemptProcessingJobProgressResponse getAttemptVideoProcessingProgressFallback(
            @RequestParam Long challengeId,
            @RequestParam(required = false) String trackingId) {
        return attemptService.getAttemptVideoProcessingProgressFallback(challengeId, trackingId);
    }

    @GetMapping("/video-processing-progress/{trackingId}")
    public AttemptProcessingJobProgressResponse getAttemptVideoProcessingProgressByTrackingId(@PathVariable String trackingId) {
        return attemptService.getAttemptVideoProcessingProgressByTrackingId(trackingId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AttemptSummaryResponse createAttempt(@Valid @RequestBody AttemptCreateRequest request) {
        return attemptService.createPrototypeAttempt(request);
    }

    @PostMapping(value = "/video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AttemptResultResponse submitAttemptVideo(@Valid @ModelAttribute AttemptVideoUploadRequest request) {
        return attemptService.submitAttemptVideo(request);
    }
}
