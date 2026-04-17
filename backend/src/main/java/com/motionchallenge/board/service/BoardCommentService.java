package com.motionchallenge.board.service;

import com.motionchallenge.board.dto.BoardCommentResponse;
import com.motionchallenge.board.dto.BoardCommentUpsertRequest;
import com.motionchallenge.board.entity.BoardComment;
import com.motionchallenge.board.entity.BoardPost;
import com.motionchallenge.board.repository.BoardCommentRepository;
import com.motionchallenge.board.repository.BoardPostRepository;
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.entity.MemberRole;
import com.motionchallenge.member.service.CurrentMemberService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class BoardCommentService {

    private final BoardCommentRepository boardCommentRepository;
    private final BoardPostRepository boardPostRepository;
    private final CurrentMemberService currentMemberService;

    public BoardCommentService(
            BoardCommentRepository boardCommentRepository,
            BoardPostRepository boardPostRepository,
            CurrentMemberService currentMemberService) {
        this.boardCommentRepository = boardCommentRepository;
        this.boardPostRepository = boardPostRepository;
        this.currentMemberService = currentMemberService;
    }

    public List<BoardCommentResponse> getComments(Long postId) {
        ensurePostExists(postId);
        Long currentMemberId = currentMemberService.getCurrentMember()
                .map(Member::getId)
                .orElse(null);

        return boardCommentRepository.findAllByPostIdWithMemberOrderByCreatedAtAsc(postId).stream()
                .map(comment -> toResponse(comment, currentMemberId))
                .toList();
    }

    @Transactional
    public BoardCommentResponse createComment(Long postId, BoardCommentUpsertRequest request) {
        Member currentMember = currentMemberService.requireCurrentMember();
        BoardPost post = boardPostRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));

        BoardComment comment = boardCommentRepository.save(new BoardComment(
                post,
                currentMember,
                normalizeContent(request.content())));

        return toResponse(comment, currentMember.getId());
    }

    @Transactional
    public BoardCommentResponse updateComment(Long commentId, BoardCommentUpsertRequest request) {
        Member currentMember = currentMemberService.requireCurrentMember();
        BoardComment comment = boardCommentRepository.findByIdWithMemberAndPost(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."));

        ensureEditable(comment, currentMember);
        comment.update(normalizeContent(request.content()));
        return toResponse(comment, currentMember.getId());
    }

    @Transactional
    public void deleteComment(Long commentId) {
        Member currentMember = currentMemberService.requireCurrentMember();
        BoardComment comment = boardCommentRepository.findByIdWithMemberAndPost(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."));

        ensureEditable(comment, currentMember);
        boardCommentRepository.delete(comment);
    }

    private void ensurePostExists(Long postId) {
        if (!boardPostRepository.existsById(postId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.");
        }
    }

    private void ensureEditable(BoardComment comment, Member currentMember) {
        if (comment.getMember().getId().equals(currentMember.getId())) {
            return;
        }
        if (currentMember.getRole() == MemberRole.ADMIN) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 댓글만 수정하거나 삭제할 수 있습니다.");
    }

    private BoardCommentResponse toResponse(BoardComment comment, Long currentMemberId) {
        return new BoardCommentResponse(
                comment.getId(),
                comment.getPost().getId(),
                comment.getMember().getId(),
                comment.getMember().getDisplayName(),
                comment.getContent(),
                currentMemberId != null && comment.getMember().getId().equals(currentMemberId),
                comment.getCreatedAt(),
                comment.getUpdatedAt());
    }

    private String normalizeContent(String content) {
        return content == null ? "" : content.trim();
    }
}
