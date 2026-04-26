package com.motionchallenge.member.entity;

import com.motionchallenge.global.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "members")
public class Member extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @Column(length = 60)
    private String passwordHash;

    @Column(nullable = false, length = 40)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MemberAuthProvider authProvider;

    @Column(length = 120)
    private String providerUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MemberRole role;

    protected Member() {
    }

    private Member(
            String email,
            String passwordHash,
            String displayName,
            MemberAuthProvider authProvider,
            String providerUserId,
            MemberRole role) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.authProvider = authProvider;
        this.providerUserId = providerUserId;
        this.role = role;
    }

    public static Member local(String email, String passwordHash, String displayName, MemberRole role) {
        return new Member(email, passwordHash, displayName, MemberAuthProvider.LOCAL, null, role);
    }

    public static Member social(
            MemberAuthProvider authProvider,
            String providerUserId,
            String email,
            String displayName,
            MemberRole role) {
        if (authProvider == null || authProvider == MemberAuthProvider.LOCAL) {
            throw new IllegalArgumentException("Social account provider must not be LOCAL.");
        }
        return new Member(email, null, displayName, authProvider, providerUserId, role);
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public MemberAuthProvider getAuthProvider() {
        return authProvider;
    }

    public String getProviderUserId() {
        return providerUserId;
    }

    public MemberRole getRole() {
        return role;
    }

    public boolean isLocalAccount() {
        return authProvider == MemberAuthProvider.LOCAL;
    }

    public void updateProfile(String email, String displayName, MemberRole role) {
        this.email = email;
        this.displayName = displayName;
        this.role = role;
    }

    public void updatePasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void updateSocialIdentity(MemberAuthProvider authProvider, String providerUserId) {
        this.authProvider = authProvider;
        this.providerUserId = providerUserId;
        this.passwordHash = null;
    }

    public void withdraw(String anonymizedEmail, String anonymizedDisplayName, String disabledPasswordHash) {
        this.email = anonymizedEmail;
        this.displayName = anonymizedDisplayName;
        this.passwordHash = disabledPasswordHash;
        this.authProvider = MemberAuthProvider.LOCAL;
        this.providerUserId = null;
        this.role = MemberRole.USER;
    }
}
