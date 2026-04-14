package com.motionchallenge.challenge.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.multipart.MultipartFile;

public class ChallengeUpdateRequest {

    @NotBlank
    private String title;

    @NotBlank
    private String description;

    @NotBlank
    private String category;

    @NotBlank
    private String difficulty;

    private String thumbnailUrl;

    private String guideVideoUrl;

    @NotNull
    @Min(5)
    @Max(600)
    private Integer durationSec;

    private MultipartFile referenceVideo;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getDifficulty() {
        return difficulty;
    }

    public void setDifficulty(String difficulty) {
        this.difficulty = difficulty;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public void setThumbnailUrl(String thumbnailUrl) {
        this.thumbnailUrl = thumbnailUrl;
    }

    public String getGuideVideoUrl() {
        return guideVideoUrl;
    }

    public void setGuideVideoUrl(String guideVideoUrl) {
        this.guideVideoUrl = guideVideoUrl;
    }

    public Integer getDurationSec() {
        return durationSec;
    }

    public void setDurationSec(Integer durationSec) {
        this.durationSec = durationSec;
    }

    public MultipartFile getReferenceVideo() {
        return referenceVideo;
    }

    public void setReferenceVideo(MultipartFile referenceVideo) {
        this.referenceVideo = referenceVideo;
    }
}
