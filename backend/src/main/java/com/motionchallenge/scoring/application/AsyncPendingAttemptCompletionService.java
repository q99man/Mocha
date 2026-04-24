package com.motionchallenge.scoring.application;

import com.motionchallenge.attempt.application.AttemptProcessingJobStateService;
import com.motionchallenge.attempt.application.AttemptResultResponse;
import com.motionchallenge.attempt.application.AttemptVideoProcessingService;
import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.challenge.repository.ChallengeMotionProfileRepository;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.challenge.service.MotionSessionRuntimeEventPublisher;
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.video.service.StoredVideo;
import com.motionchallenge.video.service.VideoStorageService;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class AsyncPendingAttemptCompletionService {

    private static final String FAILURE_CODE_ANALYSIS = "ANALYSIS_FAILED";
    private static final String PROCESSING_RUNTIME_STATE = "ANALYSIS_IN_PROGRESS";
    private static final String COMPLETED_RUNTIME_STATE = "SCORING_COMPLETED";
    private static final String FAILED_RUNTIME_STATE = "FAILED_RETRYABLE";
    private static final String PROCESSING_NOTICE =
            "비동기 대기 업로드를 로컬 완료 처리 흐름으로 이어가고 있습니다.";
    private static final String COMPLETION_NOTICE =
            "로컬 async pending 완료 처리로 분석과 채점을 마쳤습니다.";
    private static final String DEFAULT_FAILURE_MESSAGE =
            "비동기 완료 처리 중 문제가 발생했습니다.";
    private static final String DEFAULT_NOTES =
            "로컬 async pending 완료 처리로 마무리한 자동 채점 기록입니다.";

    private final ChallengeRepository challengeRepository;
    private final ChallengeMotionProfileRepository challengeMotionProfileRepository;
    private final AttemptVideoProcessingService attemptVideoProcessingService;
    private final AttemptProcessingJobStateService attemptProcessingJobStateService;
    private final MotionSessionRuntimeEventPublisher motionSessionRuntimeEventPublisher;
    private final AttemptProcessingJobRepository attemptProcessingJobRepository;
    private final VideoStorageService videoStorageService;

    public AsyncPendingAttemptCompletionService(
            ChallengeRepository challengeRepository,
            ChallengeMotionProfileRepository challengeMotionProfileRepository,
            AttemptVideoProcessingService attemptVideoProcessingService,
            AttemptProcessingJobStateService attemptProcessingJobStateService,
            MotionSessionRuntimeEventPublisher motionSessionRuntimeEventPublisher,
            AttemptProcessingJobRepository attemptProcessingJobRepository,
            VideoStorageService videoStorageService) {
        this.challengeRepository = challengeRepository;
        this.challengeMotionProfileRepository = challengeMotionProfileRepository;
        this.attemptVideoProcessingService = attemptVideoProcessingService;
        this.attemptProcessingJobStateService = attemptProcessingJobStateService;
        this.motionSessionRuntimeEventPublisher = motionSessionRuntimeEventPublisher;
        this.attemptProcessingJobRepository = attemptProcessingJobRepository;
        this.videoStorageService = videoStorageService;
    }

    public AttemptResultResponse completePendingAttemptInternal(Long challengeId, String trackingId, String notes) {
        AttemptProcessingJob processingJob = attemptProcessingJobRepository.findByTrackingId(trackingId)
                .filter(job -> job.getChallenge().getId().equals(challengeId))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "완료 처리할 비동기 대기 업로드를 찾을 수 없습니다."));
        return completePendingAttempt(processingJob, notes);
    }

    private AttemptResultResponse completePendingAttempt(AttemptProcessingJob processingJob, String notes) {
        Long challengeId = processingJob.getChallenge().getId();
        Member member = processingJob.getMember();
        StoredVideo storedVideo = toStoredVideo(processingJob);
        String resolvedTrackingId = processingJob.getTrackingId();

        attemptProcessingJobStateService.markProcessing(
                resolvedTrackingId,
                PROCESSING_RUNTIME_STATE,
                PROCESSING_NOTICE);

        Challenge challenge = challengeRepository.findByIdAndIsActiveTrue(challengeId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "챌린지를 찾을 수 없습니다."));

        ChallengeMotionProfile referenceProfile = challengeMotionProfileRepository.findByChallengeId(challengeId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "레퍼런스 모션 프로필이 준비되지 않아 완료 처리를 진행할 수 없습니다."));

        try {
            AttemptResultResponse response = attemptVideoProcessingService.processUploadedAttempt(
                    challenge,
                    member,
                    referenceProfile,
                    storedVideo,
                    normalizeNotes(notes, processingJob.getPendingNotes()));

            motionSessionRuntimeEventPublisher.publishScoringCompleted(challengeId);
            attemptProcessingJobStateService.markCompleted(
                    resolvedTrackingId,
                    response.attemptId(),
                    COMPLETED_RUNTIME_STATE,
                    COMPLETION_NOTICE);

            return response.withProcessingState("SYNC_INLINE", true, COMPLETION_NOTICE);
        } catch (RuntimeException exception) {
            String failureMessage = Optional.ofNullable(exception.getMessage())
                    .filter(message -> !message.isBlank())
                    .orElse(DEFAULT_FAILURE_MESSAGE);

            attemptProcessingJobStateService.markFailed(
                    resolvedTrackingId,
                    FAILURE_CODE_ANALYSIS,
                    FAILED_RUNTIME_STATE,
                    failureMessage);

            motionSessionRuntimeEventPublisher.publishFailedRetryable(
                    challengeId,
                    FAILURE_CODE_ANALYSIS,
                    failureMessage);
            throw exception;
        }
    }

    private StoredVideo toStoredVideo(AttemptProcessingJob processingJob) {
        if (!canRestoreFromDurableJob(processingJob)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "업로드 메타데이터가 충분하지 않아 비동기 완료 처리를 이어갈 수 없습니다.");
        }

        return videoStorageService.loadStoredVideo(
                processingJob.getOriginalFileName(),
                processingJob.getStoragePath(),
                processingJob.getContentType(),
                processingJob.getFileSize());
    }

    private boolean canRestoreFromDurableJob(AttemptProcessingJob processingJob) {
        return processingJob.getOriginalFileName() != null
                && !processingJob.getOriginalFileName().isBlank()
                && processingJob.getStoragePath() != null
                && !processingJob.getStoragePath().isBlank();
    }

    private String normalizeNotes(String requestedNotes, String pendingNotes) {
        if (requestedNotes != null && !requestedNotes.isBlank()) {
            return requestedNotes;
        }
        if (pendingNotes != null && !pendingNotes.isBlank()) {
            return pendingNotes;
        }
        return DEFAULT_NOTES;
    }
}
