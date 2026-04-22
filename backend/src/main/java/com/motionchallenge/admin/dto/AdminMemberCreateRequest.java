package com.motionchallenge.admin.dto;

import com.motionchallenge.member.entity.MemberRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AdminMemberCreateRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(max = 40) String displayName,
        @NotBlank @Size(min = 8, max = 120) String password,
        @NotNull MemberRole role) {
}
