package com.motionchallenge.challenge.service;

import java.time.LocalDateTime;

public record RuntimeTraceEntry(
        String runtimeState,
        String source,
        LocalDateTime recordedAt) {
}
