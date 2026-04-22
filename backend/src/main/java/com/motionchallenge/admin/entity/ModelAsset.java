package com.motionchallenge.admin.entity;

import com.motionchallenge.global.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "model_assets")
public class ModelAsset extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ModelAssetType assetType;

    @Column(nullable = false, length = 255)
    private String originalFileName;

    @Column(nullable = false, length = 500)
    private String storagePath;

    @Column(nullable = false, length = 500)
    private String runtimePath;

    @Column(length = 100)
    private String contentType;

    @Column(nullable = false)
    private long size;

    @Column(length = 100)
    private String versionLabel;

    @Column(nullable = false)
    private boolean active;

    protected ModelAsset() {
    }

    public ModelAsset(
            ModelAssetType assetType,
            String originalFileName,
            String storagePath,
            String runtimePath,
            String contentType,
            long size,
            String versionLabel,
            boolean active) {
        this.assetType = assetType;
        this.originalFileName = originalFileName;
        this.storagePath = storagePath;
        this.runtimePath = runtimePath;
        this.contentType = contentType;
        this.size = size;
        this.versionLabel = versionLabel;
        this.active = active;
    }

    public Long getId() {
        return id;
    }

    public ModelAssetType getAssetType() {
        return assetType;
    }

    public String getOriginalFileName() {
        return originalFileName;
    }

    public String getStoragePath() {
        return storagePath;
    }

    public String getRuntimePath() {
        return runtimePath;
    }

    public String getContentType() {
        return contentType;
    }

    public long getSize() {
        return size;
    }

    public String getVersionLabel() {
        return versionLabel;
    }

    public boolean isActive() {
        return active;
    }

    public void activate() {
        this.active = true;
    }

    public void deactivate() {
        this.active = false;
    }

    public void updateVersionLabel(String versionLabel) {
        this.versionLabel = versionLabel;
    }
}
