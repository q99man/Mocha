package com.motionchallenge.challenge.dto;

import java.util.List;

public record MotionSessionStateResponse(
        Long challengeId,
        String readinessState,
        String runtimeState,
        String runtimeUpdatedAt,
        List<MotionSessionRuntimeTraceEntryResponse> serverRuntimeTrace,
        Long latestAttemptId,
        String latestAttemptResultSource,
        boolean scoreAvailable,
        String lastFailureCode,
        String lastFailureMessage,
        String lastFailureAt,
        String sessionState,
        String recordingPhase,
        String nextAction,
        boolean cameraPermissionRequired,
        boolean recordingEnabled,
        boolean uploadEnabled,
        boolean scoringEnabled,
        String message) {
}
