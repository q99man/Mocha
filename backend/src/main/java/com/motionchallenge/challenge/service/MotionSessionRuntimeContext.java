package com.motionchallenge.challenge.service;

public record MotionSessionRuntimeContext(
        String runtimeState,
        java.time.LocalDateTime runtimeUpdatedAt,
        java.util.List<RuntimeTraceEntry> runtimeHistory,
        String runtimeSource,
        Long latestAttemptId,
        String latestAttemptStatus,
        String latestAttemptResultSource,
        boolean latestAttemptScoreAvailable,
        boolean latestAttemptVideoUploaded,
        String lastFailureCode,
        String failureSeverity,
        String failureAction,
        int retryCount,
        boolean autoRetryExhausted,
        boolean inspectRecommended,
        String terminalState,
        String terminalMessage,
        String lastFailureMessage,
        java.time.LocalDateTime lastFailureAt) {
}
