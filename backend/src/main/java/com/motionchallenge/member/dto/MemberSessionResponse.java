package com.motionchallenge.member.dto;

import com.motionchallenge.member.entity.Member;

public record MemberSessionResponse(
        Long id,
        String email,
        String displayName,
        String role,
        boolean authenticated) {

    public static MemberSessionResponse from(Member member) {
        return new MemberSessionResponse(
                member.getId(),
                member.getEmail(),
                member.getDisplayName(),
                member.getRole().name(),
                true);
    }
}
