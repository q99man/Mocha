package com.motionchallenge.attempt.application;

import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AttemptFinalFeedbackServiceTest {

    private final AttemptFinalFeedbackService service = new AttemptFinalFeedbackService();

    @Test
    void strongScoredRunBuildsGreatFeedback() {
        AttemptFinalFeedbackResponse result = service.build(
                true,
                86,
                "pose shape",
                "pose timing",
                List.of(
                        cue(1, 1, "GOOD", 18, 0.82),
                        cue(2, 2, "GOOD", 12, 0.80),
                        cue(3, 3, "EARLY", -28, 0.72),
                        cue(4, 4, "GOOD", 10, 0.84),
                        cue(5, 0, "MISS", 88, 0.40)));

        assertThat(result).isNotNull();
        assertThat(result.grade()).isEqualTo("PERFECT");
        assertThat(result.cleared()).isTrue();
        assertThat(result.rhythmLabel()).isNotBlank();
    }

    @Test
    void looseRunDropsToPassWhenMissesStayHigh() {
        AttemptFinalFeedbackResponse result = service.build(
                true,
                77,
                "pose timing",
                "pose shape",
                List.of(
                        cue(1, 0, "MISS", 92, 0.33),
                        cue(2, 0, "MISS", 104, 0.28),
                        cue(3, 1, "EARLY", -40, 0.51),
                        cue(4, 0, "MISS", 97, 0.31),
                        cue(5, 0, "MISS", 88, 0.35)));

        assertThat(result).isNotNull();
        assertThat(result.grade()).isEqualTo("PASS");
        assertThat(result.cleared()).isFalse();
        assertThat(result.focusLabel()).contains("포즈");
    }

    private AttemptJudgementCueResponse cue(int id, int combo, String verdict, int offsetMs, double confidence) {
        return new AttemptJudgementCueResponse(
                id,
                id - 1,
                id,
                id * 500,
                220,
                0,
                false,
                combo,
                verdict,
                "motion-analysis",
                offsetMs,
                confidence);
    }
}
