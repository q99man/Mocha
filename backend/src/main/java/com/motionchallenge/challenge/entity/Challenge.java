package com.motionchallenge.challenge.entity;

import com.motionchallenge.global.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "challenges")
public class Challenge extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(nullable = false, length = 50)
    private String category;

    @Column(nullable = false, length = 30)
    private String difficulty;

    @Column(length = 500)
    private String thumbnailUrl;

    @Column(length = 500)
    private String guideVideoUrl;

    @Column(nullable = false)
    private Integer durationSec;

    @Column(nullable = false)
    private boolean isActive;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReferenceAnalysisStatus referenceAnalysisStatus;

    @Column
    private LocalDateTime referenceAnalyzedAt;

    protected Challenge() {
    }

    public Challenge(
            String title,
            String description,
            String category,
            String difficulty,
            String thumbnailUrl,
            String guideVideoUrl,
            Integer durationSec,
            boolean isActive) {
        this(
                title,
                description,
                category,
                difficulty,
                thumbnailUrl,
                guideVideoUrl,
                durationSec,
                isActive,
                ReferenceAnalysisStatus.NOT_ANALYZED,
                null);
    }

    public Challenge(
            String title,
            String description,
            String category,
            String difficulty,
            String thumbnailUrl,
            String guideVideoUrl,
            Integer durationSec,
            boolean isActive,
            ReferenceAnalysisStatus referenceAnalysisStatus,
            LocalDateTime referenceAnalyzedAt) {
        this.title = title;
        this.description = description;
        this.category = category;
        this.difficulty = difficulty;
        this.thumbnailUrl = thumbnailUrl;
        this.guideVideoUrl = guideVideoUrl;
        this.durationSec = durationSec;
        this.isActive = isActive;
        this.referenceAnalysisStatus = referenceAnalysisStatus;
        this.referenceAnalyzedAt = referenceAnalyzedAt;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getCategory() {
        return category;
    }

    public String getDifficulty() {
        return difficulty;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public String getGuideVideoUrl() {
        return guideVideoUrl;
    }

    public Integer getDurationSec() {
        return durationSec;
    }

    public boolean isActive() {
        return isActive;
    }

    public ReferenceAnalysisStatus getReferenceAnalysisStatus() {
        return referenceAnalysisStatus;
    }

    public LocalDateTime getReferenceAnalyzedAt() {
        return referenceAnalyzedAt;
    }

    public void markReferenceAnalyzing() {
        this.referenceAnalysisStatus = ReferenceAnalysisStatus.ANALYZING;
    }

    public void markReferenceAnalysisCompleted(LocalDateTime analyzedAt) {
        this.referenceAnalysisStatus = ReferenceAnalysisStatus.COMPLETED;
        this.referenceAnalyzedAt = analyzedAt;
    }

    public void markReferenceAnalysisFailed() {
        this.referenceAnalysisStatus = ReferenceAnalysisStatus.FAILED;
    }
}