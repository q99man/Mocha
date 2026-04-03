package com.motionchallenge.challenge.dto;

public record MotionSessionStateResponse(
        Long challengeId,
        String sessionState,
        String nextAction,
        boolean cameraPermissionRequired,
        boolean recordingEnabled,
        boolean scoringEnabled,
        String message) {
}