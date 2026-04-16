package com.motionchallenge.admin.service;

import com.motionchallenge.admin.dto.ModelAssetResponse;
import com.motionchallenge.admin.entity.ModelAsset;
import com.motionchallenge.admin.entity.ModelAssetType;
import com.motionchallenge.admin.repository.ModelAssetRepository;
import com.motionchallenge.motion.service.MotionAnalysisProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ModelAssetService {

    private final ModelAssetRepository modelAssetRepository;
    private final Path storageRootPath;
    private final MotionAnalysisProperties motionAnalysisProperties;

    public ModelAssetService(
            ModelAssetRepository modelAssetRepository,
            @Value("${app.storage.local-root:uploads}") String localRoot,
            MotionAnalysisProperties motionAnalysisProperties) {
        this.modelAssetRepository = modelAssetRepository;
        this.storageRootPath = Paths.get(localRoot).toAbsolutePath().normalize();
        this.motionAnalysisProperties = motionAnalysisProperties;
    }

    public List<ModelAssetResponse> getPoseLandmarkerAssets() {
        return modelAssetRepository.findAllByAssetTypeOrderByCreatedAtDesc(ModelAssetType.POSE_LANDMARKER).stream()
                .map(ModelAssetResponse::from)
                .toList();
    }

    public ModelAssetResponse getActivePoseLandmarkerAsset() {
        return modelAssetRepository.findTopByAssetTypeAndActiveTrueOrderByCreatedAtDesc(ModelAssetType.POSE_LANDMARKER)
                .map(ModelAssetResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "활성화된 Pose Landmarker 모델이 없습니다."));
    }

    @Transactional
    public ModelAssetResponse uploadPoseLandmarker(MultipartFile modelFile, String versionLabel) {
        validateModelFile(modelFile);

        String originalFileName = modelFile.getOriginalFilename() == null ? "pose_landmarker.task" : modelFile.getOriginalFilename();
        String extension = extractExtension(originalFileName);
        String savedFileName = UUID.randomUUID() + extension;

        Path archiveDirectory = storageRootPath.resolve(Path.of("model-assets", "pose-landmarker")).normalize();
        Path archivePath = archiveDirectory.resolve(savedFileName).normalize();
        Path runtimeDirectory = resolveRuntimeModelDirectory();
        Path runtimePath = runtimeDirectory.resolve(motionAnalysisProperties.getMediapipe().getActiveModelFileName()).normalize();

        ensureDirectory(archiveDirectory);
        ensureDirectory(runtimeDirectory);
        copyMultipartFile(modelFile, archivePath);
        copyPath(archivePath, runtimePath);

        modelAssetRepository.findAllByAssetTypeOrderByCreatedAtDesc(ModelAssetType.POSE_LANDMARKER).stream()
                .filter(ModelAsset::isActive)
                .forEach(ModelAsset::deactivate);

        ModelAsset saved = modelAssetRepository.save(new ModelAsset(
                ModelAssetType.POSE_LANDMARKER,
                originalFileName,
                storageRootPath.relativize(archivePath).toString().replace('\\', '/'),
                runtimePath.toString(),
                modelFile.getContentType(),
                modelFile.getSize(),
                normalizeVersionLabel(versionLabel),
                true));

        return ModelAssetResponse.from(saved);
    }

    @Transactional
    public void deletePoseLandmarker(Long assetId) {
        ModelAsset asset = modelAssetRepository.findByIdAndAssetType(assetId, ModelAssetType.POSE_LANDMARKER)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "삭제할 Pose Landmarker 모델을 찾을 수 없습니다."));

        Path runtimeDirectory = resolveRuntimeModelDirectory();
        Path runtimePath = runtimeDirectory.resolve(motionAnalysisProperties.getMediapipe().getActiveModelFileName()).normalize();
        Path archivePath = storageRootPath.resolve(asset.getStoragePath()).normalize();
        boolean wasActive = asset.isActive();

        modelAssetRepository.delete(asset);
        deleteIfExists(archivePath);

        if (wasActive) {
            deleteIfExists(runtimePath);
            reactivateLatestArchivedPoseLandmarker(asset.getId(), runtimePath);
        }
    }

    private void validateModelFile(MultipartFile modelFile) {
        if (modelFile == null || modelFile.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모델 파일이 필요합니다.");
        }

        String originalFileName = modelFile.getOriginalFilename();
        if (originalFileName == null || !originalFileName.toLowerCase().endsWith(".task")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ".task 모델 파일만 업로드할 수 있습니다.");
        }
    }

    private String normalizeVersionLabel(String versionLabel) {
        if (versionLabel == null) {
            return null;
        }
        String trimmed = versionLabel.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Path resolveRuntimeModelDirectory() {
        String configuredDirectory = motionAnalysisProperties.getMediapipe().getModelDirectory();
        Path configuredPath = Paths.get(configuredDirectory);
        if (configuredPath.isAbsolute()) {
            return configuredPath.normalize();
        }
        return Paths.get("").toAbsolutePath().normalize().resolve(configuredPath).normalize();
    }

    private void ensureDirectory(Path path) {
        try {
            Files.createDirectories(path);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "모델 디렉터리를 준비하지 못했습니다.");
        }
    }

    private void copyMultipartFile(MultipartFile file, Path targetPath) {
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "업로드한 모델 파일을 저장하지 못했습니다.");
        }
    }

    private void copyPath(Path sourcePath, Path targetPath) {
        try {
            Files.copy(sourcePath, targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "활성 모델 파일을 갱신하지 못했습니다.");
        }
    }

    private void reactivateLatestArchivedPoseLandmarker(Long deletedAssetId, Path runtimePath) {
        modelAssetRepository.findAllByAssetTypeOrderByCreatedAtDesc(ModelAssetType.POSE_LANDMARKER).stream()
                .filter(candidate -> !candidate.getId().equals(deletedAssetId))
                .findFirst()
                .ifPresent(candidate -> {
                    Path candidateArchivePath = storageRootPath.resolve(candidate.getStoragePath()).normalize();
                    if (!Files.exists(candidateArchivePath)) {
                        throw new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                "대체 활성 모델 파일을 찾을 수 없습니다. 관리자에서 모델을 다시 업로드해 주세요.");
                    }
                    ensureDirectory(runtimePath.getParent());
                    copyPath(candidateArchivePath, runtimePath);
                    candidate.activate();
                });
    }

    private void deleteIfExists(Path targetPath) {
        try {
            Files.deleteIfExists(targetPath);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "모델 파일을 삭제하지 못했습니다.");
        }
    }

    private String extractExtension(String originalFileName) {
        int lastDotIndex = originalFileName.lastIndexOf('.');
        if (lastDotIndex < 0) {
            return "";
        }
        return originalFileName.substring(lastDotIndex);
    }
}
