package com.motionchallenge.scoring.api;

import com.motionchallenge.attempt.application.AttemptResultResponse;
import com.motionchallenge.scoring.application.AsyncPendingAttemptCompletionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/scoring")
public class AsyncPendingAttemptController {

    private final AsyncPendingAttemptCompletionService asyncPendingAttemptCompletionService;

    public AsyncPendingAttemptController(AsyncPendingAttemptCompletionService asyncPendingAttemptCompletionService) {
        this.asyncPendingAttemptCompletionService = asyncPendingAttemptCompletionService;
    }

    @PostMapping("/async-pending-completion")
    @ResponseStatus(HttpStatus.CREATED)
    public AttemptResultResponse completeAsyncPendingUpload(@Valid @RequestBody AsyncPendingCompletionRequest request) {
        return asyncPendingAttemptCompletionService.completePendingAttempt(
                request.challengeId(),
                request.trackingId(),
                request.notes());
    }
}
