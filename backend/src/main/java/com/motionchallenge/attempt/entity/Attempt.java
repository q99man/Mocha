package com.motionchallenge.attempt.entity;

import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.global.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "attempts")
public class Attempt extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_id", nullable = false)
    private Challenge challenge;

    @Column(nullable = false)
    private Integer score;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(length = 40)
    private String processingMode;

    @Column(nullable = false)
    private boolean processingComplete;

    @Column(length = 500)
    private String processingNotice;

    @Column(length = 1000)
    private String notes;

    @Column(length = 1000)
    private String resultSummary;

    @Column
    private Integer poseSimilarity;

    @Column
    private Integer timingSimilarity;

    @Column
    private Integer stabilitySimilarity;

    @Column(length = 60)
    private String strongestArea;

    @Column(length = 60)
    private String weakestArea;

    protected Attempt() {
    }

    public Attempt(Challenge challenge, Integer score, String status, String notes) {
        this(challenge, score, status, null, false, null, notes, null, null, null, null, null, null);
    }

    public Attempt(
            Challenge challenge,
            Integer score,
            String status,
            String processingMode,
            boolean processingComplete,
            String processingNotice,
            String notes) {
        this(challenge, score, status, processingMode, processingComplete, processingNotice, notes, null, null, null, null, null, null);
    }

    public Attempt(
            Challenge challenge,
            Integer score,
            String status,
            String processingMode,
            boolean processingComplete,
            String processingNotice,
            String notes,
            String resultSummary,
            Integer poseSimilarity,
            Integer timingSimilarity,
            Integer stabilitySimilarity,
            String strongestArea,
            String weakestArea) {
        this.challenge = challenge;
        this.score = score;
        this.status = status;
        this.processingMode = processingMode;
        this.processingComplete = processingComplete;
        this.processingNotice = processingNotice;
        this.notes = notes;
        this.resultSummary = resultSummary;
        this.poseSimilarity = poseSimilarity;
        this.timingSimilarity = timingSimilarity;
        this.stabilitySimilarity = stabilitySimilarity;
        this.strongestArea = strongestArea;
        this.weakestArea = weakestArea;
    }

    public Long getId() {
        return id;
    }

    public Challenge getChallenge() {
        return challenge;
    }

    public Integer getScore() {
        return score;
    }

    public String getStatus() {
        return status;
    }

    public String getProcessingMode() {
        return processingMode;
    }

    public boolean isProcessingComplete() {
        return processingComplete;
    }

    public String getProcessingNotice() {
        return processingNotice;
    }

    public String getNotes() {
        return notes;
    }

    public String getResultSummary() {
        return resultSummary;
    }

    public Integer getPoseSimilarity() {
        return poseSimilarity;
    }

    public Integer getTimingSimilarity() {
        return timingSimilarity;
    }

    public Integer getStabilitySimilarity() {
        return stabilitySimilarity;
    }

    public String getStrongestArea() {
        return strongestArea;
    }

    public String getWeakestArea() {
        return weakestArea;
    }
}
