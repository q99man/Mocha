package com.motionchallenge.attempt.entity;

import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.global.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "attempt_processing_jobs")
public class AttemptProcessingJob extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String trackingId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_id", nullable = false)
    private Challenge challenge;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AttemptProcessingJobStatus status;

    @Column(nullable = false, length = 40)
    private String processingMode;

    @Column(length = 60)
    private String runtimeState;

    @Column(length = 40)
    private String failureCode;

    @Column(length = 500)
    private String processingNotice;

    @Column(length = 255)
    private String originalFileName;

    @Column(length = 500)
    private String storagePath;

    @Column(length = 100)
    private String contentType;

    @Column(nullable = false)
    private long fileSize;

    @Column(length = 500)
    private String pendingNotes;

    @Column(nullable = false)
    private int processingAttempts;

    @Column(name = "result_attempt_id")
    private Long resultAttemptId;

    protected AttemptProcessingJob() {
    }

    public AttemptProcessingJob(
            String trackingId,
            Challenge challenge,
            AttemptProcessingJobStatus status,
            String processingMode,
            String runtimeState,
            String processingNotice,
            String originalFileName,
            String storagePath,
            String contentType,
            long fileSize,
            String pendingNotes) {
        this.trackingId = trackingId;
        this.challenge = challenge;
        this.status = status;
        this.processingMode = processingMode;
        this.runtimeState = runtimeState;
        this.processingNotice = processingNotice;
        this.originalFileName = originalFileName;
        this.storagePath = storagePath;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.pendingNotes = pendingNotes;
        this.processingAttempts = 0;
    }

    public Long getId() {
        return id;
    }

    public String getTrackingId() {
        return trackingId;
    }

    public Challenge getChallenge() {
        return challenge;
    }

    public AttemptProcessingJobStatus getStatus() {
        return status;
    }

    public String getProcessingMode() {
        return processingMode;
    }

    public String getRuntimeState() {
        return runtimeState;
    }

    public String getFailureCode() {
        return failureCode;
    }

    public String getProcessingNotice() {
        return processingNotice;
    }

    public String getOriginalFileName() {
        return originalFileName;
    }

    public String getStoragePath() {
        return storagePath;
    }

    public String getContentType() {
        return contentType;
    }

    public long getFileSize() {
        return fileSize;
    }

    public String getPendingNotes() {
        return pendingNotes;
    }

    public int getProcessingAttempts() {
        return processingAttempts;
    }

    public Long getResultAttemptId() {
        return resultAttemptId;
    }

    public void markProcessing(String runtimeState, String processingNotice) {
        this.status = AttemptProcessingJobStatus.PROCESSING;
        this.runtimeState = runtimeState;
        this.processingNotice = processingNotice;
        this.processingAttempts += 1;
    }

    public void markCompleted(Long resultAttemptId, String runtimeState, String processingNotice) {
        this.status = AttemptProcessingJobStatus.COMPLETED;
        this.resultAttemptId = resultAttemptId;
        this.runtimeState = runtimeState;
        this.processingNotice = processingNotice;
        this.failureCode = null;
    }

    public void markFailed(String failureCode, String runtimeState, String processingNotice) {
        this.status = AttemptProcessingJobStatus.FAILED;
        this.failureCode = failureCode;
        this.runtimeState = runtimeState;
        this.processingNotice = processingNotice;
    }
}