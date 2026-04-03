package com.motionchallenge.scoring.application;

import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import org.springframework.stereotype.Service;

@Service
public class DefaultScoringService implements ScoringService {

    @Override
    public ScoringResult calculateScore(ChallengeMotionProfile referenceProfile, MotionAnalysisResult attemptAnalysis) {
        int signatureGap = Math.abs(referenceProfile.getSignature() - attemptAnalysis.signature());
        int normalizedSignaturePenalty = Math.min(55, signatureGap / 120);

        long durationGap = Math.abs(referenceProfile.getDurationMs() - attemptAnalysis.durationMs());
        int normalizedDurationPenalty = (int) Math.min(20, durationGap / 1_500L);

        int sampleGap = Math.abs(referenceProfile.getSampleCount() - attemptAnalysis.sampleCount());
        int normalizedSamplePenalty = Math.min(15, sampleGap / 5);

        int score = Math.max(0, 100 - normalizedSignaturePenalty - normalizedDurationPenalty - normalizedSamplePenalty);
        String summary = score >= 80
                ? "레퍼런스 움직임과 꽤 비슷한 흐름입니다."
                : score >= 60
                ? "기본 흐름은 맞지만 더 정교한 동작 차이가 있습니다."
                : "움직임 차이가 커서 추가 연습이 필요합니다.";

        return new ScoringResult(score, summary);
    }
}