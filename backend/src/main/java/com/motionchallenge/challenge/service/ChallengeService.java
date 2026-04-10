package com.motionchallenge.challenge.service;

import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import com.motionchallenge.attempt.repository.ChallengeRetryAttemptProjection;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.attempt.repository.AttemptVideoRepository;
import com.motionchallenge.challenge.dto.ChallengeAnalysisResponse;
import com.motionchallenge.challenge.dto.ChallengeCreateRequest;
import com.motionchallenge.challenge.dto.ChallengeLatestRetrySummaryResponse;
import com.motionchallenge.challenge.dto.ChallengeResponse;
import com.motionchallenge.challenge.dto.MotionSessionStateResponse;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.challenge.entity.ChallengeVideo;
import com.motionchallenge.challenge.entity.ReferenceAnalysisStatus;
import com.motionchallenge.challenge.repository.ChallengeMotionProfileRepository;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.challenge.repository.ChallengeVideoRepository;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import com.motionchallenge.motion.service.MotionAnalysisService;
import com.motionchallenge.video.service.StoredVideo;
import com.motionchallenge.video.service.VideoStorageService;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
            MotionAnalysisService motionAnalysisService) {
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
    }

    public List<ChallengeResponse> getChallenges() {
        List<Challenge> challenges = challengeRepository.findAllByIsActiveTrueOrderByCreatedAtDesc();
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

    public Optional<MotionSessionStateResponse> getMotionSessionState(Long id) {
        return challengeRepository.findByIdAndIsActiveTrue(id)
                .map(challenge -> {
                    boolean referenceVideoUploaded =
                            challengeVideoRepository.findByChallengeId(challenge.getId()).isPresent();
                    boolean referenceMotionProfileReady =
                            challengeMotionProfileRepository.findByChallengeId(challenge.getId()).isPresent();
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reference video file is required.");
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

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public ChallengeAnalysisResponse analyzeReferenceVideo(Long challengeId) {
        Challenge challenge = findActiveChallenge(challengeId);
        ChallengeVideo challengeVideo = challengeVideoRepository.findByChallengeId(challengeId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Reference video is not registered for this challenge."));

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
                    "Reference video analysis completed successfully.");
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
                    "Reference analysis failed while saving the analysis result: " + exception.getMessage(),
                    exception);
        }
    }

    private Challenge findActiveChallenge(Long challengeId) {
        return challengeRepository.findByIdAndIsActiveTrue(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Challenge not found."));
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
        return new HashSet<>(challengeMotionProfileRepository.findChallengeIdsByChallengeIdIn(challengeIds));
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

        if ("timing".equals(weakestArea)) {
            return "Next retry: tighten timing first." + buildDeltaTail(bestMetric, worstMetric);
        }
        if ("detection stability".equals(weakestArea)) {
            return "Next retry: clean up framing before changing the move itself." + buildDeltaTail(bestMetric, worstMetric);
        }
        if ("pose similarity".equals(weakestArea)) {
            return "Next retry: recover the big body shapes before adjusting speed." + buildDeltaTail(bestMetric, worstMetric);
        }
        if (attempt.score() >= 85 && strongestArea != null) {
            return "Strong run overall. Keep " + strongestArea + " steady." + buildDeltaTail(bestMetric, worstMetric);
        }
        if (previousAttempt != null) {
            return "Keep the same camera setup and change one variable at a time. Score trend: "
                    + formatSignedDelta(attempt.score() - previousAttempt.score())
                    + " pts."
                    + buildDeltaTail(bestMetric, worstMetric);
        }
        return "Next retry: keep the same camera setup and change only one variable so the next score shift is easier to read.";
    }

    private String buildRetryFocus(ChallengeRetryAttemptSnapshot attempt, ChallengeRetryAttemptSnapshot previousAttempt) {
        String weakestArea = normalizeDisplayText(attempt.weakestArea());
        DeltaMetric worstMetric = buildPrimaryDeltaMetric(attempt, previousAttempt, false);

        if (weakestArea != null) {
            String message = "Focus the next retry on " + weakestArea + " first.";
            if (worstMetric != null && worstMetric.delta() < 0) {
                message += " " + worstMetric.label() + " also moved " + formatSignedDelta(worstMetric.delta()) + ".";
            }
            return message;
        }

        if (previousAttempt != null) {
            return "Keep the capture setup stable and isolate one variable. Latest score trend: "
                    + formatSignedDelta(attempt.score() - previousAttempt.score())
                    + " pts.";
        }

        return "Use the next retry to create a clean baseline with the same camera setup.";
    }

    private String buildKeepStableFocus(ChallengeRetryAttemptSnapshot attempt, ChallengeRetryAttemptSnapshot previousAttempt) {
        String strongestArea = normalizeDisplayText(attempt.strongestArea());
        DeltaMetric bestMetric = buildPrimaryDeltaMetric(attempt, previousAttempt, true);

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

    private DeltaMetric buildPrimaryDeltaMetric(ChallengeRetryAttemptSnapshot attempt, ChallengeRetryAttemptSnapshot previousAttempt, boolean best) {
        if (previousAttempt == null) {
            return null;
        }

        DeltaMetric[] metrics = new DeltaMetric[] {
            buildDeltaMetric("Pose", computeDelta(attempt.poseSimilarity(), previousAttempt.poseSimilarity())),
            buildDeltaMetric("Timing", computeDelta(attempt.timingSimilarity(), previousAttempt.timingSimilarity())),
            buildDeltaMetric("Stability", computeDelta(attempt.stabilitySimilarity(), previousAttempt.stabilitySimilarity()))
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

