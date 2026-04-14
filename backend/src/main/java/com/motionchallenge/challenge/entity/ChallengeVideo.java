package com.motionchallenge.challenge.entity;

import com.motionchallenge.global.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "challenge_videos")
public class ChallengeVideo extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_id", nullable = false, unique = true)
    private Challenge challenge;

    @Column(nullable = false, length = 255)
    private String originalFileName;

    @Column(nullable = false, length = 500)
    private String storagePath;

    @Column(length = 100)
    private String contentType;

    @Column(nullable = false)
    private long size;

    protected ChallengeVideo() {
    }

    public ChallengeVideo(
            Challenge challenge,
            String originalFileName,
            String storagePath,
            String contentType,
            long size) {
        this.challenge = challenge;
        this.originalFileName = originalFileName;
        this.storagePath = storagePath;
        this.contentType = contentType;
        this.size = size;
    }

    public Long getId() {
        return id;
    }

    public Challenge getChallenge() {
        return challenge;
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

    public long getSize() {
        return size;
    }

    public void updateStoredVideo(
            String originalFileName,
            String storagePath,
            String contentType,
            long size) {
        this.originalFileName = originalFileName;
        this.storagePath = storagePath;
        this.contentType = contentType;
        this.size = size;
    }
}
