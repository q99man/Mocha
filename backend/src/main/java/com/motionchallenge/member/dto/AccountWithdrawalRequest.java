package com.motionchallenge.member.dto;

public record AccountWithdrawalRequest(
        String currentPassword,
        boolean confirmed) {
}
