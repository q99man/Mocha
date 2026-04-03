package com.motionchallenge.scoring.application;

import com.motionchallenge.attempt.application.AttemptService;
import com.motionchallenge.attempt.application.AttemptSummaryResponse;
import com.motionchallenge.attempt.application.CompletedAttemptCommand;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ScoringCompletionService {

    private final AttemptService attemptService;

    public ScoringCompletionService(AttemptService attemptService) {
        this.attemptService = attemptService;
    }

    public AttemptSummaryResponse createCompletedAttemptFromScoring(ScoringCompletionCommand command) {
        return attemptService.createCompletedAttempt(new CompletedAttemptCommand(
                command.challengeId(),
                command.score(),
                command.notes()));
    }
}