package com.motionchallenge.board.controller;

import com.motionchallenge.board.dto.BoardPostListResponse;
import com.motionchallenge.board.dto.BoardOverviewResponse;
import com.motionchallenge.board.dto.BoardPostResponse;
import com.motionchallenge.board.dto.BoardPostUpsertRequest;
import com.motionchallenge.board.entity.BoardCategory;
import com.motionchallenge.board.entity.BoardPostSourceType;
import com.motionchallenge.board.service.BoardService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/board/posts")
public class BoardController {

    private final BoardService boardService;

    public BoardController(BoardService boardService) {
        this.boardService = boardService;
    }

    @GetMapping
    public BoardPostListResponse getPosts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) BoardCategory category,
            @RequestParam(required = false) BoardPostSourceType sourceType,
            @RequestParam(required = false) Long challengeId,
            @RequestParam(required = false) String keyword) {
        return boardService.getPosts(page, size, category, sourceType, challengeId, keyword);
    }

    @GetMapping("/overview")
    public BoardOverviewResponse getOverview() {
        return boardService.getOverview();
    }

    @GetMapping("/me")
    public BoardPostListResponse getMyPosts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return boardService.getMyPosts(page, size);
    }

    @GetMapping("/{postId}")
    public BoardPostResponse getPost(@PathVariable Long postId) {
        return boardService.getPost(postId);
    }

    @PostMapping
    public ResponseEntity<BoardPostResponse> createPost(@Valid @RequestBody BoardPostUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(boardService.createPost(request));
    }

    @PatchMapping("/{postId}")
    public BoardPostResponse updatePost(@PathVariable Long postId, @Valid @RequestBody BoardPostUpsertRequest request) {
        return boardService.updatePost(postId, request);
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> deletePost(@PathVariable Long postId) {
        boardService.deletePost(postId);
        return ResponseEntity.noContent().build();
    }
}
