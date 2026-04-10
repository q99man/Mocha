package com.motionchallenge.admin.dto;

import com.motionchallenge.admin.entity.ModelAsset;
import java.time.LocalDateTime;

public record ModelAssetResponse(
        Long id,
        String assetType,
        String originalFileName,
        String storagePath,
        String runtimePath,
        String contentType,
        long size,
        String versionLabel,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static ModelAssetResponse from(ModelAsset modelAsset) {
        return new ModelAssetResponse(
                modelAsset.getId(),
                modelAsset.getAssetType().name(),
                modelAsset.getOriginalFileName(),
                modelAsset.getStoragePath(),
                modelAsset.getRuntimePath(),
                modelAsset.getContentType(),
                modelAsset.getSize(),
                modelAsset.getVersionLabel(),
                modelAsset.isActive(),
                modelAsset.getCreatedAt(),
                modelAsset.getUpdatedAt());
    }
}
