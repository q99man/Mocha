package com.motionchallenge.attempt.application;

import jakarta.validation.constraints.NotNull;
import org.springframework.web.multipart.MultipartFile;

public class AttemptVideoUploadRequest {

    @NotNull
    private Long challengeId;

    private String notes;

    @NotNull
    private MultipartFile attemptVideo;

    public Long getChallengeId() {
        return challengeId;
    }

    public void setChallengeId(Long challengeId) {
        this.challengeId = challengeId;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public MultipartFile getAttemptVideo() {
        return attemptVideo;
    }

    public void setAttemptVideo(MultipartFile attemptVideo) {
        this.attemptVideo = attemptVideo;
    }
}