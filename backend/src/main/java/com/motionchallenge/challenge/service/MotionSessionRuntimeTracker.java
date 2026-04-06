package com.motionchallenge.challenge.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class MotionSessionRuntimeTracker {

    private static final long TRANSIENT_VISIBILITY_SECONDS = 2;
    private static final int TRACE_HISTORY_LIMIT = 6;
    private static final String TRACE_SOURCE_TRACKER = "TRACKER";

    private final Map<Long, TrackedRuntimeState> runtimeStatesByChallengeId = new ConcurrentHashMap<>();
    private final Map<Long, Deque<RuntimeTraceEntry>> runtimeHistoryByChallengeId = new ConcurrentHashMap<>();

    public void markUploadInProgress(Long challengeId) {
        LocalDateTime now = LocalDateTime.now();
        runtimeStatesByChallengeId.put(
                challengeId,
                new TrackedRuntimeState(
                        "UPLOAD_IN_PROGRESS",
                        now,
                        null,
                        null,
                        null,
                        null));
        appendHistory(challengeId, "UPLOAD_IN_PROGRESS", now);
    }

    public void markUploadStored(Long challengeId) {
        LocalDateTime now = LocalDateTime.now();
        runtimeStatesByChallengeId.put(
                challengeId,
                new TrackedRuntimeState(
                        "UPLOAD_STORED",
                        now,
                        null,
                        null,
                        null,
                        now.plusSeconds(TRANSIENT_VISIBILITY_SECONDS)));
        appendHistory(challengeId, "UPLOAD_STORED", now);
    }

    public void markAnalysisInProgress(Long challengeId) {
        LocalDateTime now = LocalDateTime.now();
        runtimeStatesByChallengeId.put(
                challengeId,
                new TrackedRuntimeState(
                        "ANALYSIS_IN_PROGRESS",
                        now,
                        null,
                        null,
                        null,
                        now.plusSeconds(TRANSIENT_VISIBILITY_SECONDS)));
        appendHistory(challengeId, "ANALYSIS_IN_PROGRESS", now);
    }

    public void markFailedRetryable(Long challengeId, String failureCode, String failureMessage) {
        LocalDateTime now = LocalDateTime.now();
        runtimeStatesByChallengeId.put(
                challengeId,
                new TrackedRuntimeState(
                        "FAILED_RETRYABLE",
                        now,
                        failureCode,
                        failureMessage,
                        now,
                        null));
        appendHistory(challengeId, "FAILED_RETRYABLE", now);
    }

    public TrackedRuntimeState getTrackedRuntimeState(Long challengeId) {
        TrackedRuntimeState trackedState = runtimeStatesByChallengeId.get(challengeId);
        if (trackedState == null) {
            return null;
        }

        if (trackedState.visibleUntilAt() != null && trackedState.visibleUntilAt().isBefore(LocalDateTime.now())) {
            runtimeStatesByChallengeId.remove(challengeId, trackedState);
            return null;
        }

        return trackedState;
    }

    public void clearRuntimeState(Long challengeId) {
        runtimeStatesByChallengeId.remove(challengeId);
    }

    public List<RuntimeTraceEntry> getRecentRuntimeHistory(Long challengeId) {
        Deque<RuntimeTraceEntry> history = runtimeHistoryByChallengeId.get(challengeId);
        if (history == null || history.isEmpty()) {
            return List.of();
        }

        return new ArrayList<>(history);
    }

    private void appendHistory(Long challengeId, String runtimeState, LocalDateTime recordedAt) {
        runtimeHistoryByChallengeId.compute(challengeId, (id, currentHistory) -> {
            Deque<RuntimeTraceEntry> nextHistory = currentHistory == null ? new LinkedList<>() : currentHistory;
            RuntimeTraceEntry latest = nextHistory.peekFirst();
            if (latest != null
                    && latest.runtimeState().equals(runtimeState)
                    && latest.recordedAt().plusNanos(500_000_000).isAfter(recordedAt)) {
                return nextHistory;
            }

            nextHistory.addFirst(new RuntimeTraceEntry(runtimeState, TRACE_SOURCE_TRACKER, recordedAt));
            while (nextHistory.size() > TRACE_HISTORY_LIMIT) {
                nextHistory.removeLast();
            }
            return nextHistory;
        });
    }
}
