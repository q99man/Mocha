package com.motionchallenge.admin.dto;

public record ModelAssetUpdateRequest(
        String versionLabel,
        Boolean active) {
}
