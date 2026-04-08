package com.motionchallenge.motion.service;

public record MediaPipeBridgeRequest(
        String schemaVersion,
        String analysisPhase,
        String originalFileName,
        String storagePath,
        String contentType,
        long fileSize,
        String endpoint,
        String analyzePath,
        long timeoutMillis) {
}
