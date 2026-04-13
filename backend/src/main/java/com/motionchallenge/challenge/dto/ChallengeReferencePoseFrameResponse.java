package com.motionchallenge.challenge.dto;

import java.util.List;

public record ChallengeReferencePoseFrameResponse(
        int frameIndex,
        List<ChallengeReferencePosePointResponse> points) {
}
