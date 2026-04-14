package com.motionchallenge.challenge.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.entity.AttemptVideo;
import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import com.motionchallenge.attempt.repository.ChallengeRetryAttemptProjection;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.attempt.repository.AttemptVideoRepository;
import com.motionchallenge.challenge.dto.ChallengeAnalysisResponse;
import com.motionchallenge.challenge.dto.ChallengeCreateRequest;
import com.motionchallenge.challenge.dto.ChallengeLatestRetrySummaryResponse;
import com.motionchallenge.challenge.dto.ChallengeReferencePoseFrameResponse;
import com.motionchallenge.challenge.dto.ChallengeReferencePosePointResponse;
import com.motionchallenge.challenge.dto.ChallengeReferencePosePreviewResponse;
import com.motionchallenge.challenge.dto.ChallengeResponse;
import com.motionchallenge.challenge.dto.ChallengeUpdateRequest;
import com.motionchallenge.challenge.dto.MotionSessionStateResponse;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.challenge.entity.ChallengeVideo;
import com.motionchallenge.challenge.entity.ReferenceAnalysisStatus;
import com.motionchallenge.challenge.repository.ChallengeMotionProfileRepository;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.challenge.repository.ChallengeVideoRepository;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import com.motionchallenge.motion.service.MotionAnalysisModeSupport;
import com.motionchallenge.motion.service.MotionAnalysisService;
import com.motionchallenge.video.service.StoredVideo;
import com.motionchallenge.video.service.VideoStorageService;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.IntStream;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ChallengeService {

    private static final Logger log = LoggerFactory.getLogger(ChallengeService.class);

    private final ChallengeRepository challengeRepository;
    private final ChallengeCacheService challengeCacheService;
    private final MotionSessionStateFactory motionSessionStateFactory;
    private final MotionSessionRuntimeResolver motionSessionRuntimeResolver;
    private final ChallengeVideoRepository challengeVideoRepository;
    private final ChallengeMotionProfileRepository challengeMotionProfileRepository;
    private final AttemptRepository attemptRepository;
    private final AttemptProcessingJobRepository attemptProcessingJobRepository;
    private final AttemptVideoRepository attemptVideoRepository;
    private final VideoStorageService videoStorageService;
    private final MotionAnalysisService motionAnalysisService;
    private final ObjectMapper objectMapper;

    public ChallengeService(
            ChallengeRepository challengeRepository,
            ChallengeCacheService challengeCacheService,
            MotionSessionStateFactory motionSessionStateFactory,
            MotionSessionRuntimeResolver motionSessionRuntimeResolver,
            ChallengeVideoRepository challengeVideoRepository,
            ChallengeMotionProfileRepository challengeMotionProfileRepository,
            AttemptRepository attemptRepository,
            AttemptProcessingJobRepository attemptProcessingJobRepository,
            AttemptVideoRepository attemptVideoRepository,
            VideoStorageService videoStorageService,
            MotionAnalysisService motionAnalysisService,
            ObjectMapper objectMapper) {
        this.challengeRepository = challengeRepository;
        this.challengeCacheService = challengeCacheService;
        this.motionSessionStateFactory = motionSessionStateFactory;
        this.motionSessionRuntimeResolver = motionSessionRuntimeResolver;
        this.challengeVideoRepository = challengeVideoRepository;
        this.challengeMotionProfileRepository = challengeMotionProfileRepository;
        this.attemptRepository = attemptRepository;
        this.attemptProcessingJobRepository = attemptProcessingJobRepository;
        this.attemptVideoRepository = attemptVideoRepository;
        this.videoStorageService = videoStorageService;
        this.motionAnalysisService = motionAnalysisService;
        this.objectMapper = objectMapper;
    }

    public List<ChallengeResponse> getChallenges() {
        List<Challenge> challenges = challengeRepository.findAllByIsActiveTrueOrderByCreatedAtDesc();
        return toResponses(challenges);
    }

    public List<ChallengeResponse> getAdminChallenges() {
        List<Challenge> challenges = challengeRepository.findAllByOrderByCreatedAtDesc();
        return toResponses(challenges);
    }

    public List<ChallengeResponse> getPopularChallenges() {
        List<Challenge> fallbackChallenges = challengeRepository.findTop3ByIsActiveTrueOrderByCreatedAtDesc();
        List<ChallengeResponse> fallback = toResponses(fallbackChallenges);
        return challengeCacheService.getPopularChallenges(fallback);
    }

    public Optional<ChallengeResponse> getChallenge(Long id) {
        return challengeRepository.findByIdAndIsActiveTrue(id)
                .map(challenge -> toResponses(List.of(challenge)).get(0));
    }

    public Optional<ChallengeResponse> getAdminChallenge(Long id) {
        return challengeRepository.findById(id)
                .map(challenge -> toResponses(List.of(challenge)).get(0));
    }

    public Optional<ChallengeReferencePosePreviewResponse> getReferencePosePreview(Long id) {
        Optional<Challenge> challengeOptional = challengeRepository.findByIdAndIsActiveTrue(id);
        if (challengeOptional.isEmpty()) {
            return Optional.empty();
        }

        Challenge challenge = challengeOptional.get();
        Optional<ChallengeVideo> challengeVideoOptional = challengeVideoRepository.findByChallengeId(challenge.getId());
        Optional<ChallengeMotionProfile> motionProfileOptional =
                challengeMotionProfileRepository.findByChallengeId(challenge.getId());

        if (challengeVideoOptional.isEmpty() || motionProfileOptional.isEmpty()) {
            return Optional.empty();
        }

        ChallengeVideo challengeVideo = challengeVideoOptional.get();
        ChallengeMotionProfile motionProfile = motionProfileOptional.get();
        return Optional.of(toReferencePosePreview(challenge, challengeVideo, motionProfile));
    }

    public Optional<ChallengeReferencePosePreviewResponse> getAdminReferencePosePreview(Long id) {
        Optional<Challenge> challengeOptional = challengeRepository.findById(id);
        if (challengeOptional.isEmpty()) {
            return Optional.empty();
        }

        Challenge challenge = challengeOptional.get();
        Optional<ChallengeVideo> challengeVideoOptional = challengeVideoRepository.findByChallengeId(challenge.getId());
        Optional<ChallengeMotionProfile> motionProfileOptional =
                challengeMotionProfileRepository.findByChallengeId(challenge.getId());

        if (challengeVideoOptional.isEmpty() || motionProfileOptional.isEmpty()) {
            return Optional.empty();
        }

        ChallengeVideo challengeVideo = challengeVideoOptional.get();
        ChallengeMotionProfile motionProfile = motionProfileOptional.get();
        return Optional.of(toReferencePosePreview(challenge, challengeVideo, motionProfile));
    }

    public Optional<MotionSessionStateResponse> getMotionSessionState(Long id) {
        return challengeRepository.findByIdAndIsActiveTrue(id)
                .map(challenge -> {
                    boolean referenceVideoUploaded =
                            challengeVideoRepository.findByChallengeId(challenge.getId()).isPresent();
                    boolean referenceMotionProfileReady = challengeMotionProfileRepository.findByChallengeId(challenge.getId())
                            .filter(this::isUsableReferenceProfile)
                            .isPresent();
                    Optional<Attempt> latestAttempt =
                            attemptRepository.findTopByChallengeIdOrderByCreatedAtDescIdDesc(challenge.getId());
                    Optional<AttemptProcessingJob> latestProcessingJob =
                            attemptProcessingJobRepository.findTopByChallengeIdOrderByUpdatedAtDesc(challenge.getId());
                    boolean latestAttemptVideoUploaded = latestAttempt
                            .map(attempt -> attemptVideoRepository.findByAttemptId(attempt.getId()).isPresent())
                            .orElse(false);
                    MotionSessionRuntimeContext runtimeContext = motionSessionRuntimeResolver.resolve(
                            challenge.getId(),
                            referenceMotionProfileReady,
                            latestAttempt,
                            latestAttemptVideoUploaded,
                            latestProcessingJob);

                    return motionSessionStateFactory.createState(
                            challenge,
                            referenceVideoUploaded,
                            referenceMotionProfileReady,
                            runtimeContext);
                });
    }

    @Transactional
    public ChallengeResponse createChallenge(ChallengeCreateRequest request) {
        if (request.getReferenceVideo() == null || request.getReferenceVideo().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "레퍼런스 영상 파일이 필요합니다.");
        }

        Challenge challenge = challengeRepository.save(new Challenge(
                request.getTitle(),
                request.getDescription(),
                request.getCategory(),
                request.getDifficulty(),
                request.getThumbnailUrl(),
                request.getGuideVideoUrl(),
                request.getDurationSec(),
                true,
                ReferenceAnalysisStatus.NOT_ANALYZED,
                null));

        StoredVideo storedVideo =
                videoStorageService.storeChallengeReferenceVideo(challenge.getId(), request.getReferenceVideo());
        challengeVideoRepository.save(new ChallengeVideo(
                challenge,
                storedVideo.originalFileName(),
                storedVideo.storagePath(),
                storedVideo.contentType(),
                storedVideo.size()));

        return toResponses(List.of(challenge)).get(0);
    }

    @Transactional
    public ChallengeResponse updateChallenge(Long challengeId, ChallengeUpdateRequest request) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));

        challenge.updateDetails(
                request.getTitle(),
                request.getDescription(),
                request.getCategory(),
                request.getDifficulty(),
                normalizeOptionalText(request.getThumbnailUrl()),
                normalizeOptionalText(request.getGuideVideoUrl()),
                request.getDurationSec());

        if (request.getReferenceVideo() != null && !request.getReferenceVideo().isEmpty()) {
            replaceReferenceVideo(challenge, request.getReferenceVideo());
        }

        challengeCacheService.evictPopularChallenges();
        return toResponses(List.of(challenge)).get(0);
    }

    @Transactional
    public ChallengeResponse updateChallengeActive(Long challengeId, boolean active) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));

        challenge.updateActive(active);
        challengeCacheService.evictPopularChallenges();
        return toResponses(List.of(challenge)).get(0);
    }

    @Transactional
    public void deleteChallenge(Long challengeId) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "梨뚮┛吏瑜?李얠쓣 ???놁뒿?덈떎."));

        Optional<ChallengeVideo> challengeVideoOptional = challengeVideoRepository.findByChallengeId(challengeId);
        List<Attempt> attempts = attemptRepository.findByChallengeIdOrderByCreatedAtAscIdAsc(challengeId);
        Set<Long> attemptIds = new HashSet<>();
        for (Attempt attempt : attempts) {
            attemptIds.add(attempt.getId());
        }
        List<AttemptVideo> attemptVideos = attemptIds.isEmpty()
                ? List.of()
                : attemptVideoRepository.findByAttemptIdIn(attemptIds);
        List<AttemptProcessingJob> processingJobs = attemptProcessingJobRepository.findByChallengeIdOrderByCreatedAtAsc(challengeId);

        LinkedHashSet<String> storagePathsToDelete = new LinkedHashSet<>();
        challengeVideoOptional.map(ChallengeVideo::getStoragePath).ifPresent(storagePathsToDelete::add);
        for (AttemptVideo attemptVideo : attemptVideos) {
            storagePathsToDelete.add(attemptVideo.getStoragePath());
        }
        for (AttemptProcessingJob processingJob : processingJobs) {
            String storagePath = processingJob.getStoragePath();
            if (storagePath != null && !storagePath.isBlank()) {
                storagePathsToDelete.add(storagePath);
            }
        }

        if (!attemptVideos.isEmpty()) {
            attemptVideoRepository.deleteAllInBatch(attemptVideos);
        }
        if (!attempts.isEmpty()) {
            attemptRepository.deleteAllInBatch(attempts);
        }
        if (!processingJobs.isEmpty()) {
            attemptProcessingJobRepository.deleteAllInBatch(processingJobs);
        }
        challengeMotionProfileRepository.deleteByChallengeId(challengeId);
        challengeVideoOptional.ifPresent(challengeVideoRepository::delete);
        challengeRepository.delete(challenge);

        for (String storagePath : storagePathsToDelete) {
            videoStorageService.deleteStoredVideo(storagePath);
        }
        challengeCacheService.evictPopularChallenges();
    }

    private void replaceReferenceVideo(Challenge challenge, org.springframework.web.multipart.MultipartFile referenceVideo) {
        StoredVideo storedVideo = videoStorageService.storeChallengeReferenceVideo(challenge.getId(), referenceVideo);
        Optional<ChallengeVideo> existingVideoOptional = challengeVideoRepository.findByChallengeId(challenge.getId());
        String previousStoragePath = existingVideoOptional.map(ChallengeVideo::getStoragePath).orElse(null);

        if (existingVideoOptional.isPresent()) {
            existingVideoOptional.get().updateStoredVideo(
                    storedVideo.originalFileName(),
                    storedVideo.storagePath(),
                    storedVideo.contentType(),
                    storedVideo.size());
        } else {
            challengeVideoRepository.save(new ChallengeVideo(
                    challenge,
                    storedVideo.originalFileName(),
                    storedVideo.storagePath(),
                    storedVideo.contentType(),
                    storedVideo.size()));
        }

        challengeMotionProfileRepository.deleteByChallengeId(challenge.getId());
        challenge.resetReferenceAnalysis();

        if (previousStoragePath != null && !previousStoragePath.equals(storedVideo.storagePath())) {
            videoStorageService.deleteStoredVideo(previousStoragePath);
        }
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public ChallengeAnalysisResponse analyzeReferenceVideo(Long challengeId) {
        Challenge challenge = findActiveChallenge(challengeId);
        ChallengeVideo challengeVideo = challengeVideoRepository.findByChallengeId(challengeId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "이 챌린지에는 레퍼런스 영상이 등록되어 있지 않습니다."));

        challenge.markReferenceAnalyzing();

        try {
            StoredVideo storedVideo = videoStorageService.loadStoredVideo(
                    challengeVideo.getOriginalFileName(),
                    challengeVideo.getStoragePath(),
                    challengeVideo.getContentType(),
                    challengeVideo.getSize());
            MotionAnalysisResult analysisResult = motionAnalysisService.analyzeReferenceVideo(storedVideo);
            LocalDateTime analyzedAt = LocalDateTime.now();

            challengeMotionProfileRepository.deleteByChallengeId(challengeId);
            challengeMotionProfileRepository.flush();
            challengeMotionProfileRepository.save(new ChallengeMotionProfile(
                    challenge,
                    analysisResult.rawProfileData(),
                    analysisResult.signature(),
                    analysisResult.sampleCount(),
                    analysisResult.durationMs(),
                    analysisResult.analyzerName(),
                    analyzedAt));

            challenge.markReferenceAnalysisCompleted(analyzedAt);

            return new ChallengeAnalysisResponse(
                    challenge.getId(),
                    challenge.getReferenceAnalysisStatus().name(),
                    true,
                    analysisResult.analyzerName(),
                    analyzedAt,
                    "레퍼런스 영상 분석이 완료되었습니다.");
        } catch (ResponseStatusException exception) {
            challenge.markReferenceAnalysisFailed();
            log.warn(
                    "Reference analysis failed for challengeId={} with status={} reason={}",
                    challengeId,
                    exception.getStatusCode(),
                    exception.getReason(),
                    exception);
            throw exception;
        } catch (RuntimeException exception) {
            challenge.markReferenceAnalysisFailed();
            log.error("Reference analysis crashed for challengeId={}", challengeId, exception);
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "분석 결과 저장 중 레퍼런스 분석에 실패했습니다: " + exception.getMessage(),
                    exception);
        }
    }

    private ChallengeReferencePosePreviewResponse toReferencePosePreview(
            Challenge challenge,
            ChallengeVideo challengeVideo,
            ChallengeMotionProfile motionProfile) {
        Integer sampleCount = motionProfile.getSampleCount();
        Long durationMs = motionProfile.getDurationMs();
        List<ChallengeReferencePoseFrameResponse> frames = List.of();

        try {
            JsonNode root = objectMapper.readTree(motionProfile.getProfileData());
            JsonNode landmarksNode = root.path("landmarks");
            frames = selectPreviewFrames(landmarksNode, 3);
            JsonNode metricsNode = root.path("metrics");
            if (metricsNode.path("sampleCount").isNumber()) {
                sampleCount = metricsNode.path("sampleCount").asInt();
            }
            if (metricsNode.path("durationMs").isNumber()) {
                durationMs = metricsNode.path("durationMs").asLong();
            }
        } catch (Exception exception) {
            log.warn("Reference pose preview fallback activated for challengeId={}", challenge.getId(), exception);
        }

        return new ChallengeReferencePosePreviewResponse(
                challenge.getId(),
                challenge.getTitle(),
                motionProfile.getAnalyzerName(),
                motionProfile.getAnalyzedAt(),
                "/uploads/" + challengeVideo.getStoragePath(),
                sampleCount,
                durationMs,
                frames);
    }

    private List<ChallengeReferencePoseFrameResponse> selectPreviewFrames(JsonNode landmarksNode, int targetFrameCount) {
        if (!landmarksNode.isArray() || landmarksNode.isEmpty()) {
            return List.of();
        }

        int size = landmarksNode.size();
        int actualCount = Math.min(targetFrameCount, size);

        return IntStream.range(0, actualCount)
                .map(index -> actualCount == 1 ? 0 : (int) Math.round(index * (size - 1.0) / (actualCount - 1.0)))
                .distinct()
                .mapToObj(landmarksNode::get)
                .map(this::toPreviewFrame)
                .sorted(Comparator.comparingInt(ChallengeReferencePoseFrameResponse::frameIndex))
                .toList();
    }

    private ChallengeReferencePoseFrameResponse toPreviewFrame(JsonNode frameNode) {
        int frameIndex = frameNode.path("frameIndex").asInt();
        List<ChallengeReferencePosePointResponse> points = frameNode.path("points").isArray()
                ? streamPoints(frameNode.path("points"))
                : List.of();
        return new ChallengeReferencePoseFrameResponse(frameIndex, points);
    }

    private List<ChallengeReferencePosePointResponse> streamPoints(JsonNode pointsNode) {
        return IntStream.range(0, pointsNode.size())
                .mapToObj(pointsNode::get)
                .map(pointNode -> new ChallengeReferencePosePointResponse(
                        pointNode.path("name").asText(),
                        pointNode.path("x").asDouble(),
                        pointNode.path("y").asDouble(),
                        pointNode.path("visibility").asDouble()))
                .toList();
    }

    private Challenge findActiveChallenge(Long challengeId) {
        return challengeRepository.findByIdAndIsActiveTrue(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));
    }

    private List<ChallengeResponse> toResponses(List<Challenge> challenges) {
        if (challenges.isEmpty()) {
            return List.of();
        }

        Map<Long, ChallengeVideo> videoByChallengeId = buildChallengeVideoByChallengeId(challenges);
        Set<Long> profileReadyChallengeIds = buildProfileReadyChallengeIds(challenges);
        Map<Long, ChallengeLatestRetrySummaryResponse> retrySummaryByChallengeId =
                buildLatestRetrySummaryByChallengeId(challenges);

        return challenges.stream()
                .map(challenge -> toResponse(
                        challenge,
                        videoByChallengeId.get(challenge.getId()),
                        profileReadyChallengeIds.contains(challenge.getId()),
                        retrySummaryByChallengeId.get(challenge.getId())))
                .toList();
    }

    private ChallengeResponse toResponse(
            Challenge challenge,
            ChallengeVideo challengeVideo,
            boolean profileReady,
            ChallengeLatestRetrySummaryResponse latestRetrySummary) {
        return new ChallengeResponse(
                challenge.getId(),
                challenge.getTitle(),
                challenge.getDescription(),
                challenge.getCategory(),
                challenge.getDifficulty(),
                challenge.getThumbnailUrl(),
                challengeVideo != null ? "/uploads/" + challengeVideo.getStoragePath() : null,
                challenge.getGuideVideoUrl(),
                challenge.getDurationSec(),
                challenge.isActive(),
                challenge.getReferenceAnalysisStatus().name(),
                challengeVideo != null,
                profileReady,
                challengeVideo != null ? challengeVideo.getOriginalFileName() : null,
                challenge.getReferenceAnalyzedAt(),
                latestRetrySummary);
    }

    private Map<Long, ChallengeVideo> buildChallengeVideoByChallengeId(List<Challenge> challenges) {
        Set<Long> challengeIds = toChallengeIds(challenges);
        Map<Long, ChallengeVideo> videoByChallengeId = new HashMap<>();
        for (ChallengeVideo challengeVideo : challengeVideoRepository.findByChallengeIdIn(challengeIds)) {
            videoByChallengeId.put(challengeVideo.getChallenge().getId(), challengeVideo);
        }
        return videoByChallengeId;
    }

    private Set<Long> buildProfileReadyChallengeIds(List<Challenge> challenges) {
        Set<Long> challengeIds = toChallengeIds(challenges);
        Set<Long> readyChallengeIds = new HashSet<>();
        for (ChallengeMotionProfile profile : challengeMotionProfileRepository.findByChallengeIdIn(challengeIds)) {
            if (isUsableReferenceProfile(profile)) {
                readyChallengeIds.add(profile.getChallenge().getId());
            }
        }
        return readyChallengeIds;
    }

    private boolean isUsableReferenceProfile(ChallengeMotionProfile profile) {
        return !MotionAnalysisModeSupport.isStubAnalyzerName(profile.getAnalyzerName());
    }

    private Map<Long, ChallengeLatestRetrySummaryResponse> buildLatestRetrySummaryByChallengeId(List<Challenge> challenges) {
        Set<Long> challengeIds = toChallengeIds(challenges);
        List<ChallengeRetryAttemptProjection> latestAttempts =
                attemptRepository.findLatestUploadedAttemptSnapshotsByChallengeIds(challengeIds);
        Map<Long, ChallengeLatestRetrySummaryResponse> summaryByChallengeId = new HashMap<>();
        Map<Long, ChallengeRetryAttemptSnapshot> previousScoredAttemptByChallengeId = new HashMap<>();

        latestAttempts.forEach(attempt -> {
            ChallengeRetryAttemptSnapshot currentAttempt = toRetryAttemptSnapshot(attempt);
            ChallengeRetryAttemptSnapshot previousAttempt = previousScoredAttemptByChallengeId.get(currentAttempt.challengeId());

            summaryByChallengeId.put(
                    currentAttempt.challengeId(),
                    new ChallengeLatestRetrySummaryResponse(
                            currentAttempt.attemptId(),
                            currentAttempt.score(),
                            currentAttempt.createdAt(),
                            previousAttempt == null ? null : currentAttempt.score() - previousAttempt.score(),
                            normalizeDisplayText(currentAttempt.strongestArea()),
                            normalizeDisplayText(currentAttempt.weakestArea()),
                            buildCoachingTeaser(currentAttempt, previousAttempt),
                            buildRetryFocus(currentAttempt, previousAttempt),
                            buildKeepStableFocus(currentAttempt, previousAttempt)));
            previousScoredAttemptByChallengeId.put(currentAttempt.challengeId(), currentAttempt);
        });

        return summaryByChallengeId;
    }

    private ChallengeRetryAttemptSnapshot toRetryAttemptSnapshot(ChallengeRetryAttemptProjection attempt) {
        return new ChallengeRetryAttemptSnapshot(
                attempt.getAttemptId(),
                attempt.getChallengeId(),
                attempt.getScore(),
                attempt.getCreatedAt(),
                attempt.getPoseSimilarity(),
                attempt.getTimingSimilarity(),
                attempt.getStabilitySimilarity(),
                attempt.getStrongestArea(),
                attempt.getWeakestArea());
    }

    private Set<Long> toChallengeIds(List<Challenge> challenges) {
        Set<Long> challengeIds = new HashSet<>();
        for (Challenge challenge : challenges) {
            challengeIds.add(challenge.getId());
        }
        return challengeIds;
    }

    private String buildCoachingTeaser(ChallengeRetryAttemptSnapshot attempt, ChallengeRetryAttemptSnapshot previousAttempt) {
        String weakestArea = normalizeDisplayText(attempt.weakestArea());
        String strongestArea = normalizeDisplayText(attempt.strongestArea());
        DeltaMetric bestMetric = buildPrimaryDeltaMetric(attempt, previousAttempt, true);
        DeltaMetric worstMetric = buildPrimaryDeltaMetric(attempt, previousAttempt, false);

        if ("pose timing".equals(weakestArea)) {
            return "다음 재도전에서는 타이밍부터 먼저 다듬어 보세요." + buildDeltaTail(bestMetric, worstMetric);
        }
        if ("detection quality".equals(weakestArea)) {
            return "다음 재도전에서는 동작보다 먼저 구도와 가시성을 정리해 보세요." + buildDeltaTail(bestMetric, worstMetric);
        }
        if ("pose shape".equals(weakestArea)) {
            return "다음 재도전에서는 속도보다 큰 몸 모양을 먼저 회복해 보세요." + buildDeltaTail(bestMetric, worstMetric);
        }
        if (attempt.score() >= 85 && strongestArea != null) {
            return "전체적으로 좋은 결과입니다. " + strongestArea + "은 지금처럼 안정적으로 유지해 주세요." + buildDeltaTail(bestMetric, worstMetric);
        }
        if (previousAttempt != null) {
            return "카메라 세팅은 유지하고 한 번에 한 가지 변수만 바꿔 보세요. 점수 흐름: "
                    + formatSignedDelta(attempt.score() - previousAttempt.score())
                    + "점."
                    + buildDeltaTail(bestMetric, worstMetric);
        }
        return "다음 재도전에서는 같은 카메라 세팅을 유지하고 한 가지 변수만 바꿔서 점수 변화를 더 읽기 쉽게 만들어 보세요.";
    }

    private String buildRetryFocus(ChallengeRetryAttemptSnapshot attempt, ChallengeRetryAttemptSnapshot previousAttempt) {
        String weakestArea = normalizeDisplayText(attempt.weakestArea());
        DeltaMetric worstMetric = buildPrimaryDeltaMetric(attempt, previousAttempt, false);

        if (weakestArea != null) {
            String message = "다음 재도전에서는 " + weakestArea + "부터 먼저 집중해 보세요.";
            if (worstMetric != null && worstMetric.delta() < 0) {
                message += " " + worstMetric.label() + "도 " + formatSignedDelta(worstMetric.delta()) + " 변했습니다.";
            }
            return message;
        }

        if (previousAttempt != null) {
            return "촬영 세팅을 안정적으로 유지하고 변수는 하나만 분리해 보세요. 최신 점수 흐름: "
                    + formatSignedDelta(attempt.score() - previousAttempt.score())
                    + "점.";
        }

        return "다음 재도전에서는 같은 카메라 세팅으로 깔끔한 기준점을 만들어 보세요.";
    }

    private String buildKeepStableFocus(ChallengeRetryAttemptSnapshot attempt, ChallengeRetryAttemptSnapshot previousAttempt) {
        String strongestArea = normalizeDisplayText(attempt.strongestArea());
        DeltaMetric bestMetric = buildPrimaryDeltaMetric(attempt, previousAttempt, true);

        if (strongestArea != null) {
            String message = "다음 재도전에서도 " + strongestArea + "을 안정적으로 유지해 보세요.";
            if (bestMetric != null && bestMetric.delta() > 0) {
                message += " " + bestMetric.label() + "이 " + formatSignedDelta(bestMetric.delta()) + " 좋아졌습니다.";
            }
            return message;
        }

        if (bestMetric != null && bestMetric.delta() > 0) {
            return bestMetric.label() + "을 " + formatSignedDelta(bestMetric.delta()) + " 개선한 세팅을 유지해 보세요.";
        }

        return "재도전 사이에서 현재 구도, 조명, 템포를 최대한 일정하게 유지해 보세요.";
    }

    private DeltaMetric buildPrimaryDeltaMetric(ChallengeRetryAttemptSnapshot attempt, ChallengeRetryAttemptSnapshot previousAttempt, boolean best) {
        if (previousAttempt == null) {
            return null;
        }

        DeltaMetric[] metrics = new DeltaMetric[] {
            buildDeltaMetric("모양", computeDelta(attempt.poseSimilarity(), previousAttempt.poseSimilarity())),
            buildDeltaMetric("타이밍", computeDelta(attempt.timingSimilarity(), previousAttempt.timingSimilarity())),
            buildDeltaMetric("품질", computeDelta(attempt.stabilitySimilarity(), previousAttempt.stabilitySimilarity()))
        };

        DeltaMetric selected = null;
        for (DeltaMetric metric : metrics) {
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

    private DeltaMetric buildDeltaMetric(String label, Integer delta) {
        return delta == null ? null : new DeltaMetric(label, delta);
    }

    private Integer computeDelta(Integer currentValue, Integer previousValue) {
        if (currentValue == null || previousValue == null) {
            return null;
        }
        return currentValue - previousValue;
    }

    private String buildDeltaTail(DeltaMetric bestMetric, DeltaMetric worstMetric) {
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

    private String normalizeDisplayText(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        if (looksGarbled(value)) {
            return null;
        }
        return value;
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean looksGarbled(String value) {
        return value.contains("??") || value.contains("\uFFFD");
    }

    private record ChallengeRetryAttemptSnapshot(
            Long attemptId,
            Long challengeId,
            Integer score,
            LocalDateTime createdAt,
            Integer poseSimilarity,
            Integer timingSimilarity,
            Integer stabilitySimilarity,
            String strongestArea,
            String weakestArea) {
    }

    private record DeltaMetric(String label, int delta) {
    }
}

