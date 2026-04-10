package com.motionchallenge.challenge.entity;

import com.motionchallenge.global.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "challenge_motion_profiles")
public class ChallengeMotionProfile extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_id", nullable = false, unique = true)
    private Challenge challenge;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String profileData;

    @Column(nullable = false)
    private int signature;

    @Column(nullable = false)
    private int sampleCount;

    @Column(nullable = false)
    private long durationMs;

    @Column(nullable = false, length = 100)
    private String analyzerName;

    @Column(nullable = false)
    private LocalDateTime analyzedAt;

    protected ChallengeMotionProfile() {
    }

    public ChallengeMotionProfile(
            Challenge challenge,
            String profileData,
            int signature,
            int sampleCount,
            long durationMs,
            String analyzerName,
            LocalDateTime analyzedAt) {
        this.challenge = challenge;
        this.profileData = profileData;
        this.signature = signature;
        this.sampleCount = sampleCount;
        this.durationMs = durationMs;
        this.analyzerName = analyzerName;
        this.analyzedAt = analyzedAt;
    }

    public Long getId() {
        return id;
    }

    public Challenge getChallenge() {
        return challenge;
    }

    public String getProfileData() {
        return profileData;
    }

    public int getSignature() {
        return signature;
    }

    public int getSampleCount() {
        return sampleCount;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public String getAnalyzerName() {
        return analyzerName;
    }

    public LocalDateTime getAnalyzedAt() {
        return analyzedAt;
    }
}
