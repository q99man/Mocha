package com.motionchallenge.attempt.application;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.stereotype.Component;

@Component
public class PendingAttemptVideoJobRegistry {

    private final ConcurrentMap<Long, PendingAttemptVideoJob> jobsByChallengeId = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, PendingAttemptVideoJob> jobsByTrackingId = new ConcurrentHashMap<>();

    public void register(PendingAttemptVideoJob job) {
        jobsByChallengeId.put(job.challengeId(), job);
        jobsByTrackingId.put(job.trackingId(), job);
    }

    public Optional<PendingAttemptVideoJob> findByChallengeId(Long challengeId) {
        return Optional.ofNullable(jobsByChallengeId.get(challengeId));
    }

    public Optional<PendingAttemptVideoJob> findByTrackingId(String trackingId) {
        return Optional.ofNullable(jobsByTrackingId.get(trackingId));
    }

    public void remove(Long challengeId) {
        PendingAttemptVideoJob removed = jobsByChallengeId.remove(challengeId);
        if (removed != null) {
            jobsByTrackingId.remove(removed.trackingId());
        }
    }
}