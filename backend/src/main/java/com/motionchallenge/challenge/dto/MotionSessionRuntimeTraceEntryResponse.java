package com.motionchallenge.challenge.dto;

public record MotionSessionRuntimeTraceEntryResponse(
        String runtimeState,
        String source,
        String recordedAt) {
}
