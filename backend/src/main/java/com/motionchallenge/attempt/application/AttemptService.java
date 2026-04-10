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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
    private static final String DEFAULT_PREPARED_NOTE = "Prepared state saved for this challenge.";
    private static final String DEFAULT_COMPLETED_NOTE = "Prototype completed result saved.";
    private static final String PROCESSING_NOTICE_AUTOSCORED =
            "The uploaded video was analyzed and scored automatically.";
    private static final String PROCESSING_NOTICE_SAMPLE =
            "This is a prototype preview result, not a real uploaded video comparison.";
    private static final String PROCESSING_NOTICE_PREPARED =
            "This record is still in the prepared state. Upload a real video to start analysis.";
    private static final String DEFAULT_FAILURE_MESSAGE =
            "Processing failed. Please check the logs and retry the upload.";

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
        List<Attempt> attempts = attemptRepository.findAllWithChallengeOrderByCreatedAtDesc();
        Set<Long> uploadedAttemptIds = findUploadedAttemptIds(attempts);
        Map<Long, AttemptComparisonSnapshot> comparisonByAttemptId = buildComparisonByAttemptId(attempts, uploadedAttemptIds);

        return attempts.stream()
                .map(attempt -> toResponse(
                        attempt,
                        comparisonByAttemptId.get(attempt.getId()),
                        uploadedAttemptIds.contains(attempt.getId())))
                .toList();
    }

    public AttemptSummaryResponse getAttempt(Long id) {
        Attempt attempt = attemptRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attempt not found."));

        boolean hasUploadedVideo = findUploadedAttemptIds(List.of(attempt)).contains(attempt.getId());
        AttemptComparisonSnapshot comparison = buildComparisonSnapshot(attempt, hasUploadedVideo);
        return toResponse(attempt, comparison, hasUploadedVideo);
    }

    public AttemptProcessingJobProgressResponse getAttemptVideoProcessingProgressFallback(Long challengeId, String trackingId) {
        AttemptProcessingJob processingJob = resolveProcessingJobFallback(challengeId, trackingId);
        return toProgressResponse(processingJob);
    }

    public AttemptProcessingJobProgressResponse getAttemptVideoProcessingProgressByTrackingId(String trackingId) {
        AttemptProcessingJob processingJob = attemptProcessingJobRepository.findByTrackingId(trackingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No processing job found for the provided trackingId."));

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

        return toResponse(attempt, null, false);
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

        return toResponse(attempt, null, false);
    }

    @Transactional
    public AttemptResultResponse submitAttemptVideo(AttemptVideoUploadRequest request) {
        if (request.getAttemptVideo() == null || request.getAttemptVideo().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attempt video file is required.");
        }

        Challenge challenge = findActiveChallenge(request.getChallengeId());
        if (challenge.getReferenceAnalysisStatus() != ReferenceAnalysisStatus.COMPLETED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Reference analysis must be completed before uploading an attempt video.");
        }

        ChallengeMotionProfile referenceProfile = challengeMotionProfileRepository.findByChallengeId(challenge.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Reference motion profile is missing for this challenge."));

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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Challenge not found."));
    }

    private AttemptProcessingJob resolveProcessingJobFallback(Long challengeId, String trackingId) {
        AttemptProcessingJob processingJob = (trackingId != null && !trackingId.isBlank())
                ? attemptProcessingJobRepository.findByTrackingId(trackingId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "No processing job found for the provided trackingId."))
                : attemptProcessingJobRepository.findTopByChallengeIdOrderByUpdatedAtDesc(challengeId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "No processing job history found for this challenge."));

        if (!processingJob.getChallenge().getId().equals(challengeId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "trackingId does not match the challengeId.");
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
                normalizeDisplayText(processingJob.getProcessingNotice()),
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
    private AttemptSummaryResponse toResponse(
            Attempt attempt,
            AttemptComparisonSnapshot comparison,
            boolean hasUploadedVideo) {
        String resultSource = resolveResultSource(attempt, hasUploadedVideo);
        String displayStatus = resolveDisplayStatus(attempt, resultSource);
        SimpleScoringResult scoringResult = simpleScoringPreviewService.buildResult(displayStatus, attempt.getScore());
        String processingMode = resolvePersistedProcessingMode(attempt, resultSource);
        boolean processingComplete = resolvePersistedProcessingComplete(attempt, resultSource);
        String processingNotice = resolvePersistedProcessingNotice(attempt, resultSource);
        AttemptProcessingJob latestProcessingJob = resolveLatestProcessingJobForAttempt(attempt).orElse(null);

        return new AttemptSummaryResponse(
                attempt.getId(),
                attempt.getChallenge().getId(),
                attempt.getChallenge().getTitle(),
                attempt.getScore(),
                displayStatus,
                resultSource,
                scoringResult.scoreAvailable(),
                scoringResult.resultHeadline(),
                resolveResultSummary(attempt, scoringResult),
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
                attempt.getPoseSimilarity(),
                attempt.getTimingSimilarity(),
                attempt.getStabilitySimilarity(),
                normalizeDisplayText(attempt.getStrongestArea()),
                normalizeDisplayText(attempt.getWeakestArea()),
                buildCoachingTeaser(attempt, comparison, hasUploadedVideo),
                buildRetryFocus(attempt, comparison, hasUploadedVideo),
                buildKeepStableFocus(attempt, comparison, hasUploadedVideo),
                comparison != null ? comparison.previousAttemptId() : null,
                comparison != null ? comparison.previousAttemptScore() : null,
                comparison != null ? comparison.previousAttemptedAt() : null,
                comparison != null ? comparison.scoreDeltaFromPrevious() : null,
                comparison != null ? comparison.poseDeltaFromPrevious() : null,
                comparison != null ? comparison.timingDeltaFromPrevious() : null,
                comparison != null ? comparison.stabilityDeltaFromPrevious() : null,
                attempt.getCreatedAt());
    }

    private Map<Long, AttemptComparisonSnapshot> buildComparisonByAttemptId(
            List<Attempt> attempts,
            Set<Long> uploadedAttemptIds) {
        Map<Long, AttemptComparisonSnapshot> comparisonByAttemptId = new HashMap<>();
        Map<Long, Attempt> latestScoredAttemptByChallengeId = new HashMap<>();

        attempts.stream()
                .sorted((left, right) -> {
                    int createdAtComparison = left.getCreatedAt().compareTo(right.getCreatedAt());
                    if (createdAtComparison != 0) {
                        return createdAtComparison;
                    }
                    return left.getId().compareTo(right.getId());
                })
                .forEach(attempt -> {
                    if (!isAutoScoredAttempt(attempt, uploadedAttemptIds)) {
                        return;
                    }

                    Attempt previousAttempt = latestScoredAttemptByChallengeId.get(attempt.getChallenge().getId());
                    if (previousAttempt != null) {
                        comparisonByAttemptId.put(attempt.getId(), AttemptComparisonSnapshot.from(previousAttempt, attempt));
                    }

                    latestScoredAttemptByChallengeId.put(attempt.getChallenge().getId(), attempt);
                });

        return comparisonByAttemptId;
    }

    private AttemptComparisonSnapshot buildComparisonSnapshot(Attempt attempt, boolean hasUploadedVideo) {
        if (!isAutoScoredAttempt(attempt, hasUploadedVideo)) {
            return null;
        }

        List<Attempt> attempts = attemptRepository.findByChallengeIdWithChallengeOrderByCreatedAtAsc(attempt.getChallenge().getId());
        Set<Long> uploadedAttemptIds = findUploadedAttemptIds(attempts);
        Attempt previousAttempt = null;
        for (Attempt candidate : attempts) {
            if (candidate.getId().equals(attempt.getId())) {
                break;
            }
            if (!isAutoScoredAttempt(candidate, uploadedAttemptIds)) {
                continue;
            }
            previousAttempt = candidate;
        }

        return previousAttempt == null ? null : AttemptComparisonSnapshot.from(previousAttempt, attempt);
    }

    private record AttemptComparisonSnapshot(
            Long previousAttemptId,
            Integer previousAttemptScore,
            LocalDateTime previousAttemptedAt,
            Integer scoreDeltaFromPrevious,
            Integer poseDeltaFromPrevious,
            Integer timingDeltaFromPrevious,
            Integer stabilityDeltaFromPrevious) {

        private static AttemptComparisonSnapshot from(Attempt previousAttempt, Attempt currentAttempt) {
            return new AttemptComparisonSnapshot(
                    previousAttempt.getId(),
                    previousAttempt.getScore(),
                    previousAttempt.getCreatedAt(),
                    currentAttempt.getScore() - previousAttempt.getScore(),
                    computeDelta(currentAttempt.getPoseSimilarity(), previousAttempt.getPoseSimilarity()),
                    computeDelta(currentAttempt.getTimingSimilarity(), previousAttempt.getTimingSimilarity()),
                    computeDelta(currentAttempt.getStabilitySimilarity(), previousAttempt.getStabilitySimilarity()));
        }

        private static Integer computeDelta(Integer currentValue, Integer previousValue) {
            if (currentValue == null || previousValue == null) {
                return null;
            }
            return currentValue - previousValue;
        }
    }

    private String buildCoachingTeaser(
            Attempt attempt,
            AttemptComparisonSnapshot comparison,
            boolean hasUploadedVideo) {
        if (!isAutoScoredAttempt(attempt, hasUploadedVideo)) {
            return null;
        }

        String weakestArea = normalizeDisplayText(attempt.getWeakestArea());
        String strongestArea = normalizeDisplayText(attempt.getStrongestArea());
        AttemptDeltaMetric bestMetric = buildPrimaryDeltaMetric(comparison, true);
        AttemptDeltaMetric worstMetric = buildPrimaryDeltaMetric(comparison, false);

        if ("timing".equals(weakestArea)) {
            return "Next retry: tighten timing first." + buildDeltaTail(bestMetric, worstMetric);
        }
        if ("detection stability".equals(weakestArea)) {
            return "Next retry: clean up framing before changing the move itself." + buildDeltaTail(bestMetric, worstMetric);
        }
        if ("pose similarity".equals(weakestArea)) {
            return "Next retry: recover the big body shapes before adjusting speed." + buildDeltaTail(bestMetric, worstMetric);
        }
        if (attempt.getScore() >= 85 && strongestArea != null) {
            return "Strong run overall. Keep " + strongestArea + " steady." + buildDeltaTail(bestMetric, worstMetric);
        }
        if (comparison != null && comparison.scoreDeltaFromPrevious() != null) {
            return "Keep the same camera setup and change one variable at a time. Score trend: "
                    + formatSignedDelta(comparison.scoreDeltaFromPrevious())
                    + " pts."
                    + buildDeltaTail(bestMetric, worstMetric);
        }
        return "Next retry: keep the same camera setup and change only one variable so the next score shift is easier to read.";
    }

    private AttemptDeltaMetric buildPrimaryDeltaMetric(AttemptComparisonSnapshot comparison, boolean best) {
        if (comparison == null) {
            return null;
        }

        AttemptDeltaMetric[] metrics = new AttemptDeltaMetric[] {
            buildDeltaMetric("Pose", comparison.poseDeltaFromPrevious()),
            buildDeltaMetric("Timing", comparison.timingDeltaFromPrevious()),
            buildDeltaMetric("Stability", comparison.stabilityDeltaFromPrevious())
        };

        AttemptDeltaMetric selected = null;
        for (AttemptDeltaMetric metric : metrics) {
            if (metric == null) {
                continue;
            }
            if (selected == null) {
                selected = metric;
                continue;
            }
            if (best && metric.delta() > selected.delta()) {
                selected = metric;
            }
            if (!best && metric.delta() < selected.delta()) {
                selected = metric;
            }
        }
        return selected;
    }

    private AttemptDeltaMetric buildDeltaMetric(String label, Integer delta) {
        return delta == null ? null : new AttemptDeltaMetric(label, delta);
    }

    private String buildDeltaTail(AttemptDeltaMetric bestMetric, AttemptDeltaMetric worstMetric) {
        StringBuilder tail = new StringBuilder();
        if (bestMetric != null && bestMetric.delta() > 0) {
            tail.append(" ").append(bestMetric.label()).append(" improved ").append(formatSignedDelta(bestMetric.delta())).append(".");
        }
        if (worstMetric != null && worstMetric.delta() < 0) {
            tail.append(" ").append(worstMetric.label()).append(" slipped ").append(formatSignedDelta(worstMetric.delta())).append(".");
        }
        return tail.toString();
    }

    private String formatSignedDelta(int delta) {
        return (delta >= 0 ? "+" : "") + delta;
    }

    private record AttemptDeltaMetric(String label, int delta) {
    }
    private String buildRetryFocus(
            Attempt attempt,
            AttemptComparisonSnapshot comparison,
            boolean hasUploadedVideo) {
        if (!isAutoScoredAttempt(attempt, hasUploadedVideo)) {
            return null;
        }

        String weakestArea = normalizeDisplayText(attempt.getWeakestArea());
        AttemptDeltaMetric worstMetric = buildPrimaryDeltaMetric(comparison, false);

        if (weakestArea != null) {
            String message = "Focus the next retry on " + weakestArea + " first.";
            if (worstMetric != null && worstMetric.delta() < 0) {
                message += " " + worstMetric.label() + " also moved " + formatSignedDelta(worstMetric.delta()) + ".";
            }
            return message;
        }

        if (comparison != null && comparison.scoreDeltaFromPrevious() != null) {
            return "Keep the capture setup stable and isolate one variable. Latest score trend: "
                    + formatSignedDelta(comparison.scoreDeltaFromPrevious())
                    + " pts.";
        }

        return "Use the next retry to create a clean baseline with the same camera setup.";
    }

    private String buildKeepStableFocus(
            Attempt attempt,
            AttemptComparisonSnapshot comparison,
            boolean hasUploadedVideo) {
        if (!isAutoScoredAttempt(attempt, hasUploadedVideo)) {
            return null;
        }

        String strongestArea = normalizeDisplayText(attempt.getStrongestArea());
        AttemptDeltaMetric bestMetric = buildPrimaryDeltaMetric(comparison, true);

        if (strongestArea != null) {
            String message = "Keep " + strongestArea + " stable on the next retry.";
            if (bestMetric != null && bestMetric.delta() > 0) {
                message += " " + bestMetric.label() + " improved " + formatSignedDelta(bestMetric.delta()) + ".";
            }
            return message;
        }

        if (bestMetric != null && bestMetric.delta() > 0) {
            return "Preserve the setup that improved " + bestMetric.label() + " by " + formatSignedDelta(bestMetric.delta()) + ".";
        }

        return "Keep the current framing, lighting, and tempo as consistent as possible across retries.";
    }

    private String resolveResultSource(Attempt attempt, boolean hasUploadedVideo) {
        if (!AttemptStatus.COMPLETED.equals(attempt.getStatus())) {
            return AttemptResultSource.PREPARED_FLOW;
        }

        if (hasUploadedVideo) {
            return AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED;
        }

        return AttemptResultSource.SAMPLE_SCORING_PREVIEW;
    }

    private Set<Long> findUploadedAttemptIds(List<Attempt> attempts) {
        if (attempts.isEmpty()) {
            return Set.of();
        }

        Set<Long> attemptIds = new HashSet<>();
        for (Attempt attempt : attempts) {
            attemptIds.add(attempt.getId());
        }

        return new HashSet<>(attemptVideoRepository.findAttemptIdsByAttemptIdIn(attemptIds));
    }

    private boolean isAutoScoredAttempt(Attempt attempt, Set<Long> uploadedAttemptIds) {
        return isAutoScoredAttempt(attempt, uploadedAttemptIds.contains(attempt.getId()));
    }

    private boolean isAutoScoredAttempt(Attempt attempt, boolean hasUploadedVideo) {
        return AttemptStatus.COMPLETED.equals(attempt.getStatus()) && hasUploadedVideo;
    }

    private String resolveResultSummary(Attempt attempt, SimpleScoringResult scoringResult) {
        String normalizedNotes = normalizeDisplayText(attempt.getNotes());
        if (normalizedNotes != null && !normalizedNotes.isBlank()) {
            return normalizedNotes;
        }

        return scoringResult.resultSummary();
    }

    private String resolveDisplayStatus(Attempt attempt, String resultSource) {
        String status = normalizeDisplayText(attempt.getStatus());
        if (AttemptResultSource.PREPARED_FLOW.equals(resultSource)) {
            return AttemptStatus.PREPARED;
        }
        if (AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED.equals(resultSource)
                || AttemptResultSource.SAMPLE_SCORING_PREVIEW.equals(resultSource)) {
            return AttemptStatus.COMPLETED;
        }
        return status == null || status.isBlank() ? AttemptStatus.PREPARED : status;
    }

    private String normalizeDisplayText(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        if (looksGarbled(value)) {
            return null;
        }
        return value;
    }

    private boolean looksGarbled(String value) {
        return value.contains("??") || value.contains("\uFFFD");
    }

    private String resolvePendingTrackingId(Attempt attempt) {
        return attemptProcessingJobRepository.findTopByResultAttemptIdOrderByUpdatedAtDesc(attempt.getId())
                .map(AttemptProcessingJob::getTrackingId)
                .orElse(null);
    }

    private Optional<AttemptProcessingJob> resolveLatestProcessingJobForAttempt(Attempt attempt) {
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
        String normalizedNotice = normalizeDisplayText(attempt.getProcessingNotice());
        if (normalizedNotice != null && !normalizedNotice.isBlank()) {
            return normalizedNotice;
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completed prototype score must be at least 1.");
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
