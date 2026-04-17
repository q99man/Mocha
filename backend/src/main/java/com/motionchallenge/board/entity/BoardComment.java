package com.motionchallenge.board.entity;

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

@Entity
@Table(name = "board_comments")
public class BoardComment extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private BoardPost post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false, length = 1200)
    private String content;

    protected BoardComment() {
    }

    public BoardComment(BoardPost post, Member member, String content) {
        this.post = post;
        this.member = member;
        this.content = content;
    }

    public Long getId() {
        return id;
    }

    public BoardPost getPost() {
        return post;
    }

    public Member getMember() {
        return member;
    }

    public String getContent() {
        return content;
    }

    public void update(String content) {
        this.content = content;
    }
}
