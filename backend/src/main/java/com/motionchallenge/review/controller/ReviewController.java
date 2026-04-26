package com.motionchallenge.review.controller;

import com.motionchallenge.review.dto.ReviewResponse;
import com.motionchallenge.review.dto.ReviewUpsertRequest;
import com.motionchallenge.review.service.ReviewService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @GetMapping
    public List<ReviewResponse> getRecentReviews(@RequestParam(defaultValue = "60") int limit) {
        return reviewService.getRecentReviews(limit);
    }

    @GetMapping("/me")
    public List<ReviewResponse> getMyReviews() {
        return reviewService.getMyReviews();
    }

    @PatchMapping("/{reviewId}")
    public ReviewResponse updateReview(
            @PathVariable Long reviewId,
            @Valid @RequestBody ReviewUpsertRequest request) {
        return reviewService.updateReview(reviewId, request);
    }

    @DeleteMapping("/{reviewId}")
    public ResponseEntity<Void> deleteReview(@PathVariable Long reviewId) {
        reviewService.deleteReview(reviewId);
        return ResponseEntity.noContent().build();
    }
}
