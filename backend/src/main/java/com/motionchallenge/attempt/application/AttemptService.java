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
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.service.CurrentMemberService;
import com.motionchallenge.motion.service.MotionAnalysisModeSupport;
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
    private static final int MIN_COMPLETED_SCORE = 0;
    private static final String DEFAULT_PREPARED_NOTE = "이 챌린지의 준비 상태가 저장되었습니다.";
    private static final String DEFAULT_COMPLETED_NOTE = "프로토타입 완료 결과가 저장되었습니다.";
    private static final String PROCESSING_NOTICE_AUTOSCORED =
            "업로드한 영상이 자동으로 분석되고 채점되었습니다.";
    private static final String PROCESSING_NOTICE_SAMPLE =
            "이 결과는 실제 업로드 비교가 아니라 프로토타입 미리보기 결과입니다.";
    private static final String PROCESSING_NOTICE_PREPARED =
            "이 기록은 아직 준비 상태입니다. 실제 영상을 업로드하면 분석이 시작됩니다.";
    private static final String DEFAULT_FAILURE_MESSAGE =
            "처리에 실패했습니다. 로그를 확인한 뒤 다시 업로드해 주세요.";

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
    private final AttemptJudgementTimelineService attemptJudgementTimelineService;
    private final CurrentMemberService currentMemberService;

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
            AttemptAsyncPendingProperties asyncPendingProperties,
            AttemptJudgementTimelineService attemptJudgementTimelineService,
            CurrentMemberService currentMemberService) {
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
        this.attemptJudgementTimelineService = attemptJudgementTimelineService;
        this.currentMemberService = currentMemberService;
    }

    public List<AttemptSummaryResponse> getAttempts() {
        Member member = currentMemberService.requireCurrentMember();
        List<Attempt> attempts = attemptRepository.findAllWithChallengeByMemberIdOrderByCreatedAtDesc(member.getId());
        Set<Long> uploadedAttemptIds = findUploadedAttemptIds(attempts);
        Map<Long, AttemptComparisonSnapshot> comparisonByAttemptId = buildComparisonByAttemptId(attempts, uploadedAttemptIds);
        Map<Long, AttemptProcessingJob> latestProcessingJobByAttemptId = findLatestProcessingJobsByAttemptId(attempts);

        return attempts.stream()
                .map(attempt -> toResponse(
                        attempt,
                        comparisonByAttemptId.get(attempt.getId()),
                        uploadedAttemptIds.contains(attempt.getId()),
                        latestProcessingJobByAttemptId.get(attempt.getId()),
                        false))
                .toList();
    }

    public AttemptSummaryResponse getAttempt(Long id) {
        Member member = currentMemberService.requireCurrentMember();
        Attempt attempt = attemptRepository.findByIdAndMemberIdWithChallenge(id, member.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "시도 기록을 찾을 수 없습니다."));

        boolean hasUploadedVideo = findUploadedAttemptIds(List.of(attempt)).contains(attempt.getId());
        AttemptComparisonSnapshot comparison = buildComparisonSnapshot(attempt, hasUploadedVideo);
        AttemptProcessingJob latestProcessingJob = findLatestProcessingJobsByAttemptId(List.of(attempt)).get(attempt.getId());
        return toResponse(attempt, comparison, hasUploadedVideo, latestProcessingJob, true);
    }

    public AttemptProcessingJobProgressResponse getAttemptVideoProcessingProgressFallback(Long challengeId, String trackingId) {
        Member member = currentMemberService.requireCurrentMember();
        AttemptProcessingJob processingJob = resolveProcessingJobFallback(member.getId(), challengeId, trackingId);
        return toProgressResponse(processingJob);
    }

    public AttemptProcessingJobProgressResponse getAttemptVideoProcessingProgressByTrackingId(String trackingId) {
        Member member = currentMemberService.requireCurrentMember();
        AttemptProcessingJob processingJob = attemptProcessingJobRepository.findByTrackingIdAndMemberId(trackingId, member.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "입력한 trackingId에 해당하는 처리 작업을 찾을 수 없습니다."));

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
        Member member = currentMemberService.requireCurrentMember();
        Challenge challenge = findActiveChallenge(challengeId);
        Attempt attempt = attemptRepository.findTopByChallengeIdAndMemberIdOrderByCreatedAtDescIdDesc(challengeId, member.getId())
                .orElseGet(() -> new Attempt(
                        challenge,
                        member,
                        PREPARED_SCORE,
                        AttemptStatus.PREPARED,
                        null,
                        false,
                        PROCESSING_NOTICE_PREPARED,
                        normalizePreparedNotes(notes)));

        attempt.updatePreparedState(normalizePreparedNotes(notes), PROCESSING_NOTICE_PREPARED);
        attempt = attemptRepository.save(attempt);
        removeAttemptVideoIfPresent(attempt);
        consolidateAttemptHistory(challengeId, member.getId(), attempt.getId());

        return toResponse(attempt, null, false, null, false);
    }

    @Transactional
    public AttemptSummaryResponse createCompletedAttempt(CompletedAttemptCommand command) {
        Member member = currentMemberService.requireCurrentMember();
        Challenge challenge = findActiveChallenge(command.challengeId());
        int normalizedScore = normalizeCompletedScore(command.score());
        Attempt attempt = attemptRepository.findTopByChallengeIdAndMemberIdOrderByCreatedAtDescIdDesc(challenge.getId(), member.getId())
                .orElseGet(() -> new Attempt(
                        challenge,
                        member,
                        normalizedScore,
                        AttemptStatus.COMPLETED,
                        null,
                        true,
                        PROCESSING_NOTICE_SAMPLE,
                        normalizeCompletedNotes(command.notes())));

        attempt.updateCompletedState(normalizedScore, normalizeCompletedNotes(command.notes()), PROCESSING_NOTICE_SAMPLE);
        attempt = attemptRepository.save(attempt);
        removeAttemptVideoIfPresent(attempt);
        consolidateAttemptHistory(challenge.getId(), member.getId(), attempt.getId());

        return toResponse(attempt, null, false, null, false);
    }

    @Transactional
    public AttemptResultResponse submitAttemptVideo(AttemptVideoUploadRequest request) {
        Member member = currentMemberService.requireCurrentMember();
        if (request.getAttemptVideo() == null || request.getAttemptVideo().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "시도 영상 파일이 필요합니다.");
        }

        Challenge challenge = findActiveChallenge(request.getChallengeId());
        if (challenge.getReferenceAnalysisStatus() != ReferenceAnalysisStatus.COMPLETED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "시도 영상을 업로드하기 전에 레퍼런스 분석이 완료되어야 합니다.");
        }

        ChallengeMotionProfile referenceProfile = challengeMotionProfileRepository.findByChallengeId(challenge.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "이 챌린지의 레퍼런스 모션 프로필이 없습니다."));
        if (MotionAnalysisModeSupport.isStubAnalyzerName(referenceProfile.getAnalyzerName())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "레퍼런스 분석이 실제 MediaPipe 결과가 아닙니다. 관리자에서 레퍼런스 분석을 다시 실행해 주세요.");
        }

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
                        member,
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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));
    }

    private AttemptProcessingJob resolveProcessingJobFallback(Long memberId, Long challengeId, String trackingId) {
        AttemptProcessingJob processingJob = (trackingId != null && !trackingId.isBlank())
                ? attemptProcessingJobRepository.findByTrackingIdAndMemberId(trackingId, memberId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "입력한 trackingId에 해당하는 처리 작업을 찾을 수 없습니다."))
                : attemptProcessingJobRepository.findTopByChallengeIdAndMemberIdOrderByUpdatedAtDesc(challengeId, memberId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "이 챌린지의 처리 작업 이력을 찾을 수 없습니다."));

        if (!processingJob.getChallenge().getId().equals(challengeId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "trackingId가 challengeId와 일치하지 않습니다.");
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
            boolean hasUploadedVideo,
            AttemptProcessingJob latestProcessingJob,
            boolean includeJudgementTimeline) {
        String resultSource = resolveResultSource(attempt, hasUploadedVideo);
        String displayStatus = resolveDisplayStatus(attempt, resultSource);
        SimpleScoringResult scoringResult = simpleScoringPreviewService.buildResult(displayStatus, attempt.getScore());
        String processingMode = resolvePersistedProcessingMode(attempt, resultSource);
        boolean processingComplete = resolvePersistedProcessingComplete(attempt, resultSource);
        String processingNotice = resolvePersistedProcessingNotice(attempt, resultSource);
        String attemptVideoUrl = includeJudgementTimeline && hasUploadedVideo
                ? attemptVideoRepository.findByAttemptId(attempt.getId())
                        .map(video -> "/uploads/" + video.getStoragePath())
                        .orElse(null)
                : null;
        AttemptProcessingJob responseProcessingJob = AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED.equals(resultSource)
                ? latestProcessingJob
                : null;
        List<AttemptJudgementCueResponse> judgementTimeline = includeJudgementTimeline && AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED.equals(resultSource)
                ? attemptJudgementTimelineService.readTimeline(attempt.getJudgementTimelineData())
                : List.of();

        return new AttemptSummaryResponse(
                attempt.getId(),
                attempt.getChallenge().getId(),
                attempt.getChallenge().getTitle(),
                attemptVideoUrl,
                attempt.getMember().getId(),
                attempt.getMember().getDisplayName(),
                attempt.getMember().getEmail(),
                attempt.getScore(),
                displayStatus,
                resultSource,
                scoringResult.scoreAvailable(),
                scoringResult.resultHeadline(),
                resolveResultSummary(attempt, scoringResult, resultSource),
                judgementTimeline,
                processingMode,
                processingComplete,
                processingNotice,
                responseProcessingJob != null ? responseProcessingJob.getTrackingId() : null,
                responseProcessingJob != null ? responseProcessingJob.getStatus().name() : null,
                responseProcessingJob != null ? resolveCompletionStrategy(responseProcessingJob) : null,
                responseProcessingJob != null ? resolveElapsedSeconds(responseProcessingJob) : null,
                responseProcessingJob != null && resolveAutoRetryEnabled(responseProcessingJob),
                responseProcessingJob != null ? resolveRemainingAutoRetryCount(responseProcessingJob) : 0,
                responseProcessingJob != null && resolveAutoRetryExhausted(responseProcessingJob),
                responseProcessingJob != null ? responseProcessingJob.getOriginalFileName() : null,
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
                attempt.getUpdatedAt());
    }

    private void removeAttemptVideoIfPresent(Attempt attempt) {
        attemptVideoRepository.findByAttemptId(attempt.getId()).ifPresent(attemptVideo -> {
            String storagePath = attemptVideo.getStoragePath();
            attemptVideoRepository.delete(attemptVideo);
            if (storagePath != null && !storagePath.isBlank()) {
                videoStorageService.deleteStoredVideo(storagePath);
            }
        });
    }

    private void consolidateAttemptHistory(Long challengeId, Long memberId, Long keepAttemptId) {
        List<Attempt> memberAttempts = attemptRepository.findByChallengeIdAndMemberIdOrderByCreatedAtAscIdAsc(challengeId, memberId);
        if (memberAttempts.size() <= 1) {
            return;
        }

        List<Attempt> duplicateAttempts = memberAttempts.stream()
                .filter(attempt -> !attempt.getId().equals(keepAttemptId))
                .toList();
        if (duplicateAttempts.isEmpty()) {
            return;
        }

        Set<Long> duplicateAttemptIds = new HashSet<>();
        for (Attempt duplicateAttempt : duplicateAttempts) {
            duplicateAttemptIds.add(duplicateAttempt.getId());
        }

        for (var duplicateVideo : attemptVideoRepository.findByAttemptIdIn(duplicateAttemptIds)) {
            String storagePath = duplicateVideo.getStoragePath();
            attemptVideoRepository.delete(duplicateVideo);
            if (storagePath != null && !storagePath.isBlank()) {
                videoStorageService.deleteStoredVideo(storagePath);
            }
        }

        List<AttemptProcessingJob> duplicateJobs = attemptProcessingJobRepository
                .findByResultAttemptIdInOrderByResultAttemptIdAscUpdatedAtDescIdDesc(duplicateAttemptIds);
        if (!duplicateJobs.isEmpty()) {
            attemptProcessingJobRepository.deleteAllInBatch(duplicateJobs);
        }

        attemptRepository.deleteAllInBatch(duplicateAttempts);
    }

    private Map<Long, AttemptComparisonSnapshot> buildComparisonByAttemptId(
            List<Attempt> attempts,
            Set<Long> uploadedAttemptIds) {
        Map<Long, AttemptComparisonSnapshot> comparisonByAttemptId = new HashMap<>();
        Map<Long, Attempt> latestScoredAttemptByChallengeId = new HashMap<>();

        attempts.stream()
                .sorted((left, right) -> {
                    int createdAtComparison = left.getUpdatedAt().compareTo(right.getUpdatedAt());
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

        List<Attempt> attempts = attemptRepository.findByChallengeIdAndMemberIdWithChallengeOrderByCreatedAtAsc(
                attempt.getChallenge().getId(),
                attempt.getMember().getId());
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
                    previousAttempt.getUpdatedAt(),
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

        if ("pose timing".equals(weakestArea)) {
            return "다음 재도전에서는 타이밍부터 먼저 다듬어 보세요." + buildDeltaTail(bestMetric, worstMetric);
        }
        if ("detection quality".equals(weakestArea)) {
            return "다음 재도전에서는 동작보다 먼저 구도와 가시성을 정리해 보세요." + buildDeltaTail(bestMetric, worstMetric);
        }
        if ("pose shape".equals(weakestArea)) {
            return "다음 재도전에서는 속도보다 큰 몸 모양을 먼저 회복해 보세요." + buildDeltaTail(bestMetric, worstMetric);
        }
        if (attempt.getScore() >= 85 && strongestArea != null) {
            return "전체적으로 좋은 결과입니다. " + strongestArea + "은 지금처럼 안정적으로 유지해 주세요." + buildDeltaTail(bestMetric, worstMetric);
        }
        if (comparison != null && comparison.scoreDeltaFromPrevious() != null) {
            return "카메라 세팅은 유지하고 한 번에 한 가지 변수만 바꿔 보세요. 점수 흐름: "
                    + formatSignedDelta(comparison.scoreDeltaFromPrevious())
                    + "점."
                    + buildDeltaTail(bestMetric, worstMetric);
        }
        return "다음 재도전에서는 같은 카메라 세팅을 유지하고 한 가지 변수만 바꿔서 점수 변화를 더 읽기 쉽게 만들어 보세요.";
    }

    private AttemptDeltaMetric buildPrimaryDeltaMetric(AttemptComparisonSnapshot comparison, boolean best) {
        if (comparison == null) {
            return null;
        }

        AttemptDeltaMetric[] metrics = new AttemptDeltaMetric[] {
            buildDeltaMetric("모양", comparison.poseDeltaFromPrevious()),
            buildDeltaMetric("타이밍", comparison.timingDeltaFromPrevious()),
            buildDeltaMetric("품질", comparison.stabilityDeltaFromPrevious())
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

    private String resolveResultSummary(Attempt attempt, SimpleScoringResult scoringResult, String resultSource) {
        String persistedResultSummary = normalizeDisplayText(attempt.getResultSummary());
        if (persistedResultSummary != null && !persistedResultSummary.isBlank()) {
            return persistedResultSummary;
        }

        if (AttemptResultSource.VIDEO_UPLOAD_AUTOSCORED.equals(resultSource)) {
            return scoringResult.resultSummary();
        }

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

    private Map<Long, AttemptProcessingJob> findLatestProcessingJobsByAttemptId(List<Attempt> attempts) {
        if (attempts.isEmpty()) {
            return Map.of();
        }

        Set<Long> attemptIds = new HashSet<>();
        for (Attempt attempt : attempts) {
            attemptIds.add(attempt.getId());
        }

        Map<Long, AttemptProcessingJob> latestProcessingJobByAttemptId = new HashMap<>();
        for (AttemptProcessingJob processingJob : attemptProcessingJobRepository
                .findByResultAttemptIdInOrderByResultAttemptIdAscUpdatedAtDescIdDesc(attemptIds)) {
            latestProcessingJobByAttemptId.putIfAbsent(processingJob.getResultAttemptId(), processingJob);
        }
        return latestProcessingJobByAttemptId;
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "완료된 프로토타입 점수는 최소 1점 이상이어야 합니다.");
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

