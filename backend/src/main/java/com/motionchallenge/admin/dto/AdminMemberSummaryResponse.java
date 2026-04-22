package com.motionchallenge.admin.dto;

import com.motionchallenge.member.entity.Member;
import java.time.LocalDateTime;

public record AdminMemberSummaryResponse(
        Long id,
        String email,
        String displayName,
        String role,
        String authProvider,
        LocalDateTime createdAt,
        boolean self,
        boolean hasActivity,
        boolean canDelete) {

    public static AdminMemberSummaryResponse from(
            Member member,
            boolean self,
            boolean hasActivity,
            boolean canDelete) {
        return new AdminMemberSummaryResponse(
                member.getId(),
                member.getEmail(),
                member.getDisplayName(),
                member.getRole().name(),
                member.getAuthProvider().name(),
                member.getCreatedAt(),
                self,
                hasActivity,
                canDelete);
    }
}
