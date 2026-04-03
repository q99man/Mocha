package com.motionchallenge.scoring.api;

import com.motionchallenge.attempt.application.AttemptSummaryResponse;
import com.motionchallenge.scoring.application.ScoringCompletionCommand;
import com.motionchallenge.scoring.application.ScoringCompletionService;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/scoring")
@ConditionalOnProperty(prefix = "app.scoring", name = "sample-stub-enabled", havingValue = "true")
public class ScoringStubController {

    private final ScoringCompletionService scoringCompletionService;

    public ScoringStubController(ScoringCompletionService scoringCompletionService) {
        this.scoringCompletionService = scoringCompletionService;
    }

    @PostMapping("/sample-completion")
    @ResponseStatus(HttpStatus.CREATED)
    public AttemptSummaryResponse createSampleCompletion(@Valid @RequestBody ScoringStubRequest request) {
        return scoringCompletionService.createCompletedAttemptFromScoring(new ScoringCompletionCommand(
                request.challengeId(),
                request.score(),
                normalizeNotes(request.notes())));
    }

    private String normalizeNotes(String notes) {
        if (notes == null || notes.isBlank()) {
            return "샘플 scoring 입력으로 저장한 완료 기록";
        }

        return notes;
    }
}