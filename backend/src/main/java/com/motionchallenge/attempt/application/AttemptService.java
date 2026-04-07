package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.attempt.repository.AttemptVideoRepository;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.challenge.entity.ReferenceAnalysisStatus;
import com.motionchallenge.challenge.repository.ChallengeMotionProfileRepository;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.challenge.service.MotionSessionRuntimeEventPublisher;
import com.motionchallenge.scoring.application.SimpleScoringPreviewService;
import com.motionchallenge.scoring.application.SimpleScoringResult;
import com.motionchallenge.video.service.StoredVideo;
import com.motionchallenge.video.service.VideoStorageService;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class AttemptService {

    private static final String FAILURE_CODE_UPLOAD_STORAGE = "UPLOAD_STORAGE_FAILED";
    private static final String FAILURE_CODE_ANALYSIS = "ANALYSIS_FAILED";
    private static final String FAILURE_CODE_SCORING = "SCORING_FAILED";
    private static final int PREPARED_SCORE = 0;
    private static final int MIN_COMPLETED_SCORE = 1;
    private static final String DEFAULT_PREPARED_NOTE = "준비 단계 확인을 위한 기본 기록";
    private static final String DEFAULT_COMPLETED_NOTE = "샘플 완료 흐름 확인을 위한 기본 기록";
    private static final String PROCESSING_NOTICE_AUTOSCORED =
            "실제 업로드 비디오를 기준으로 서버가 분석과 채점을 완료했습니다.";
    private static final String PROCESSING_NOTICE_SAMPLE =
            "샘플 preview 흐름으로 만든 결과입니다. 실제 업로드 자동 채점 결과와는 차이가 있을 수 있습니다.";
    private static final String PROCESSING_NOTICE_PREPARED =
            "준비 단계에서 저장한 기록입니다. 실제 업로드 전 자동 채점은 아직 진행되지 않았습니다.";
    private static final String DEFAULT_FAILURE_MESSAGE =
            "처리 중 알 수 없는 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";

    private final AttemptRepository attemptRepository;
    private final AttemptProcessingJobRepository attemptProcessingJobRepository;
    private final AttemptVideoRepository attemptVideoRepository;
    private final ChallengeRepository challengeRepository;
    private final ChallengeMotionProfileRepository challengeMotionProfileRepository;
    private final SimpleScoringPreviewService simpleScoringPreviewService;
    private final VideoStorageService videoStorageService;
    private final AttemptVideoProcessingDispatcher attemptVideoProcessingDispatcher;
    private final MotionSessionRuntimeEventPublisher motionSessionRuntimeEventPublisher;
    private final AttemptAsyncPendingProperties asyncPendingProperties;

    public AttemptService(
            AttemptRepository attemptRepository,
            AttemptProcessingJobRepository attemptProcessingJobRepository,
            AttemptVideoRepository attemptVideoRepository,
            ChallengeRepository challengeRepository,
            ChallengeMotionProfileRepository challengeMotionProfileRepository,
            SimpleScoringPreviewService simpleScoringPreviewService,
            VideoStorageService videoStorageService,
            AttemptVideoProcessingDispatcher attemptVideoProcessingDispatcher,
            MotionSessionRuntimeEventPublisher motionSessionRuntimeEventPublisher,
            AttemptAsyncPendingProperties asyncPendingProperties) {
        this.attemptRepository = attemptRepository;
        this.attemptProcessingJobRepository = attemptProcessingJobRepository;
        this.attemptVideoRepository = attemptVideoRepository;
        this.challengeRepository = challengeRepository;
        this.challengeMotionProfileRepository = challengeMotionProfileRepository;
        this.simpleScoringPreviewService = simpleScoringPreviewService;
        this.videoStorageService = videoStorageService;
        this.attemptVideoProcessingDispatcher = attemptVideoProcessingDispatcher;
        this.motionSessionRuntimeEventPublisher = motionSessionRuntimeEventPublisher;
        this.asyncPendingProperties = asyncPendingProperties;
    }

    public List<AttemptSummaryResponse> getAttempts() {
        return attemptRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    public AttemptSummaryResponse getAttempt(Long id) {
        Attempt attempt = attemptRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 시도 기록을 찾을 수 없습니다."));

        return toResponse(attempt);
    }

    public AttemptProcessingJobProgressResponse getAttemptVideoProcessingProgress(Long challengeId, String trackingId) {
        AttemptProcessingJob processingJob = resolveProcessingJob(challengeId, trackingId);
        LocalDateTime now = LocalDateTime.now();
        long elapsedSeconds = Math.max(0L, Duration.between(processingJob.getCreatedAt(), now).getSeconds());

        return new AttemptProcessingJobProgressResponse(
                processingJob.getTrackingId(),
                processingJob.getChallenge().getId(),
                processingJob.getStatus().name(),
                processingJob.getProcessingMode(),
                resolveCompletionStrategy(processingJob),
                processingJob.getRuntimeState(),
                processingJob.getProcessingNotice(),
                processingJob.getFailureCode(),
                resolveFailureSeverity(processingJob),
                resolveFailureAction(processingJob),
                resolveRetryRecommended(processingJob),
                processingJob.getProcessingAttempts(),
                resolveRetryCount(processingJob),
                resolveAutoRetryEnabled(processingJob),
                resolveRemainingAutoRetryCount(processingJob),
                resolveAutoRetryExhausted(processingJob),
                processingJob.getResultAttemptId(),
                processingJob.getOriginalFileName(),
                processingJob.getCreatedAt(),
                processingJob.getUpdatedAt(),
                elapsedSeconds);
    }

    @Transactional
    public AttemptSummaryResponse createPrototypeAttempt(AttemptCreateRequest request) {
        String normalizedRecordType = normalizeRecordType(request.recordType());

        if (AttemptRecordType.COMPLETED.equals(normalizedRecordType)) {
            return createCompletedAttempt(new CompletedAttemptCommand(
                    request.challengeId(),
                    request.score(),
                    request.notes()));
        }

        return createPreparedAttempt(request.challengeId(), request.notes());
    }

    @Transactional
    public AttemptSummaryResponse createPreparedAttempt(Long challengeId, String notes) {
        Challenge challenge = findActiveChallenge(challengeId);

        Attempt attempt = attemptRepository.save(new Attempt(
                challenge,
                PREPARED_SCORE,
                AttemptStatus.PREPARED,
                null,
                false,
                PROCESSING_NOTICE_PREPARED,
                normalizePreparedNotes(notes)));

        return toResponse(attempt);
    }

    @Transactional
    public AttemptSummaryResponse createCompletedAttempt(CompletedAttemptCommand command) {
        Challenge challenge = findActiveChallenge(command.challengeId());
        int normalizedScore = normalizeCompletedScore(command.score());

        Attempt attempt = attemptRepository.save(new Attempt(
                challenge,
                normalizedScore,
                AttemptStatus.COMPLETED,
                null,
                true,
                PROCESSING_NOTICE_SAMPLE,
                normalizeCompletedNotes(command.notes())));

        return toResponse(attempt);
    }

    @Transactional
    public AttemptResultResponse submitAttemptVideo(AttemptVideoUploadRequest request) {
        if (request.getAttemptVideo() == null || request.getAttemptVideo().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "업로드할 시도 비디오를 먼저 선택해 주세요.");
        }

        Challenge challenge = findActiveChallenge(request.getChallengeId());
        if (challenge.getReferenceAnalysisStatus() != ReferenceAnalysisStatus.COMPLETED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "이 챌린지는 아직 레퍼런스 비디오 분석이 끝나지 않았습니다. 먼저 레퍼런스 분석을 완료해 주세요.");
        }

        ChallengeMotionProfile referenceProfile = challengeMotionProfileRepository.findByChallengeId(challenge.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "이 챌린지의 레퍼런스 모션 프로필을 찾지 못했습니다."));

        motionSessionRuntimeEventPublisher.publishUploadInProgress(challenge.getId());
        try {
            StoredVideo storedVideo;
            try {
                storedVideo = videoStorageService.storeAttemptVideo(challenge.getId(), request.getAttemptVideo());
            } catch (RuntimeException exception) {
                markRetryableFailure(challenge.getId(), FAILURE_CODE_UPLOAD_STORAGE, exception);
                throw exception;
            }

            motionSessionRuntimeEventPublisher.publishUploadStored(challenge.getId());

            try {
                AttemptResultResponse response = attemptVideoProcessingDispatcher.dispatch(new AttemptVideoProcessingCommand(
                        challenge,
                        referenceProfile,
                        storedVideo,
                        request.getNotes()));
                if (response.processingComplete()) {
                    motionSessionRuntimeEventPublisher.publishScoringCompleted(challenge.getId());
                } else {
                    motionSessionRuntimeEventPublisher.publishUploadPending(challenge.getId());
                }
                return response;
            } catch (RuntimeException exception) {
                markRetryableFailure(challenge.getId(), resolvePipelineFailureCode(exception), exception);
                throw exception;
            }
        } catch (RuntimeException exception) {
            throw exception;
        }
    }

    private Challenge findActiveChallenge(Long challengeId) {
        return challengeRepository.findByIdAndIsActiveTrue(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "해당 챌린지를 찾을 수 없습니다."));
    }

    private AttemptProcessingJob resolveProcessingJob(Long challengeId, String trackingId) {
        AttemptProcessingJob processingJob = (trackingId != null && !trackingId.isBlank())
                ? attemptProcessingJobRepository.findByTrackingId(trackingId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "업로드 처리 상태를 찾을 수 없습니다. 추적 ID를 다시 확인해 주세요."))
                : attemptProcessingJobRepository.findTopByChallengeIdOrderByCreatedAtDesc(challengeId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "업로드 처리 상태가 아직 기록되지 않았습니다."));

        if (!processingJob.getChallenge().getId().equals(challengeId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "추적 ID와 챌린지 정보가 일치하지 않습니다.");
        }

        return processingJob;
    }

    private AttemptSummaryResponse toResponse(Attempt attempt) {
        SimpleScoringResult scoringResult = simpleScoringPreviewService.buildResult(
                attempt.getStatus(),
                attempt.getScore());
        String resultSource = resolveResultSource(attempt);
        String processingMode = resolvePersistedProcessingMode(attempt, resultSource);
        boolean processingComplete = resolvePersistedProcessingComplete(attempt, resultSource);
        String processingNotice = resolvePersistedProcessingNotice(attempt, resultSource);

        return new AttemptSummaryResponse(
                attempt.getId(),
                attempt.getChallenge().getId(),
                attempt.getChallenge().getTitle(),
                attempt.getScore(),
                attempt.getStatus(),
                resultSource,
                scoringResult.scoreAvailable(),
                scoringResult.resultHeadline(),
                scoringResult.resultSummary(),
                processingMode,
                processingComplete,
                processingNotice,
                attempt.getCreatedAt());
    }

    private String resolveResultSource(Attempt attempt) {
        if (!AttemptStatus.COMPLETED.equals(attempt.getStatus())) {
            return AttemptResultSource.PREPARED_FLOW;
        }

        boolean hasUploadedVideo = attemptVideoRepository.findByAttemptId(attempt.getId()).isPresent();
        if (hasUploadedVideo) {
            return AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED;
        }

        return AttemptResultSource.SAMPLE_SCORING_PREVIEW;
    }

    private String resolvePersistedProcessingMode(Attempt attempt, String resultSource) {
        if (attempt.getProcessingMode() != null) {
            return attempt.getProcessingMode();
        }

        if (AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED.equals(resultSource)) {
            return "SYNC_INLINE";
        }

        return null;
    }

    private boolean resolvePersistedProcessingComplete(Attempt attempt, String resultSource) {
        if (attempt.getProcessingNotice() != null || attempt.getProcessingMode() != null) {
            return attempt.isProcessingComplete();
        }

        return !AttemptResultSource.PREPARED_FLOW.equals(resultSource);
    }

    private String resolvePersistedProcessingNotice(Attempt attempt, String resultSource) {
        if (attempt.getProcessingNotice() != null && !attempt.getProcessingNotice().isBlank()) {
            return attempt.getProcessingNotice();
        }

        if (AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED.equals(resultSource)) {
            return PROCESSING_NOTICE_AUTOSCORED;
        }
        if (AttemptResultSource.SAMPLE_SCORING_PREVIEW.equals(resultSource)) {
            return PROCESSING_NOTICE_SAMPLE;
        }
        return PROCESSING_NOTICE_PREPARED;
    }

    private String normalizeRecordType(String recordType) {
        if (AttemptRecordType.COMPLETED.equalsIgnoreCase(recordType)) {
            return AttemptRecordType.COMPLETED;
        }

        return AttemptRecordType.PREPARED;
    }

    private int normalizeCompletedScore(int requestedScore) {
        if (requestedScore < MIN_COMPLETED_SCORE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "완료 기록 점수는 최소 1점 이상이어야 합니다.");
        }

        return requestedScore;
    }

    private String normalizePreparedNotes(String notes) {
        if (notes == null || notes.isBlank()) {
            return DEFAULT_PREPARED_NOTE;
        }

        return notes;
    }

    private String normalizeCompletedNotes(String notes) {
        if (notes == null || notes.isBlank()) {
            return DEFAULT_COMPLETED_NOTE;
        }

        return notes;
    }

    private void markRetryableFailure(Long challengeId, String failureCode, RuntimeException exception) {
        motionSessionRuntimeEventPublisher.publishFailedRetryable(
                challengeId,
                failureCode,
                exception.getMessage() == null || exception.getMessage().isBlank()
                        ? DEFAULT_FAILURE_MESSAGE
                        : exception.getMessage());
    }

    private String resolvePipelineFailureCode(RuntimeException exception) {
        String simpleName = exception.getClass().getSimpleName();
        if (simpleName.contains("Score")) {
            return FAILURE_CODE_SCORING;
        }

        return FAILURE_CODE_ANALYSIS;
    }

    private String resolveCompletionStrategy(AttemptProcessingJob processingJob) {
        if (!"ASYNC_JOB_PENDING".equals(processingJob.getProcessingMode())) {
            return "INLINE_FLOW";
        }

        return asyncPendingProperties.isAsyncPendingAutoCompleteEnabled() ? "AUTO_RUNNER" : "MANUAL_COMPLETION";
    }

    private boolean resolveRetryRecommended(AttemptProcessingJob processingJob) {
        return processingJob.getFailureCode() != null
                && !processingJob.getFailureCode().isBlank()
                && "FAILED_RETRYABLE".equals(processingJob.getRuntimeState());
    }

    private int resolveRetryCount(AttemptProcessingJob processingJob) {
        return Math.max(0, processingJob.getProcessingAttempts() - 1);
    }

    private boolean resolveAutoRetryEnabled(AttemptProcessingJob processingJob) {
        return "ASYNC_JOB_PENDING".equals(processingJob.getProcessingMode())
                && asyncPendingProperties.isAsyncPendingAutoCompleteEnabled();
    }

    private int resolveRemainingAutoRetryCount(AttemptProcessingJob processingJob) {
        if (!resolveAutoRetryEnabled(processingJob)) {
            return 0;
        }

        return Math.max(0, asyncPendingProperties.getAsyncPendingAutoCompleteMaxAttempts() - processingJob.getProcessingAttempts());
    }

    private boolean resolveAutoRetryExhausted(AttemptProcessingJob processingJob) {
        return resolveAutoRetryEnabled(processingJob)
                && "FAILED_RETRYABLE".equals(processingJob.getRuntimeState())
                && resolveRemainingAutoRetryCount(processingJob) == 0;
    }

    private String resolveFailureSeverity(AttemptProcessingJob processingJob) {
        String failureCode = processingJob.getFailureCode();
        if (failureCode == null || failureCode.isBlank()) {
            return null;
        }

        return switch (failureCode) {
            case FAILURE_CODE_UPLOAD_STORAGE, FAILURE_CODE_SCORING -> "HIGH";
            case FAILURE_CODE_ANALYSIS -> "WARN";
            default -> "WARN";
        };
    }

    private String resolveFailureAction(AttemptProcessingJob processingJob) {
        String failureCode = processingJob.getFailureCode();
        if (failureCode == null || failureCode.isBlank()) {
            return null;
        }

        return switch (failureCode) {
            case FAILURE_CODE_UPLOAD_STORAGE -> "CHECK_STORAGE";
            case FAILURE_CODE_ANALYSIS -> "RETRY_ANALYSIS";
            case FAILURE_CODE_SCORING -> "RETRY_SCORING";
            default -> "RETRY_UPLOAD";
        };
    }
}
