package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.entity.AttemptVideo;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.attempt.repository.AttemptVideoRepository;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.challenge.entity.ReferenceAnalysisStatus;
import com.motionchallenge.challenge.repository.ChallengeMotionProfileRepository;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.challenge.service.MotionSessionRuntimeTracker;
import com.motionchallenge.scoring.application.SimpleScoringPreviewService;
import com.motionchallenge.scoring.application.SimpleScoringResult;
import com.motionchallenge.video.service.StoredVideo;
import com.motionchallenge.video.service.VideoStorageService;
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
    private static final String DEFAULT_PREPARED_NOTE = "카메라 준비 단계를 통과한 기록입니다.";
    private static final String DEFAULT_COMPLETED_NOTE = "샘플 완료 결과를 통과한 기록입니다.";

    private final AttemptRepository attemptRepository;
    private final AttemptVideoRepository attemptVideoRepository;
    private final ChallengeRepository challengeRepository;
    private final ChallengeMotionProfileRepository challengeMotionProfileRepository;
    private final SimpleScoringPreviewService simpleScoringPreviewService;
    private final VideoStorageService videoStorageService;
    private final AttemptVideoProcessingService attemptVideoProcessingService;
    private final MotionSessionRuntimeTracker motionSessionRuntimeTracker;

    public AttemptService(
            AttemptRepository attemptRepository,
            AttemptVideoRepository attemptVideoRepository,
            ChallengeRepository challengeRepository,
            ChallengeMotionProfileRepository challengeMotionProfileRepository,
            SimpleScoringPreviewService simpleScoringPreviewService,
            VideoStorageService videoStorageService,
            AttemptVideoProcessingService attemptVideoProcessingService,
            MotionSessionRuntimeTracker motionSessionRuntimeTracker) {
        this.attemptRepository = attemptRepository;
        this.attemptVideoRepository = attemptVideoRepository;
        this.challengeRepository = challengeRepository;
        this.challengeMotionProfileRepository = challengeMotionProfileRepository;
        this.simpleScoringPreviewService = simpleScoringPreviewService;
        this.videoStorageService = videoStorageService;
        this.attemptVideoProcessingService = attemptVideoProcessingService;
        this.motionSessionRuntimeTracker = motionSessionRuntimeTracker;
    }

    public List<AttemptSummaryResponse> getAttempts() {
        return attemptRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    public AttemptSummaryResponse getAttempt(Long id) {
        Attempt attempt = attemptRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "이전 기록을 찾을 수 없습니다."));

        return toResponse(attempt);
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
                normalizeCompletedNotes(command.notes())));

        return toResponse(attempt);
    }

    @Transactional
    public AttemptResultResponse submitAttemptVideo(AttemptVideoUploadRequest request) {
        if (request.getAttemptVideo() == null || request.getAttemptVideo().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "시도 비디오 파일이 필요합니다.");
        }

        Challenge challenge = findActiveChallenge(request.getChallengeId());
        if (challenge.getReferenceAnalysisStatus() != ReferenceAnalysisStatus.COMPLETED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "레퍼런스 비디오 분석이 완료된 챌린지에서만 시도 업로드를 진행할 수 있습니다.");
        }

        ChallengeMotionProfile referenceProfile = challengeMotionProfileRepository.findByChallengeId(challenge.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "레퍼런스 모션 프로필이 아직 준비되지 않았습니다."));

        motionSessionRuntimeTracker.markUploadInProgress(challenge.getId());
        boolean uploadCompleted = false;
        try {
            StoredVideo storedVideo;
            try {
                storedVideo = videoStorageService.storeAttemptVideo(challenge.getId(), request.getAttemptVideo());
            } catch (RuntimeException exception) {
                markRetryableFailure(challenge.getId(), FAILURE_CODE_UPLOAD_STORAGE, exception);
                throw exception;
            }
            motionSessionRuntimeTracker.markUploadStored(challenge.getId());

            try {
                motionSessionRuntimeTracker.markAnalysisInProgress(challenge.getId());
                AttemptResultResponse response = attemptVideoProcessingService.processUploadedAttempt(
                        challenge,
                        referenceProfile,
                        storedVideo,
                        request.getNotes());

                uploadCompleted = true;
                return response;
            } catch (RuntimeException exception) {
                markRetryableFailure(challenge.getId(), resolvePipelineFailureCode(exception), exception);
                throw exception;
            }
        } finally {
            if (uploadCompleted) {
                motionSessionRuntimeTracker.clearRuntimeState(challenge.getId());
            }
        }
    }

    private Challenge findActiveChallenge(Long challengeId) {
        return challengeRepository.findByIdAndIsActiveTrue(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));
    }

    private AttemptSummaryResponse toResponse(Attempt attempt) {
        SimpleScoringResult scoringResult = simpleScoringPreviewService.buildResult(
                attempt.getStatus(),
                attempt.getScore());
        String resultSource = resolveResultSource(attempt);

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

    private String normalizeRecordType(String recordType) {
        if (AttemptRecordType.COMPLETED.equalsIgnoreCase(recordType)) {
            return AttemptRecordType.COMPLETED;
        }

        return AttemptRecordType.PREPARED;
    }

    private int normalizeCompletedScore(int requestedScore) {
        if (requestedScore < MIN_COMPLETED_SCORE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "완료 기록에는 1점 이상의 점수가 필요합니다.");
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
        motionSessionRuntimeTracker.markFailedRetryable(
                challengeId,
                failureCode,
                exception.getMessage() == null || exception.getMessage().isBlank()
                        ? "업로드 처리 중 문제가 발생했습니다. 같은 화면에서 다시 시도해 주세요."
                        : exception.getMessage());
    }
    private String resolvePipelineFailureCode(RuntimeException exception) {
        String simpleName = exception.getClass().getSimpleName();
        if (simpleName.contains("Score")) {
            return FAILURE_CODE_SCORING;
        }

        return FAILURE_CODE_ANALYSIS;
    }
}
