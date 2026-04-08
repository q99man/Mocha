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
    private static final String DEFAULT_PREPARED_NOTE = "以鍮??④퀎 ?뺤씤???꾪븳 湲곕낯 湲곕줉";
    private static final String DEFAULT_COMPLETED_NOTE = "?섑뵆 ?꾨즺 ?먮쫫 ?뺤씤???꾪븳 湲곕낯 湲곕줉";
    private static final String PROCESSING_NOTICE_AUTOSCORED =
            "?ㅼ젣 ?낅줈??鍮꾨뵒?ㅻ? 湲곗??쇰줈 ?쒕쾭媛 遺꾩꽍怨?梨꾩젏???꾨즺?덉뒿?덈떎.";
    private static final String PROCESSING_NOTICE_SAMPLE =
            "?섑뵆 preview ?먮쫫?쇰줈 留뚮뱺 寃곌낵?낅땲?? ?ㅼ젣 ?낅줈???먮룞 梨꾩젏 寃곌낵???李⑥씠媛 ?덉쓣 ???덉뒿?덈떎.";
    private static final String PROCESSING_NOTICE_PREPARED =
            "以鍮??④퀎?먯꽌 ??ν븳 湲곕줉?낅땲?? ?ㅼ젣 ?낅줈?쒖? ?먮룞 梨꾩젏? ?꾩쭅 吏꾪뻾?섏? ?딆븯?듬땲??";
    private static final String DEFAULT_FAILURE_MESSAGE =
            "泥섎━ 以??????녿뒗 臾몄젣媛 諛쒖깮?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??";

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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "???????筌먲퐣????れ삀??쎈뭄??癲ル슓??젆???????⑤８?????덊렡."));

        return toResponse(attempt);
    }

    public AttemptProcessingJobProgressResponse getAttemptVideoProcessingProgressFallback(Long challengeId, String trackingId) {
        AttemptProcessingJob processingJob = resolveProcessingJobFallback(challengeId, trackingId);
        return toProgressResponse(processingJob);
    }

    public AttemptProcessingJobProgressResponse getAttemptVideoProcessingProgressByTrackingId(String trackingId) {
        AttemptProcessingJob processingJob = attemptProcessingJobRepository.findByTrackingId(trackingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "?怨뺣뾼??ID????????濡ル츎 ???놁Ŧ??嶺뚳퐣瑗????⑤객臾??嶺뚢돦堉??????怨룸????덈펲."));

        return toProgressResponse(processingJob);
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "????겾????レ춵 ??筌먲퐣?????????? ?沃섅굥?? ???ャ뀕?????낆뒩??뗫빝??");
        }

        Challenge challenge = findActiveChallenge(request.getChallengeId());
        if (challenge.getReferenceAnalysisStatus() != ReferenceAnalysisStatus.COMPLETED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "??癲???????????ш끽維쀧빊?????녿군???Β?レ릇 ?????????됰슣維?????筌롫챶猷롳┼??넊? ????⒱봼?????? ?沃섅굥?? ????녿군???Β?レ릇 ??됰슣維?????ш끽維?????낆뒩??뗫빝??");
        }

        ChallengeMotionProfile referenceProfile = challengeMotionProfileRepository.findByChallengeId(challenge.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "??癲?????????????녿군???Β?レ릇 癲ル슢?꾤땟????ш끽維곩ㅇ??ш끽維쀨キ?癲ル슓??젆? 癲ル슢履뉑쾮?彛??????"));

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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "?????癲?????????癲ル슓??젆???????⑤８?????덊렡."));
    }

    private AttemptProcessingJob resolveProcessingJobFallback(Long challengeId, String trackingId) {
        AttemptProcessingJob processingJob = (trackingId != null && !trackingId.isBlank())
                ? attemptProcessingJobRepository.findByTrackingId(trackingId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "??낆쨮??筌ｌ꼶???怨밴묶??筌≪뼚??????곷뮸??덈뼄. ?곕뗄??ID????쇰뻻 ?類ㅼ뵥??雅뚯눘苑??"))
                : attemptProcessingJobRepository.findTopByChallengeIdOrderByUpdatedAtDesc(challengeId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "??낆쨮??筌ｌ꼶???怨밴묶揶쎛 ?袁⑹춦 疫꿸퀡以??? ??녿릭??щ빍??"));

        if (!processingJob.getChallenge().getId().equals(challengeId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "?곕뗄??ID?? 筌?슢?쏉쭪? ?類ｋ궖揶쎛 ??깊뒄??? ??녿뮸??덈뼄.");
        }

        return processingJob;
    }

    private AttemptProcessingJobProgressResponse toProgressResponse(AttemptProcessingJob processingJob) {
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

    private AttemptSummaryResponse toResponse(Attempt attempt) {
        SimpleScoringResult scoringResult = simpleScoringPreviewService.buildResult(
                attempt.getStatus(),
                attempt.getScore());
        String resultSource = resolveResultSource(attempt);
        String processingMode = resolvePersistedProcessingMode(attempt, resultSource);
        boolean processingComplete = resolvePersistedProcessingComplete(attempt, resultSource);
        String processingNotice = resolvePersistedProcessingNotice(attempt, resultSource);
        AttemptProcessingJob latestProcessingJob = resolveLatestProcessingJobForAttempt(attempt).orElse(null);

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
                resolvePendingTrackingId(attempt),
                latestProcessingJob != null ? latestProcessingJob.getStatus().name() : null,
                latestProcessingJob != null ? resolveCompletionStrategy(latestProcessingJob) : null,
                latestProcessingJob != null ? resolveElapsedSeconds(latestProcessingJob) : null,
                latestProcessingJob != null && resolveAutoRetryEnabled(latestProcessingJob),
                latestProcessingJob != null ? resolveRemainingAutoRetryCount(latestProcessingJob) : 0,
                latestProcessingJob != null && resolveAutoRetryExhausted(latestProcessingJob),
                latestProcessingJob != null ? latestProcessingJob.getOriginalFileName() : null,
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

    private String resolvePendingTrackingId(Attempt attempt) {
        return attemptProcessingJobRepository.findTopByResultAttemptIdOrderByUpdatedAtDesc(attempt.getId())
                .map(AttemptProcessingJob::getTrackingId)
                .orElse(null);
    }

    private java.util.Optional<AttemptProcessingJob> resolveLatestProcessingJobForAttempt(Attempt attempt) {
        return attemptProcessingJobRepository.findTopByResultAttemptIdOrderByUpdatedAtDesc(attempt.getId());
    }

    private Long resolveElapsedSeconds(AttemptProcessingJob processingJob) {
        return Math.max(0L, Duration.between(processingJob.getCreatedAt(), processingJob.getUpdatedAt()).getSeconds());
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "??ш끽維????れ삀??쎈뭄???????癲ル슔?됭짆??1?????⑤?彛???⑤９苑????筌뤾퍓???");
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
