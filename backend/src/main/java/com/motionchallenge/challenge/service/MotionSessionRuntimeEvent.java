package com.motionchallenge.challenge.service;
import java.time.LocalDateTime;
public record MotionSessionRuntimeEvent(
        Long challengeId,
        String runtimeState,
        LocalDateTime recordedAt,
        String failureCode,
        String failureMessage) {
}