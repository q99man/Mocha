package com.motionchallenge.admin.repository;

import com.motionchallenge.admin.entity.ModelAsset;
import com.motionchallenge.admin.entity.ModelAssetType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModelAssetRepository extends JpaRepository<ModelAsset, Long> {

    List<ModelAsset> findAllByAssetTypeOrderByCreatedAtDesc(ModelAssetType assetType);

    Optional<ModelAsset> findTopByAssetTypeAndActiveTrueOrderByCreatedAtDesc(ModelAssetType assetType);

    Optional<ModelAsset> findByIdAndAssetType(Long id, ModelAssetType assetType);
}
