package com.motionchallenge.scoring.api;

import com.motionchallenge.scoring.application.AsyncPendingAttemptCompletionService;
import com.motionchallenge.scoring.application.ScoringCompletionService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ScoringStubControllerConditionalTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(ScoringStubController.class)
            .withBean(ScoringCompletionService.class, () -> mock(ScoringCompletionService.class))
            .withBean(AsyncPendingAttemptCompletionService.class, () -> mock(AsyncPendingAttemptCompletionService.class));

    @Test
    void sampleStubIsDisabledByDefault() {
        contextRunner.run(context -> assertThat(context).doesNotHaveBean(ScoringStubController.class));
    }

    @Test
    void sampleStubIsEnabledWhenPropertyIsTrue() {
        contextRunner
                .withPropertyValues("app.scoring.sample-stub-enabled=true")
                .run(context -> assertThat(context).hasSingleBean(ScoringStubController.class));
    }
}
