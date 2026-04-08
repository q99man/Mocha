package com.motionchallenge.motion.service;

public record MediaPipeHttpAnalyzeRequest(
        String schemaVersion,
        String analysisPhase,
        SourceVideo sourceVideo,
        Runtime runtime) {

    public record SourceVideo(
            String originalFileName,
            String storagePath,
            String contentType,
            long size) {
    }

    public record Runtime(long timeoutMillis) {
    }
}
