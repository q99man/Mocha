package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.entity.AttemptVideo;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.attempt.repository.AttemptVideoRepository;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import com.motionchallenge.motion.service.MotionAnalysisService;
import com.motionchallenge.scoring.application.ScoringResult;
import com.motionchallenge.scoring.application.ScoringService;
import com.motionchallenge.scoring.application.SimpleScoringPreviewService;
import com.motionchallenge.scoring.application.SimpleScoringResult;
import com.motionchallenge.video.service.StoredVideo;
import com.motionchallenge.video.service.VideoStorageService;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AttemptVideoProcessingService {

    private static final String PROCESSING_MODE_SYNC_INLINE = "SYNC_INLINE";
    private static final String PROCESSING_NOTICE_AUTOSCORED =
            "업로드한 영상이 레퍼런스와 비교 분석되어 채점되었습니다.";

    private final AttemptRepository attemptRepository;
    private final AttemptVideoRepository attemptVideoRepository;
    private final MotionAnalysisService motionAnalysisService;
    private final ScoringService scoringService;
    private final SimpleScoringPreviewService simpleScoringPreviewService;
    private final AttemptJudgementTimelineService attemptJudgementTimelineService;
    private final AttemptFinalFeedbackService attemptFinalFeedbackService;
    private final VideoStorageService videoStorageService;

    public AttemptVideoProcessingService(
            AttemptRepository attemptRepository,
            AttemptVideoRepository attemptVideoRepository,
            MotionAnalysisService motionAnalysisService,
            ScoringService scoringService,
            SimpleScoringPreviewService simpleScoringPreviewService,
            AttemptJudgementTimelineService attemptJudgementTimelineService,
            AttemptFinalFeedbackService attemptFinalFeedbackService,
            VideoStorageService videoStorageService) {
        this.attemptRepository = attemptRepository;
        this.attemptVideoRepository = attemptVideoRepository;
        this.motionAnalysisService = motionAnalysisService;
        this.scoringService = scoringService;
        this.simpleScoringPreviewService = simpleScoringPreviewService;
        this.attemptJudgementTimelineService = attemptJudgementTimelineService;
        this.attemptFinalFeedbackService = attemptFinalFeedbackService;
        this.videoStorageService = videoStorageService;
    }

    public AttemptResultResponse processUploadedAttempt(
            Challenge challenge,
            Member member,
            ChallengeMotionProfile referenceProfile,
            StoredVideo storedVideo,
            String notes) {
        MotionAnalysisResult attemptAnalysis = motionAnalysisService.analyzeAttemptVideo(storedVideo);
        ScoringResult scoringResult = scoringService.calculateScore(referenceProfile, attemptAnalysis);
        List<AttemptJudgementCueResponse> judgementTimeline = attemptJudgementTimelineService.buildTimeline(
                referenceProfile.getProfileData(),
                attemptAnalysis.rawProfileData());
        String judgementTimelineData = attemptJudgementTimelineService.serializeTimeline(judgementTimeline);
        Attempt latestAttempt = attemptRepository.findTopByChallengeIdAndMemberIdOrderByCreatedAtDescIdDesc(challenge.getId(), member.getId())
                .orElse(null);
        PreviousAttemptSnapshot previousAttempt = PreviousAttemptSnapshot.from(latestAttempt);

        Attempt attempt = new Attempt(
                challenge,
                member,
                scoringResult.score(),
                AttemptStatus.COMPLETED,
                PROCESSING_MODE_SYNC_INLINE,
                true,
                PROCESSING_NOTICE_AUTOSCORED,
                notes,
                scoringResult.summary(),
                judgementTimelineData,
                scoringResult.poseSimilarity(),
                scoringResult.timingSimilarity(),
                scoringResult.stabilitySimilarity(),
                scoringResult.strongestArea(),
                scoringResult.weakestArea());
        attempt = attemptRepository.save(attempt);

        upsertAttemptVideo(attempt, storedVideo);

        SimpleScoringResult previewResult = simpleScoringPreviewService.buildResult(
                attempt.getStatus(),
                scoringResult.score());
        AttemptFinalFeedbackResponse finalFeedback = attemptFinalFeedbackService.build(
                previewResult.scoreAvailable(),
                scoringResult.score(),
                scoringResult.strongestArea(),
                scoringResult.weakestArea(),
                judgementTimeline);

        return new AttemptResultResponse(
                attempt.getId(),
                challenge.getId(),
                challenge.getTitle(),
                "/uploads/" + storedVideo.storagePath(),
                scoringResult.score(),
                attempt.getStatus(),
                AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED,
                previewResult.scoreAvailable(),
                previewResult.resultHeadline(),
                scoringResult.summary(),
                finalFeedback,
                judgementTimeline,
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
                previousAttempt != null ? previousAttempt.id() : null,
                previousAttempt != null ? previousAttempt.score() : null,
                previousAttempt != null ? previousAttempt.attemptedAt() : null,
                previousAttempt != null ? scoringResult.score() - previousAttempt.score() : null,
                computeDelta(scoringResult.poseSimilarity(), previousAttempt != null ? previousAttempt.poseSimilarity() : null),
                computeDelta(scoringResult.timingSimilarity(), previousAttempt != null ? previousAttempt.timingSimilarity() : null),
                computeDelta(scoringResult.stabilitySimilarity(), previousAttempt != null ? previousAttempt.stabilitySimilarity() : null),
                attempt.getUpdatedAt());
    }

    private void upsertAttemptVideo(Attempt attempt, StoredVideo storedVideo) {
        AttemptVideo existingVideo = attemptVideoRepository.findByAttemptId(attempt.getId()).orElse(null);
        String previousStoragePath = existingVideo != null ? existingVideo.getStoragePath() : null;

        if (existingVideo != null) {
            existingVideo.updateStoredVideo(
                    storedVideo.originalFileName(),
                    storedVideo.storagePath(),
                    storedVideo.contentType(),
                    storedVideo.size());
        } else {
            attemptVideoRepository.save(new AttemptVideo(
                    attempt,
                    storedVideo.originalFileName(),
                    storedVideo.storagePath(),
                    storedVideo.contentType(),
                    storedVideo.size()));
        }

        if (previousStoragePath != null && !previousStoragePath.equals(storedVideo.storagePath())) {
            videoStorageService.deleteStoredVideo(previousStoragePath);
        }
    }

    private Integer computeDelta(Integer currentValue, Integer previousValue) {
        if (currentValue == null || previousValue == null) {
            return null;
        }
        return currentValue - previousValue;
    }

    private record PreviousAttemptSnapshot(
            Long id,
            Integer score,
            java.time.LocalDateTime attemptedAt,
            Integer poseSimilarity,
            Integer timingSimilarity,
            Integer stabilitySimilarity) {

        private static PreviousAttemptSnapshot from(Attempt attempt) {
            if (attempt == null) {
                return null;
            }

            return new PreviousAttemptSnapshot(
                    attempt.getId(),
                    attempt.getScore(),
                    attempt.getUpdatedAt(),
                    attempt.getPoseSimilarity(),
                    attempt.getTimingSimilarity(),
                    attempt.getStabilitySimilarity());
        }
    }
}

