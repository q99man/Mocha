package com.motionchallenge.scoring.application;

import com.motionchallenge.attempt.application.AttemptResultResponse;
import com.motionchallenge.attempt.application.AttemptProcessingJobStateService;
import com.motionchallenge.attempt.application.AttemptVideoProcessingService;
import com.motionchallenge.attempt.application.PendingAttemptVideoJob;
import com.motionchallenge.attempt.application.PendingAttemptVideoJobRegistry;
import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.challenge.repository.ChallengeMotionProfileRepository;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.challenge.service.MotionSessionRuntimeEventPublisher;
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
            "비동기 대기 업로드를 로컬 완료 처리로 이어가는 중입니다.";
    private static final String COMPLETION_NOTICE =
            "로컬 async pending 완료 stub으로 분석과 채점을 마무리했습니다.";

    private final PendingAttemptVideoJobRegistry pendingAttemptVideoJobRegistry;
    private final ChallengeRepository challengeRepository;
    private final ChallengeMotionProfileRepository challengeMotionProfileRepository;
    private final AttemptVideoProcessingService attemptVideoProcessingService;
    private final AttemptProcessingJobStateService attemptProcessingJobStateService;
    private final MotionSessionRuntimeEventPublisher motionSessionRuntimeEventPublisher;
    private final AttemptProcessingJobRepository attemptProcessingJobRepository;

    public AsyncPendingAttemptCompletionService(
            PendingAttemptVideoJobRegistry pendingAttemptVideoJobRegistry,
            ChallengeRepository challengeRepository,
            ChallengeMotionProfileRepository challengeMotionProfileRepository,
            AttemptVideoProcessingService attemptVideoProcessingService,
            AttemptProcessingJobStateService attemptProcessingJobStateService,
            MotionSessionRuntimeEventPublisher motionSessionRuntimeEventPublisher,
            AttemptProcessingJobRepository attemptProcessingJobRepository) {
        this.pendingAttemptVideoJobRegistry = pendingAttemptVideoJobRegistry;
        this.challengeRepository = challengeRepository;
        this.challengeMotionProfileRepository = challengeMotionProfileRepository;
        this.attemptVideoProcessingService = attemptVideoProcessingService;
        this.attemptProcessingJobStateService = attemptProcessingJobStateService;
        this.motionSessionRuntimeEventPublisher = motionSessionRuntimeEventPublisher;
        this.attemptProcessingJobRepository = attemptProcessingJobRepository;
    }

    public AttemptResultResponse completePendingAttempt(Long challengeId, String trackingId, String notes) {
        PendingAttemptVideoJob pendingJob = resolvePendingJob(challengeId, trackingId);
        String resolvedTrackingId = pendingJob.trackingId();
        boolean processingJobExists = resolveProcessingJob(challengeId, trackingId).isPresent();

        if (processingJobExists) {
            attemptProcessingJobStateService.markProcessing(
                    resolvedTrackingId,
                    PROCESSING_RUNTIME_STATE,
                    PROCESSING_NOTICE);
        }

        Challenge challenge = challengeRepository.findByIdAndIsActiveTrue(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));

        ChallengeMotionProfile referenceProfile = challengeMotionProfileRepository.findByChallengeId(challengeId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "레퍼런스 모션 프로필이 준비되지 않아 완료 처리를 진행할 수 없습니다."));

        try {
            AttemptResultResponse response = attemptVideoProcessingService.processUploadedAttempt(
                    challenge,
                    referenceProfile,
                    pendingJob.storedVideo(),
                    normalizeNotes(notes, pendingJob.notes()));

            pendingAttemptVideoJobRegistry.remove(challengeId);
            motionSessionRuntimeEventPublisher.publishScoringCompleted(challengeId);

            if (processingJobExists) {
                attemptProcessingJobStateService.markCompleted(
                        resolvedTrackingId,
                        response.attemptId(),
                        COMPLETED_RUNTIME_STATE,
                        COMPLETION_NOTICE);
            }

            return response.withProcessingState("SYNC_INLINE", true, COMPLETION_NOTICE);
        } catch (RuntimeException exception) {
            String failureMessage = Optional.ofNullable(exception.getMessage())
                    .filter(message -> !message.isBlank())
                    .orElse("비동기 완료 처리 중 문제가 발생했습니다.");

            if (processingJobExists) {
                attemptProcessingJobStateService.markFailed(
                        resolvedTrackingId,
                        FAILURE_CODE_ANALYSIS,
                        FAILED_RUNTIME_STATE,
                        failureMessage);
            }

            motionSessionRuntimeEventPublisher.publishFailedRetryable(
                    challengeId,
                    FAILURE_CODE_ANALYSIS,
                    failureMessage);
            throw exception;
        }
    }

    private PendingAttemptVideoJob resolvePendingJob(Long challengeId, String trackingId) {
        if (trackingId != null && !trackingId.isBlank()) {
            PendingAttemptVideoJob job = pendingAttemptVideoJobRegistry.findByTrackingId(trackingId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "완료 처리할 비동기 대기 업로드 추적 정보를 찾을 수 없습니다."));
            if (!job.challengeId().equals(challengeId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "추적 ID와 챌린지 정보가 일치하지 않습니다.");
            }
            return job;
        }

        return pendingAttemptVideoJobRegistry.findByChallengeId(challengeId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "완료 처리할 비동기 대기 업로드를 찾을 수 없습니다."));
    }

    private Optional<AttemptProcessingJob> resolveProcessingJob(Long challengeId, String trackingId) {
        if (trackingId != null && !trackingId.isBlank()) {
            return attemptProcessingJobRepository.findByTrackingId(trackingId);
        }
        return attemptProcessingJobRepository.findTopByChallengeIdOrderByCreatedAtDesc(challengeId);
    }

    private String normalizeNotes(String requestedNotes, String pendingNotes) {
        if (requestedNotes != null && !requestedNotes.isBlank()) {
            return requestedNotes;
        }

        if (pendingNotes != null && !pendingNotes.isBlank()) {
            return pendingNotes;
        }

        return "로컬 async pending 완료 stub을 통해 마무리한 자동 채점 기록입니다.";
    }
}
