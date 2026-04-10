package com.motionchallenge.scoring.application;

import com.motionchallenge.attempt.application.AttemptStatus;
import org.springframework.stereotype.Component;

@Component
public class SimpleScoringPreviewService {

    public SimpleScoringResult buildResult(String attemptStatus, int score) {
        if (!AttemptStatus.COMPLETED.equals(attemptStatus)) {
            return new SimpleScoringResult(
                    false,
                    "Prepared attempt saved.",
                    "This record is still in the prepared stage. Upload a real video to see an auto-scored comparison result.");
        }

        if (score >= 80) {
            return new SimpleScoringResult(
                    true,
                    "Strong match detected.",
                    "The current preview score suggests that the upload was recognized as close to the reference flow.");
        }

        if (score >= 60) {
            return new SimpleScoringResult(
                    true,
                    "Partial match detected.",
                    "The upload looks similar overall, but the engine still found noticeable differences.");
        }

        return new SimpleScoringResult(
                true,
                "Differences need review.",
                "The current preview score suggests that the upload differs meaningfully from the reference.");
    }
}