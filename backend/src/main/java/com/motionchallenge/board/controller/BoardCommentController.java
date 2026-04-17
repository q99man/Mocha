package com.motionchallenge.board.controller;

import com.motionchallenge.board.dto.BoardCommentResponse;
import com.motionchallenge.board.dto.BoardCommentUpsertRequest;
import com.motionchallenge.board.service.BoardCommentService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/board")
public class BoardCommentController {

    private final BoardCommentService boardCommentService;

    public BoardCommentController(BoardCommentService boardCommentService) {
        this.boardCommentService = boardCommentService;
    }

    @GetMapping("/posts/{postId}/comments")
    public List<BoardCommentResponse> getComments(@PathVariable Long postId) {
        return boardCommentService.getComments(postId);
    }

    @PostMapping("/posts/{postId}/comments")
    public ResponseEntity<BoardCommentResponse> createComment(
            @PathVariable Long postId,
            @Valid @RequestBody BoardCommentUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(boardCommentService.createComment(postId, request));
    }

    @PatchMapping("/comments/{commentId}")
    public BoardCommentResponse updateComment(
            @PathVariable Long commentId,
            @Valid @RequestBody BoardCommentUpsertRequest request) {
        return boardCommentService.updateComment(commentId, request);
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long commentId) {
        boardCommentService.deleteComment(commentId);
        return ResponseEntity.noContent().build();
    }
}
