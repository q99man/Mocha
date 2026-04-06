package com.motionchallenge.challenge.service;

import com.motionchallenge.challenge.dto.ChallengeAnalysisResponse;
import com.motionchallenge.challenge.dto.ChallengeCreateRequest;
import com.motionchallenge.challenge.dto.ChallengeResponse;
import com.motionchallenge.challenge.dto.MotionSessionStateResponse;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.challenge.entity.ChallengeVideo;
import com.motionchallenge.challenge.entity.ReferenceAnalysisStatus;
import com.motionchallenge.challenge.repository.ChallengeMotionProfileRepository;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.challenge.repository.ChallengeVideoRepository;
import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.attempt.repository.AttemptVideoRepository;
import com.motionchallenge.motion.service.MotionAnalysisResult;
import com.motionchallenge.motion.service.MotionAnalysisService;
import com.motionchallenge.video.service.StoredVideo;
import com.motionchallenge.video.service.VideoStorageService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ChallengeService {

    private final ChallengeRepository challengeRepository;
    private final ChallengeCacheService challengeCacheService;
    private final MotionSessionStateFactory motionSessionStateFactory;
    private final MotionSessionRuntimeResolver motionSessionRuntimeResolver;
    private final ChallengeVideoRepository challengeVideoRepository;
    private final ChallengeMotionProfileRepository challengeMotionProfileRepository;
    private final AttemptRepository attemptRepository;
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
        this.attemptVideoRepository = attemptVideoRepository;
        this.videoStorageService = videoStorageService;
        this.motionAnalysisService = motionAnalysisService;
    }

    public List<ChallengeResponse> getChallenges() {
        return challengeRepository.findAllByIsActiveTrueOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    public List<ChallengeResponse> getPopularChallenges() {
        List<ChallengeResponse> fallback = challengeRepository.findTop3ByIsActiveTrueOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
        return challengeCacheService.getPopularChallenges(fallback);
    }

    public Optional<ChallengeResponse> getChallenge(Long id) {
        return challengeRepository.findByIdAndIsActiveTrue(id)
                .map(this::toResponse);
    }

    public Optional<MotionSessionStateResponse> getMotionSessionState(Long id) {
        return challengeRepository.findByIdAndIsActiveTrue(id)
                .map(challenge -> {
                    boolean referenceVideoUploaded =
                            challengeVideoRepository.findByChallengeId(challenge.getId()).isPresent();
                    boolean referenceMotionProfileReady =
                            challengeMotionProfileRepository.findByChallengeId(challenge.getId()).isPresent();
                    Optional<Attempt> latestAttempt =
                            attemptRepository.findTopByChallengeIdOrderByCreatedAtDesc(challenge.getId());
                    boolean latestAttemptVideoUploaded = latestAttempt
                            .map(attempt -> attemptVideoRepository.findByAttemptId(attempt.getId()).isPresent())
                            .orElse(false);
                    MotionSessionRuntimeContext runtimeContext = motionSessionRuntimeResolver.resolve(
                            challenge.getId(),
                            referenceMotionProfileReady,
                            latestAttempt,
                            latestAttemptVideoUploaded);

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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "레퍼런스 비디오 파일이 필요합니다.");
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

        StoredVideo storedVideo = videoStorageService.storeChallengeReferenceVideo(challenge.getId(), request.getReferenceVideo());
        challengeVideoRepository.save(new ChallengeVideo(
                challenge,
                storedVideo.originalFileName(),
                storedVideo.storagePath(),
                storedVideo.contentType(),
                storedVideo.size()));

        return toResponse(challenge);
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public ChallengeAnalysisResponse analyzeReferenceVideo(Long challengeId) {
        Challenge challenge = findActiveChallenge(challengeId);
        ChallengeVideo challengeVideo = challengeVideoRepository.findByChallengeId(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "레퍼런스 비디오가 등록되지 않았습니다."));

        challenge.markReferenceAnalyzing();

        try {
            StoredVideo storedVideo = videoStorageService.loadStoredVideo(
                    challengeVideo.getOriginalFileName(),
                    challengeVideo.getStoragePath(),
                    challengeVideo.getContentType(),
                    challengeVideo.getSize());
            MotionAnalysisResult analysisResult = motionAnalysisService.analyzeReferenceVideo(storedVideo);
            LocalDateTime analyzedAt = LocalDateTime.now();

            challengeMotionProfileRepository.findByChallengeId(challengeId)
                    .ifPresentOrElse(
                            challengeMotionProfileRepository::delete,
                            () -> {
                            });
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
                    "레퍼런스 비디오 분석이 완료되었습니다.");
        } catch (ResponseStatusException exception) {
            challenge.markReferenceAnalysisFailed();
            throw exception;
        } catch (RuntimeException exception) {
            challenge.markReferenceAnalysisFailed();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "레퍼런스 비디오 분석 중 오류가 발생했습니다.");
        }
    }

    private Challenge findActiveChallenge(Long challengeId) {
        return challengeRepository.findByIdAndIsActiveTrue(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));
    }

    private ChallengeResponse toResponse(Challenge challenge) {
        Optional<ChallengeVideo> challengeVideo = challengeVideoRepository.findByChallengeId(challenge.getId());
        boolean profileReady = challengeMotionProfileRepository.findByChallengeId(challenge.getId()).isPresent();

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
                challengeVideo.isPresent(),
                profileReady,
                challengeVideo.map(ChallengeVideo::getOriginalFileName).orElse(null),
                challenge.getReferenceAnalyzedAt());
    }
}
