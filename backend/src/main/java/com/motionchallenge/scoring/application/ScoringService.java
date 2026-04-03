package com.motionchallenge.scoring.application;

import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MotionAnalysisResult;

public interface ScoringService {

    ScoringResult calculateScore(ChallengeMotionProfile referenceProfile, MotionAnalysisResult attemptAnalysis);
}