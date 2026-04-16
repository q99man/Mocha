package com.motionchallenge.review.entity;

import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.global.common.BaseTimeEntity;
import com.motionchallenge.member.entity.Member;
import jakarta.persistence.Column;
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
        name = "challenge_reviews",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_challenge_reviews_challenge_member",
                columnNames = {"challenge_id", "member_id"}))
public class Review extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_id", nullable = false)
    private Challenge challenge;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false)
    private Integer rating;

    @Column(nullable = false, length = 1200)
    private String content;

    protected Review() {
    }

    public Review(Challenge challenge, Member member, Integer rating, String content) {
        this.challenge = challenge;
        this.member = member;
        this.rating = rating;
        this.content = content;
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

    public Integer getRating() {
        return rating;
    }

    public String getContent() {
        return content;
    }

    public void update(Integer rating, String content) {
        this.rating = rating;
        this.content = content;
    }
}
