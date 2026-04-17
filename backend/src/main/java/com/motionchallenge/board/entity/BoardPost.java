package com.motionchallenge.board.entity;

import com.motionchallenge.global.common.BaseTimeEntity;
import com.motionchallenge.member.entity.Member;
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
@Table(name = "board_posts")
public class BoardPost extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BoardCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BoardPostSourceType sourceType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 5000)
    private String content;

    @Column(nullable = false)
    private boolean pinned;

    @Column(nullable = false)
    private long viewCount;

    @Column
    private Long reviewId;

    @Column
    private Long challengeId;

    @Column(length = 120)
    private String challengeTitle;

    @Column
    private Integer reviewRating;

    protected BoardPost() {
    }

    public BoardPost(BoardCategory category, Member member, String title, String content, boolean pinned) {
        this.category = category;
        this.sourceType = BoardPostSourceType.GENERAL;
        this.member = member;
        this.title = title;
        this.content = content;
        this.pinned = pinned;
        this.viewCount = 0L;
    }

    public static BoardPost reviewSyncPost(
            Member member,
            Long reviewId,
            Long challengeId,
            String challengeTitle,
            Integer reviewRating,
            String content) {
        BoardPost post = new BoardPost(BoardCategory.REVIEW, member, buildReviewTitle(challengeTitle), content, false);
        post.sourceType = BoardPostSourceType.REVIEW_SYNC;
        post.reviewId = reviewId;
        post.challengeId = challengeId;
        post.challengeTitle = challengeTitle;
        post.reviewRating = reviewRating;
        return post;
    }

    public Long getId() {
        return id;
    }

    public BoardCategory getCategory() {
        return category;
    }

    public BoardPostSourceType getSourceType() {
        return sourceType;
    }

    public Member getMember() {
        return member;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public boolean isPinned() {
        return pinned;
    }

    public long getViewCount() {
        return viewCount;
    }

    public Long getReviewId() {
        return reviewId;
    }

    public Long getChallengeId() {
        return challengeId;
    }

    public String getChallengeTitle() {
        return challengeTitle;
    }

    public Integer getReviewRating() {
        return reviewRating;
    }

    public boolean isReviewSync() {
        return sourceType == BoardPostSourceType.REVIEW_SYNC;
    }

    public void update(BoardCategory category, String title, String content, boolean pinned) {
        this.category = category;
        this.sourceType = BoardPostSourceType.GENERAL;
        this.title = title;
        this.content = content;
        this.pinned = pinned;
        this.reviewId = null;
        this.challengeId = null;
        this.challengeTitle = null;
        this.reviewRating = null;
    }

    public void syncReview(Long challengeId, String challengeTitle, Integer reviewRating, String content) {
        this.category = BoardCategory.REVIEW;
        this.sourceType = BoardPostSourceType.REVIEW_SYNC;
        this.title = buildReviewTitle(challengeTitle);
        this.content = content;
        this.pinned = false;
        this.challengeId = challengeId;
        this.challengeTitle = challengeTitle;
        this.reviewRating = reviewRating;
    }

    public void incrementViewCount() {
        this.viewCount += 1;
    }

    private static String buildReviewTitle(String challengeTitle) {
        String safeTitle = challengeTitle == null ? "챌린지" : challengeTitle.trim();
        return safeTitle + " 후기";
    }
}
