package com.motionchallenge.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AccountPasswordChangeRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 8, max = 120) String newPassword) {
}
