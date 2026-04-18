package com.motionchallenge.board.service;

import com.motionchallenge.board.dto.BoardPostListResponse;
import com.motionchallenge.board.dto.BoardPostResponse;
import com.motionchallenge.board.dto.BoardPostSummaryResponse;
import com.motionchallenge.board.dto.BoardPostUpsertRequest;
import com.motionchallenge.board.dto.BoardOverviewResponse;
import com.motionchallenge.board.dto.BoardChallengeReviewSummaryResponse;
import com.motionchallenge.board.entity.BoardCategory;
import com.motionchallenge.board.entity.BoardPost;
import com.motionchallenge.board.entity.BoardPostSourceType;
import com.motionchallenge.board.repository.BoardCommentRepository;
import com.motionchallenge.board.repository.BoardPostRepository;
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.entity.MemberRole;
import com.motionchallenge.member.service.CurrentMemberService;
import com.motionchallenge.review.entity.Review;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class BoardService {

    private final BoardPostRepository boardPostRepository;
    private final BoardCommentRepository boardCommentRepository;
    private final CurrentMemberService currentMemberService;

    public BoardService(
            BoardPostRepository boardPostRepository,
            BoardCommentRepository boardCommentRepository,
            CurrentMemberService currentMemberService) {
        this.boardPostRepository = boardPostRepository;
        this.boardCommentRepository = boardCommentRepository;
        this.currentMemberService = currentMemberService;
    }

    public BoardPostListResponse getPosts(
            int page,
            int size,
            BoardCategory category,
            BoardPostSourceType sourceType,
            Long challengeId,
            String keyword) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, 20));
        Long currentMemberId = currentMemberService.getCurrentMember().map(Member::getId).orElse(null);

        Page<BoardPost> result = boardPostRepository.search(
                category,
                sourceType,
                challengeId,
                normalizeKeyword(keyword),
                PageRequest.of(safePage - 1, safeSize));
        Map<Long, Long> commentCountMap = loadCommentCountMap(result.getContent());

        List<BoardPostSummaryResponse> items = result.getContent().stream()
                .map(post -> toSummary(post, currentMemberId, commentCountMap.getOrDefault(post.getId(), 0L)))
                .toList();

        return new BoardPostListResponse(items, result.getTotalElements(), safePage, safeSize);
    }

    public BoardOverviewResponse getOverview() {
        long totalCount = boardPostRepository.count();
        long reviewCount = boardPostRepository.countBySourceType(BoardPostSourceType.REVIEW_SYNC);
        long generalCount = boardPostRepository.countBySourceType(BoardPostSourceType.GENERAL);

        List<BoardChallengeReviewSummaryResponse> topReviewChallenges = boardPostRepository.findTopChallengeReviewSummaries(
                        BoardPostSourceType.REVIEW_SYNC,
                        PageRequest.of(0, 3))
                .stream()
                .map(this::toChallengeReviewSummary)
                .toList();

        return new BoardOverviewResponse(totalCount, generalCount, reviewCount, topReviewChallenges);
    }

    public BoardPostListResponse getMyPosts(int page, int size, BoardPostSourceType sourceType) {
        Member currentMember = currentMemberService.requireCurrentMember();
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, 20));

        Page<BoardPost> result = boardPostRepository.findAllByMemberId(
                currentMember.getId(),
                sourceType,
                PageRequest.of(safePage - 1, safeSize));
        Map<Long, Long> commentCountMap = loadCommentCountMap(result.getContent());

        List<BoardPostSummaryResponse> items = result.getContent().stream()
                .map(post -> toSummary(post, currentMember.getId(), commentCountMap.getOrDefault(post.getId(), 0L)))
                .toList();

        return new BoardPostListResponse(items, result.getTotalElements(), safePage, safeSize);
    }

    @Transactional
    public BoardPostResponse getPost(Long postId) {
        BoardPost post = boardPostRepository.findByIdWithMember(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        Long currentMemberId = currentMemberService.getCurrentMember().map(Member::getId).orElse(null);

        post.incrementViewCount();
        return toResponse(post, currentMemberId, boardCommentRepository.countByPostId(postId));
    }

    @Transactional
    public BoardPostResponse createPost(BoardPostUpsertRequest request) {
        Member currentMember = currentMemberService.requireCurrentMember();
        validateManualPostCategory(request.category());
        ensureCategoryPermission(currentMember, request.category(), request.pinned());

        BoardPost post = boardPostRepository.save(new BoardPost(
                request.category(),
                currentMember,
                normalizeTitle(request.title()),
                normalizeContent(request.content()),
                request.pinned()));

        return toResponse(post, currentMember.getId(), 0L);
    }

    @Transactional
    public BoardPostResponse updatePost(Long postId, BoardPostUpsertRequest request) {
        Member currentMember = currentMemberService.requireCurrentMember();
        BoardPost post = boardPostRepository.findByIdWithMember(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));

        ensureManualEditable(post, currentMember);
        validateManualPostCategory(request.category());
        ensureCategoryPermission(currentMember, request.category(), request.pinned());

        post.update(
                request.category(),
                normalizeTitle(request.title()),
                normalizeContent(request.content()),
                request.pinned());

        return toResponse(post, currentMember.getId(), boardCommentRepository.countByPostId(postId));
    }

    @Transactional
    public void deletePost(Long postId) {
        Member currentMember = currentMemberService.requireCurrentMember();
        BoardPost post = boardPostRepository.findByIdWithMember(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));

        ensureManualEditable(post, currentMember);
        boardCommentRepository.deleteByPostId(postId);
        boardPostRepository.delete(post);
    }

    @Transactional
    public void syncReviewPost(Review review) {
        BoardPost post = boardPostRepository.findByReviewId(review.getId())
                .orElseGet(() -> BoardPost.reviewSyncPost(
                        review.getMember(),
                        review.getId(),
                        review.getChallenge().getId(),
                        review.getChallenge().getTitle(),
                        review.getRating(),
                        normalizeContent(review.getContent())));

        post.syncReview(
                review.getChallenge().getId(),
                review.getChallenge().getTitle(),
                review.getRating(),
                normalizeContent(review.getContent()));

        if (post.getId() == null) {
            boardPostRepository.save(post);
        }
    }

    @Transactional
    public void deleteReviewPost(Long reviewId) {
        boardPostRepository.findByReviewId(reviewId).ifPresent(post -> {
            boardCommentRepository.deleteByPostId(post.getId());
            boardPostRepository.delete(post);
        });
    }

    private void validateManualPostCategory(BoardCategory category) {
        if (category == BoardCategory.REVIEW) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "후기 게시글은 챌린지 후기에서 자동으로 노출됩니다.");
        }
    }

    private void ensureManualEditable(BoardPost post, Member currentMember) {
        if (post.getSourceType() == BoardPostSourceType.REVIEW_SYNC) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "후기 게시글은 챌린지 상세에서 수정하거나 삭제할 수 있습니다.");
        }

        if (post.getMember().getId().equals(currentMember.getId())) {
            return;
        }
        if (currentMember.getRole() == MemberRole.ADMIN) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 글만 수정하거나 삭제할 수 있습니다.");
    }

    private void ensureCategoryPermission(Member currentMember, BoardCategory category, boolean pinned) {
        if ((category == BoardCategory.NOTICE || pinned) && currentMember.getRole() != MemberRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "공지글과 고정글은 관리자만 작성할 수 있습니다.");
        }
    }

    private BoardPostSummaryResponse toSummary(BoardPost post, Long currentMemberId, long commentCount) {
        return new BoardPostSummaryResponse(
                post.getId(),
                post.getCategory(),
                post.getSourceType(),
                post.getTitle(),
                buildExcerpt(post.getContent()),
                post.getMember().getDisplayName(),
                post.getCreatedAt(),
                post.getUpdatedAt(),
                post.getViewCount(),
                commentCount,
                currentMemberId != null && post.getMember().getId().equals(currentMemberId),
                post.isPinned(),
                post.getReviewId(),
                post.getChallengeId(),
                post.getChallengeTitle(),
                post.getReviewRating());
    }

    private BoardPostResponse toResponse(BoardPost post, Long currentMemberId, long commentCount) {
        return new BoardPostResponse(
                post.getId(),
                post.getCategory(),
                post.getSourceType(),
                post.getTitle(),
                post.getContent(),
                post.getMember().getId(),
                post.getMember().getDisplayName(),
                post.getCreatedAt(),
                post.getUpdatedAt(),
                post.getViewCount(),
                commentCount,
                currentMemberId != null && post.getMember().getId().equals(currentMemberId),
                post.isPinned(),
                post.getReviewId(),
                post.getChallengeId(),
                post.getChallengeTitle(),
                post.getReviewRating());
    }

    private Map<Long, Long> loadCommentCountMap(List<BoardPost> posts) {
        if (posts.isEmpty()) {
            return Collections.emptyMap();
        }

        List<Long> postIds = posts.stream().map(BoardPost::getId).toList();
        Map<Long, Long> countMap = new HashMap<>();
        for (Object[] row : boardCommentRepository.countByPostIds(postIds)) {
            countMap.put((Long) row[0], (Long) row[1]);
        }
        return countMap;
    }

    private String buildExcerpt(String content) {
        String normalized = normalizeContent(content).replace('\n', ' ');
        if (normalized.length() <= 120) {
            return normalized;
        }
        return normalized.substring(0, 117) + "...";
    }

    private String normalizeTitle(String title) {
        return title == null ? "" : title.trim();
    }

    private String normalizeContent(String content) {
        return content == null ? "" : content.trim();
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null) {
            return null;
        }
        String trimmed = keyword.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private BoardChallengeReviewSummaryResponse toChallengeReviewSummary(Object[] row) {
        Long challengeId = (Long) row[0];
        String challengeTitle = (String) row[1];
        long reviewCount = (Long) row[2];
        double averageRating = ((Number) row[3]).doubleValue();
        return new BoardChallengeReviewSummaryResponse(challengeId, challengeTitle, reviewCount, averageRating);
    }
}
