package com.motionchallenge.review.service;

import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.service.CurrentMemberService;
import com.motionchallenge.review.dto.ReviewResponse;
import com.motionchallenge.review.dto.ReviewUpsertRequest;
import com.motionchallenge.review.entity.Review;
import com.motionchallenge.review.repository.ReviewRepository;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ChallengeRepository challengeRepository;
    private final AttemptRepository attemptRepository;
    private final CurrentMemberService currentMemberService;

    public ReviewService(
            ReviewRepository reviewRepository,
            ChallengeRepository challengeRepository,
            AttemptRepository attemptRepository,
            CurrentMemberService currentMemberService) {
        this.reviewRepository = reviewRepository;
        this.challengeRepository = challengeRepository;
        this.attemptRepository = attemptRepository;
        this.currentMemberService = currentMemberService;
    }

    public List<ReviewResponse> getChallengeReviews(Long challengeId) {
        Challenge challenge = challengeRepository.findByIdAndIsActiveTrue(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));

        Long currentMemberId = currentMemberService.getCurrentMember()
                .map(Member::getId)
                .orElse(null);

        return reviewRepository.findAllByChallengeIdWithMemberAndChallengeOrderByCreatedAtDesc(challenge.getId()).stream()
                .map(review -> toResponse(review, currentMemberId))
                .toList();
    }

    public List<ReviewResponse> getRecentReviews(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 12));
        return reviewRepository.findRecentWithMemberAndChallenge(PageRequest.of(0, safeLimit)).stream()
                .map(review -> toResponse(review, null))
                .toList();
    }

    public List<ReviewResponse> getMyReviews() {
        Member currentMember = currentMemberService.requireCurrentMember();
        return reviewRepository.findAllByMemberIdWithMemberAndChallengeOrderByCreatedAtDesc(currentMember.getId()).stream()
                .map(review -> toResponse(review, currentMember.getId()))
                .toList();
    }

    @Transactional
    public ReviewResponse createReview(Long challengeId, ReviewUpsertRequest request) {
        Member currentMember = currentMemberService.requireCurrentMember();
        Challenge challenge = challengeRepository.findByIdAndIsActiveTrue(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));

        ensureReviewEligible(challenge.getId(), currentMember.getId());
        reviewRepository.findByChallengeIdAndMemberIdWithMemberAndChallenge(challenge.getId(), currentMember.getId())
                .ifPresent(review -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 작성한 리뷰가 있습니다. 수정 기능을 이용해 주세요.");
                });

        Review review = reviewRepository.save(new Review(
                challenge,
                currentMember,
                request.getRating(),
                normalizeContent(request.getContent())));

        return toResponse(review, currentMember.getId());
    }

    @Transactional
    public ReviewResponse updateReview(Long reviewId, ReviewUpsertRequest request) {
        Member currentMember = currentMemberService.requireCurrentMember();
        Review review = reviewRepository.findByIdWithMemberAndChallenge(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "리뷰를 찾을 수 없습니다."));

        ensureOwner(review, currentMember);
        review.update(request.getRating(), normalizeContent(request.getContent()));
        return toResponse(review, currentMember.getId());
    }

    @Transactional
    public void deleteReview(Long reviewId) {
        Member currentMember = currentMemberService.requireCurrentMember();
        Review review = reviewRepository.findByIdWithMemberAndChallenge(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "리뷰를 찾을 수 없습니다."));

        ensureOwner(review, currentMember);
        reviewRepository.delete(review);
    }

    private void ensureReviewEligible(Long challengeId, Long memberId) {
        boolean attempted = attemptRepository.findTopByChallengeIdAndMemberIdOrderByCreatedAtDescIdDesc(challengeId, memberId)
                .isPresent();
        if (!attempted) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "챌린지를 시도한 뒤 리뷰를 작성할 수 있습니다.");
        }
    }

    private void ensureOwner(Review review, Member currentMember) {
        if (!review.getMember().getId().equals(currentMember.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인이 작성한 리뷰만 수정하거나 삭제할 수 있습니다.");
        }
    }

    private ReviewResponse toResponse(Review review, Long currentMemberId) {
        return new ReviewResponse(
                review.getId(),
                review.getChallenge().getId(),
                review.getChallenge().getTitle(),
                review.getMember().getId(),
                review.getMember().getDisplayName(),
                review.getRating(),
                review.getContent(),
                currentMemberId != null && review.getMember().getId().equals(currentMemberId),
                review.getCreatedAt(),
                review.getUpdatedAt());
    }

    private String normalizeContent(String content) {
        return content == null ? "" : content.trim();
    }
}
