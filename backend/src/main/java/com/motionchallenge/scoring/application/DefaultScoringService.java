package com.motionchallenge.scoring.application;

import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import org.springframework.stereotype.Service;

@Service
public class DefaultScoringService implements ScoringService {

    @Override
    public ScoringResult calculateScore(ChallengeMotionProfile referenceProfile, MotionAnalysisResult attemptAnalysis) {
        double poseDifferenceRatio = ratioGap(referenceProfile.getSignature(), attemptAnalysis.signature());
        double timingDifferenceRatio = ratioGap(referenceProfile.getDurationMs(), attemptAnalysis.durationMs());
        double stabilityDifferenceRatio = ratioGap(referenceProfile.getSampleCount(), attemptAnalysis.sampleCount());

        int poseSimilarity = similarityScore(poseDifferenceRatio, 185.0, 72);
        int timingSimilarity = similarityScore(timingDifferenceRatio, 130.0, 18);
        int stabilitySimilarity = similarityScore(stabilityDifferenceRatio, 110.0, 14);

        double weightedScore = poseSimilarity * 0.65 + timingSimilarity * 0.20 + stabilitySimilarity * 0.15;
        int score = clamp((int) Math.round(weightedScore), 0, 100);
        String summary = buildSummary(score, poseSimilarity, timingSimilarity, stabilitySimilarity);

        return new ScoringResult(score, summary);
    }

    private double ratioGap(long referenceValue, long attemptValue) {
        long denominator = Math.max(Math.abs(referenceValue), 1L);
        return Math.abs(referenceValue - attemptValue) / (double) denominator;
    }

    private int similarityScore(double differenceRatio, double multiplier, int maxPenalty) {
        int penalty = (int) Math.round(Math.min(maxPenalty, differenceRatio * multiplier));
        return clamp(100 - penalty, 0, 100);
    }

    private String buildSummary(int score, int poseSimilarity, int timingSimilarity, int stabilitySimilarity) {
        String strongestArea = resolveStrongestArea(poseSimilarity, timingSimilarity, stabilitySimilarity);
        String weakestArea = resolveWeakestArea(poseSimilarity, timingSimilarity, stabilitySimilarity);

        if (score >= 90) {
            return "Very close match. Strongest area: " + strongestArea + ".";
        }
        if (score >= 75) {
            return "Good overall match. Strongest area: " + strongestArea + ", but " + weakestArea + " still differs.";
        }
        if (score >= 60) {
            return "Partially similar result. The upload stayed closest in " + strongestArea + ", while " + weakestArea + " pulled the score down.";
        }
        return "Meaningful difference detected. Weakest area: "
                + weakestArea
                + ". Pose "
                + poseSimilarity
                + ", timing "
                + timingSimilarity
                + ", stability "
                + stabilitySimilarity
                + ".";
    }

    private String resolveStrongestArea(int poseSimilarity, int timingSimilarity, int stabilitySimilarity) {
        if (poseSimilarity >= timingSimilarity && poseSimilarity >= stabilitySimilarity) {
            return "pose similarity";
        }
        if (timingSimilarity >= stabilitySimilarity) {
            return "timing";
        }
        return "detection stability";
    }

    private String resolveWeakestArea(int poseSimilarity, int timingSimilarity, int stabilitySimilarity) {
        if (poseSimilarity <= timingSimilarity && poseSimilarity <= stabilitySimilarity) {
            return "pose similarity";
        }
        if (timingSimilarity <= stabilitySimilarity) {
            return "timing";
        }
        return "detection stability";
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
