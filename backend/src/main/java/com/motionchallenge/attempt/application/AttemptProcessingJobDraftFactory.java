package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.entity.AttemptProcessingJobStatus;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.video.service.StoredVideo;
import org.springframework.stereotype.Component;

@Component
public class AttemptProcessingJobDraftFactory {

    public AttemptProcessingJob createPendingDraft(
            Challenge challenge,
            String trackingId,
            StoredVideo storedVideo,
            String pendingNotes,
            String processingMode,
            String runtimeState,
            String processingNotice) {
        return new AttemptProcessingJob(
                trackingId,
                challenge,
                AttemptProcessingJobStatus.PENDING,
                processingMode,
                runtimeState,
                processingNotice,
                storedVideo.originalFileName(),
                storedVideo.storagePath(),
                storedVideo.contentType(),
                storedVideo.size(),
                pendingNotes);
    }
}