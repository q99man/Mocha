package com.motionchallenge.challenge.entity;

import com.motionchallenge.global.common.BaseTimeEntity;
import com.motionchallenge.member.entity.Member;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "challenge_likes",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_challenge_likes_challenge_member",
                columnNames = {"challenge_id", "member_id"}))
public class ChallengeLike extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_id", nullable = false)
    private Challenge challenge;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    protected ChallengeLike() {
    }

    public ChallengeLike(Challenge challenge, Member member) {
        this.challenge = challenge;
        this.member = member;
    }

    public Long getId() {
        return id;
    }

    public Challenge getChallenge() {
        return challenge;
    }

    public Member getMember() {
        return member;
    }
}
