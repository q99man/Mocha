package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.entity.AttemptProcessingJobStatus;
import com.motionchallenge.challenge.entity.Challenge;
import org.springframework.stereotype.Component;

@Component
public class AttemptProcessingJobDraftFactory {

    public AttemptProcessingJob createPendingDraft(
            Challenge challenge,
            PendingAttemptVideoJob pendingJob,
            String processingMode,
            String runtimeState,
            String processingNotice) {
        return new AttemptProcessingJob(
                pendingJob.trackingId(),
                challenge,
                AttemptProcessingJobStatus.PENDING,
                processingMode,
                runtimeState,
                processingNotice,
                pendingJob.storedVideo().originalFileName());
    }

    // TODO: Wire this factory into the async pending flow when the in-memory registry is replaced
    // with durable progress persistence.
}