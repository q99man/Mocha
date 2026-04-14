package com.motionchallenge.challenge.dto;

import jakarta.validation.constraints.NotNull;

public class ChallengeActiveUpdateRequest {

    @NotNull
    private Boolean isActive;

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }
}
