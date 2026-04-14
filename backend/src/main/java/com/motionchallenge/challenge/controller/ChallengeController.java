package com.motionchallenge.challenge.controller;

import com.motionchallenge.challenge.dto.ChallengeReferencePosePreviewResponse;
import com.motionchallenge.challenge.dto.ChallengeResponse;
import com.motionchallenge.challenge.dto.MotionSessionStateResponse;
import com.motionchallenge.challenge.service.ChallengeService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/challenges")
public class ChallengeController {

    private final ChallengeService challengeService;

    public ChallengeController(ChallengeService challengeService) {
        this.challengeService = challengeService;
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

    @GetMapping("/{id}/motion-session")
    public ResponseEntity<MotionSessionStateResponse> getMotionSessionState(@PathVariable Long id) {
        return challengeService.getMotionSessionState(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/reference-preview")
    public ResponseEntity<ChallengeReferencePosePreviewResponse> getReferencePosePreview(@PathVariable Long id) {
        return challengeService.getReferencePosePreview(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
