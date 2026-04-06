package com.motionchallenge.challenge.service;

import java.time.LocalDateTime;

public record TrackedRuntimeState(
        String runtimeState,
        LocalDateTime runtimeUpdatedAt,
        String failureCode,
        String failureMessage,
        LocalDateTime failureRecordedAt,
        LocalDateTime visibleUntilAt) {
}
