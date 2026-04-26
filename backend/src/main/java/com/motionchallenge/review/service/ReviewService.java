package com.motionchallenge.review.service;

import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.board.entity.BoardPost;
import com.motionchallenge.board.repository.BoardPostRepository;
import com.motionchallenge.board.service.BoardService;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.service.CurrentMemberService;
import com.motionchallenge.review.dto.ReviewResponse;
import com.motionchallenge.review.dto.ReviewUpsertRequest;
import com.motionchallenge.review.entity.Review;
import com.motionchallenge.review.repository.ReviewRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ReviewService {

    private static final int MAX_RECENT_REVIEW_LIMIT = 60;

    private final ReviewRepository reviewRepository;
    private final ChallengeRepository challengeRepository;
    private final AttemptRepository attemptRepository;
    private final BoardPostRepository boardPostRepository;
    private final BoardService boardService;
    private final CurrentMemberService currentMemberService;

    public ReviewService(
            ReviewRepository reviewRepository,
            ChallengeRepository challengeRepository,
            AttemptRepository attemptRepository,
            BoardPostRepository boardPostRepository,
            BoardService boardService,
            CurrentMemberService currentMemberService) {
        this.reviewRepository = reviewRepository;
        this.challengeRepository = challengeRepository;
        this.attemptRepository = attemptRepository;
        this.boardPostRepository = boardPostRepository;
        this.boardService = boardService;
        this.currentMemberService = currentMemberService;
    }

    public List<ReviewResponse> getChallengeReviews(Long challengeId) {
        Challenge challenge = challengeRepository.findByIdAndIsActiveTrue(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));

        Long currentMemberId = currentMemberService.getCurrentMember()
                .map(Member::getId)
                .orElse(null);

        return toResponses(
                reviewRepository.findAllByChallengeIdWithMemberAndChallengeOrderByCreatedAtDesc(challenge.getId()),
                currentMemberId);
    }

    public List<ReviewResponse> getRecentReviews(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, MAX_RECENT_REVIEW_LIMIT));
        return toResponses(reviewRepository.findRecentWithMemberAndChallenge(PageRequest.of(0, safeLimit)), null);
    }

    public List<ReviewResponse> getMyReviews() {
        Member currentMember = currentMemberService.requireCurrentMember();
        return toResponses(
                reviewRepository.findAllByMemberIdWithMemberAndChallengeOrderByCreatedAtDesc(currentMember.getId()),
                currentMember.getId());
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
        boardService.syncReviewPost(review);

        return toResponse(review, currentMember.getId(), resolveBoardPostId(review.getId()));
    }

    @Transactional
    public ReviewResponse updateReview(Long reviewId, ReviewUpsertRequest request) {
        Member currentMember = currentMemberService.requireCurrentMember();
        Review review = reviewRepository.findByIdWithMemberAndChallenge(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "리뷰를 찾을 수 없습니다."));

        ensureOwner(review, currentMember);
        review.update(request.getRating(), normalizeContent(request.getContent()));
        boardService.syncReviewPost(review);
        return toResponse(review, currentMember.getId(), resolveBoardPostId(review.getId()));
    }

    @Transactional
    public void deleteReview(Long reviewId) {
        Member currentMember = currentMemberService.requireCurrentMember();
        Review review = reviewRepository.findByIdWithMemberAndChallenge(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "리뷰를 찾을 수 없습니다."));

        ensureOwner(review, currentMember);
        boardService.deleteReviewPost(review.getId());
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

    private List<ReviewResponse> toResponses(List<Review> reviews, Long currentMemberId) {
        if (reviews.isEmpty()) {
            return List.of();
        }

        Map<Long, Long> boardPostIdMap = loadBoardPostIdMap(reviews);
        return reviews.stream()
                .map(review -> toResponse(review, currentMemberId, boardPostIdMap.get(review.getId())))
                .toList();
    }

    private Map<Long, Long> loadBoardPostIdMap(List<Review> reviews) {
        List<Long> reviewIds = reviews.stream()
                .map(Review::getId)
                .toList();

        Map<Long, Long> boardPostIdMap = new HashMap<>();
        for (BoardPost post : boardPostRepository.findAllByReviewIdIn(reviewIds)) {
            if (post.getReviewId() != null) {
                boardPostIdMap.put(post.getReviewId(), post.getId());
            }
        }
        return boardPostIdMap;
    }

    private Long resolveBoardPostId(Long reviewId) {
        return boardPostRepository.findByReviewId(reviewId)
                .map(BoardPost::getId)
                .orElse(null);
    }

    private ReviewResponse toResponse(Review review, Long currentMemberId, Long boardPostId) {
        return new ReviewResponse(
                review.getId(),
                boardPostId,
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
