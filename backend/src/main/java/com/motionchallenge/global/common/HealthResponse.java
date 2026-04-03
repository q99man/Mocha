package com.motionchallenge.global.common;

import java.time.Instant;

public record HealthResponse(String status, String application, Instant checkedAt) {
}

