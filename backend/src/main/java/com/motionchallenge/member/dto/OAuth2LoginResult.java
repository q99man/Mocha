package com.motionchallenge.member.dto;

public record OAuth2LoginResult(
        MemberSessionResponse session,
        OAuth2LoginStatus status) {
}
