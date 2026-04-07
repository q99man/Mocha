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
    private static final int TRACE_HISTORY_LIMIT = 6;
    private static final String TRACE_SOURCE_TRACKER = "TRACKER";
    private final Map<Long, TrackedRuntimeState> runtimeStatesByChallengeId = new ConcurrentHashMap<>();
    private final Map<Long, Deque<RuntimeTraceEntry>> runtimeHistoryByChallengeId = new ConcurrentHashMap<>();
    public void markUploadInProgress(Long challengeId) {
        LocalDateTime now = LocalDateTime.now();
        recordTrackedRuntimeState(
                challengeId,
                "UPLOAD_IN_PROGRESS",
                TRACE_SOURCE_TRACKER,
                now,
                null,
                null,
                null,
                null);
    }
    public void markUploadStored(Long challengeId) {
        LocalDateTime now = LocalDateTime.now();
        recordTrackedRuntimeState(
                challengeId,
                "UPLOAD_STORED",
                TRACE_SOURCE_TRACKER,
                now,
                null,
                null,
                null,
                now.plusSeconds(2));
    }
    public void markAnalysisInProgress(Long challengeId) {
        LocalDateTime now = LocalDateTime.now();
        recordTrackedRuntimeState(
                challengeId,
                "ANALYSIS_IN_PROGRESS",
                TRACE_SOURCE_TRACKER,
                now,
                null,
                null,
                null,
                now.plusSeconds(2));
    }
    public void markFailedRetryable(Long challengeId, String failureCode, String failureMessage) {
        LocalDateTime now = LocalDateTime.now();
        recordTrackedRuntimeState(
                challengeId,
                "FAILED_RETRYABLE",
                TRACE_SOURCE_TRACKER,
                now,
                failureCode,
                failureMessage,
                now,
                null);
    }
    public void recordTrackedRuntimeState(
            Long challengeId,
            String runtimeState,
            String source,
            LocalDateTime runtimeUpdatedAt,
            String failureCode,
            String failureMessage,
            LocalDateTime failureRecordedAt,
            LocalDateTime visibleUntilAt) {
        runtimeStatesByChallengeId.put(
                challengeId,
                new TrackedRuntimeState(
                        runtimeState,
                        runtimeUpdatedAt,
                        failureCode,
                        failureMessage,
                        failureRecordedAt,
                        visibleUntilAt));
        appendHistory(challengeId, runtimeState, source, runtimeUpdatedAt);
    }
    public void recordRuntimeHistory(
            Long challengeId,
            String runtimeState,
            String source,
            LocalDateTime recordedAt) {
        appendHistory(challengeId, runtimeState, source, recordedAt);
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
    private void appendHistory(Long challengeId, String runtimeState, String source, LocalDateTime recordedAt) {
        runtimeHistoryByChallengeId.compute(challengeId, (id, currentHistory) -> {
            Deque<RuntimeTraceEntry> nextHistory = currentHistory == null ? new LinkedList<>() : currentHistory;
            RuntimeTraceEntry latest = nextHistory.peekFirst();
            if (latest != null
                    && latest.runtimeState().equals(runtimeState)
                    && latest.source().equals(source)
                    && latest.recordedAt().plusNanos(500_000_000).isAfter(recordedAt)) {
                return nextHistory;
            }
            nextHistory.addFirst(new RuntimeTraceEntry(runtimeState, source, recordedAt));
            while (nextHistory.size() > TRACE_HISTORY_LIMIT) {
                nextHistory.removeLast();
            }
            return nextHistory;
        });
    }
}