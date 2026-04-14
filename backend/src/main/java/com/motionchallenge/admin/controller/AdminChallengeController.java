package com.motionchallenge.admin.controller;

import com.motionchallenge.challenge.dto.ChallengeActiveUpdateRequest;
import com.motionchallenge.challenge.dto.ChallengeAnalysisResponse;
import com.motionchallenge.challenge.dto.ChallengeCreateRequest;
import com.motionchallenge.challenge.dto.ChallengeResponse;
import com.motionchallenge.challenge.dto.ChallengeUpdateRequest;
import com.motionchallenge.challenge.service.ChallengeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/challenges")
public class AdminChallengeController {

    private final ChallengeService challengeService;

    public AdminChallengeController(ChallengeService challengeService) {
        this.challengeService = challengeService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ChallengeResponse createChallenge(@Valid @ModelAttribute ChallengeCreateRequest request) {
        return challengeService.createChallenge(request);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ChallengeResponse updateChallenge(
            @PathVariable Long id,
            @Valid @ModelAttribute ChallengeUpdateRequest request) {
        return challengeService.updateChallenge(id, request);
    }

    @PatchMapping("/{id}/active")
    public ChallengeResponse updateChallengeActive(
            @PathVariable Long id,
            @Valid @RequestBody ChallengeActiveUpdateRequest request) {
        return challengeService.updateChallengeActive(id, request.getIsActive());
    }

    @PostMapping("/{id}/analyze-reference")
    public ChallengeAnalysisResponse analyzeReferenceVideo(@PathVariable Long id) {
        return challengeService.analyzeReferenceVideo(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteChallenge(@PathVariable Long id) {
        challengeService.deleteChallenge(id);
    }
}
