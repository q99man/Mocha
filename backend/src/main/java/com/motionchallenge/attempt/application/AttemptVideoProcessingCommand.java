package com.motionchallenge.attempt.application;

import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.video.service.StoredVideo;

public record AttemptVideoProcessingCommand(
        Challenge challenge,
        Member member,
        ChallengeMotionProfile referenceProfile,
        StoredVideo storedVideo,
        String notes) {
}
