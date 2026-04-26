package com.motionchallenge.challenge.controller;

import com.motionchallenge.challenge.dto.ChallengeReferencePosePreviewResponse;
import com.motionchallenge.challenge.dto.ChallengeResponse;
import com.motionchallenge.challenge.service.ChallengeService;
import com.motionchallenge.review.dto.ReviewResponse;
import com.motionchallenge.review.dto.ReviewUpsertRequest;
import com.motionchallenge.review.service.ReviewService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/challenges")
public class ChallengeController {

    private final ChallengeService challengeService;
    private final ReviewService reviewService;

    public ChallengeController(ChallengeService challengeService, ReviewService reviewService) {
        this.challengeService = challengeService;
        this.reviewService = reviewService;
    }

    @GetMapping
    public List<ChallengeResponse> getChallenges() {
        return challengeService.getChallenges();
    }

    @GetMapping("/popular")
    public List<ChallengeResponse> getPopularChallenges() {
        return challengeService.getPopularChallenges();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ChallengeResponse> getChallenge(@PathVariable Long id) {
        return challengeService.getChallenge(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/reference-preview")
    public ResponseEntity<ChallengeReferencePosePreviewResponse> getReferencePosePreview(@PathVariable Long id) {
        return challengeService.getReferencePosePreview(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/reviews")
    public List<ReviewResponse> getChallengeReviews(@PathVariable Long id) {
        return reviewService.getChallengeReviews(id);
    }

    @PostMapping("/{id}/reviews")
    public ReviewResponse createChallengeReview(
            @PathVariable Long id,
            @Valid @RequestBody ReviewUpsertRequest request) {
        return reviewService.createReview(id, request);
    }
}
