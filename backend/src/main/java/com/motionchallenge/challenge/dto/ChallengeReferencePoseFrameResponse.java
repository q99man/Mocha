package com.motionchallenge.challenge.dto;

import java.util.List;

public record ChallengeReferencePoseFrameResponse(
        int frameIndex,
        int timestampMs,
        Integer secondIndex,
        String focusRegion,
        Double poseWeight,
        Double timingWeight,
        List<ChallengeReferencePosePointResponse> points) {
}
