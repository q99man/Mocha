package com.motionchallenge.challenge.service;

public record MotionSessionRuntimeContext(
        String runtimeState,
        java.time.LocalDateTime runtimeUpdatedAt,
        java.util.List<RuntimeTraceEntry> runtimeHistory,
        Long latestAttemptId,
        String latestAttemptStatus,
        String latestAttemptResultSource,
        boolean latestAttemptScoreAvailable,
        boolean latestAttemptVideoUploaded,
        String lastFailureCode,
        String lastFailureMessage,
        java.time.LocalDateTime lastFailureAt) {
}
