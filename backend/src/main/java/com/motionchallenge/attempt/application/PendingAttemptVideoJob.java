package com.motionchallenge.attempt.application;

import com.motionchallenge.video.service.StoredVideo;

public record PendingAttemptVideoJob(
        String trackingId,
        Long challengeId,
        StoredVideo storedVideo,
        String notes) {
}