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
                notes == null || notes.isBlank()
                        ? scoringResult.summary()
                        : notes));

        attemptVideoRepository.save(new AttemptVideo(
                attempt,
                storedVideo.originalFileName(),
                storedVideo.storagePath(),
                storedVideo.contentType(),
                storedVideo.size()));

        SimpleScoringResult previewResult = simpleScoringPreviewService.buildResult(
                attempt.getStatus(),
                scoringResult.score());

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
                storedVideo.originalFileName(),
                storedVideo.contentType(),
                storedVideo.size(),
                attempt.getCreatedAt());
    }
}
