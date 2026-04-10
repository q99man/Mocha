package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.entity.AttemptVideo;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.attempt.repository.AttemptVideoRepository;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import com.motionchallenge.motion.service.MotionAnalysisService;
import com.motionchallenge.scoring.application.ScoringResult;
import com.motionchallenge.scoring.application.ScoringService;
import com.motionchallenge.scoring.application.SimpleScoringPreviewService;
import com.motionchallenge.scoring.application.SimpleScoringResult;
import com.motionchallenge.video.service.StoredVideo;
import org.springframework.stereotype.Service;

@Service
public class AttemptVideoProcessingService {

    private static final String PROCESSING_MODE_SYNC_INLINE = "SYNC_INLINE";
    private static final String PROCESSING_NOTICE_AUTOSCORED =
            "The uploaded video was analyzed and scored against the reference.";

    private final AttemptRepository attemptRepository;
    private final AttemptVideoRepository attemptVideoRepository;
    private final MotionAnalysisService motionAnalysisService;
    private final ScoringService scoringService;
    private final SimpleScoringPreviewService simpleScoringPreviewService;

    public AttemptVideoProcessingService(
            AttemptRepository attemptRepository,
            AttemptVideoRepository attemptVideoRepository,
            MotionAnalysisService motionAnalysisService,
            ScoringService scoringService,
            SimpleScoringPreviewService simpleScoringPreviewService) {
        this.attemptRepository = attemptRepository;
        this.attemptVideoRepository = attemptVideoRepository;
        this.motionAnalysisService = motionAnalysisService;
        this.scoringService = scoringService;
        this.simpleScoringPreviewService = simpleScoringPreviewService;
    }

    public AttemptResultResponse processUploadedAttempt(
            Challenge challenge,
            ChallengeMotionProfile referenceProfile,
            StoredVideo storedVideo,
            String notes) {
        MotionAnalysisResult attemptAnalysis = motionAnalysisService.analyzeAttemptVideo(storedVideo);
        ScoringResult scoringResult = scoringService.calculateScore(referenceProfile, attemptAnalysis);

        Attempt attempt = attemptRepository.save(new Attempt(
                challenge,
                scoringResult.score(),
                AttemptStatus.COMPLETED,
                PROCESSING_MODE_SYNC_INLINE,
                true,
                PROCESSING_NOTICE_AUTOSCORED,
                notes == null || notes.isBlank() ? scoringResult.summary() : notes,
                scoringResult.poseSimilarity(),
                scoringResult.timingSimilarity(),
                scoringResult.stabilitySimilarity(),
                scoringResult.strongestArea(),
                scoringResult.weakestArea()));

        attemptVideoRepository.save(new AttemptVideo(
                attempt,
                storedVideo.originalFileName(),
                storedVideo.storagePath(),
                storedVideo.contentType(),
                storedVideo.size()));

        SimpleScoringResult previewResult = simpleScoringPreviewService.buildResult(
                attempt.getStatus(),
                scoringResult.score());

        Attempt previousAttempt = resolvePreviousScoredAttempt(challenge.getId(), attempt.getId());

        return new AttemptResultResponse(
                attempt.getId(),
                challenge.getId(),
                challenge.getTitle(),
                scoringResult.score(),
                attempt.getStatus(),
                AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED,
                previewResult.scoreAvailable(),
                previewResult.resultHeadline(),
                scoringResult.summary(),
                attemptAnalysis.analyzerName(),
                attempt.getProcessingMode(),
                attempt.isProcessingComplete(),
                attempt.getProcessingNotice(),
                null,
                storedVideo.originalFileName(),
                storedVideo.contentType(),
                storedVideo.size(),
                scoringResult.poseSimilarity(),
                scoringResult.timingSimilarity(),
                scoringResult.stabilitySimilarity(),
                scoringResult.strongestArea(),
                scoringResult.weakestArea(),
                null,
                previousAttempt != null ? previousAttempt.getId() : null,
                previousAttempt != null ? previousAttempt.getScore() : null,
                previousAttempt != null ? previousAttempt.getCreatedAt() : null,
                previousAttempt != null ? scoringResult.score() - previousAttempt.getScore() : null,
                computeDelta(scoringResult.poseSimilarity(), previousAttempt != null ? previousAttempt.getPoseSimilarity() : null),
                computeDelta(scoringResult.timingSimilarity(), previousAttempt != null ? previousAttempt.getTimingSimilarity() : null),
                computeDelta(scoringResult.stabilitySimilarity(), previousAttempt != null ? previousAttempt.getStabilitySimilarity() : null),
                attempt.getCreatedAt());
    }

    private Attempt resolvePreviousScoredAttempt(Long challengeId, Long currentAttemptId) {
        Attempt previousAttempt = null;
        for (Attempt candidate : attemptRepository.findByChallengeIdOrderByCreatedAtAsc(challengeId)) {
            if (candidate.getId().equals(currentAttemptId)) {
                break;
            }
            if (attemptVideoRepository.findByAttemptId(candidate.getId()).isPresent()) {
                previousAttempt = candidate;
            }
        }
        return previousAttempt;
    }

    private Integer computeDelta(Integer currentValue, Integer previousValue) {
        if (currentValue == null || previousValue == null) {
            return null;
        }
        return currentValue - previousValue;
    }
}
