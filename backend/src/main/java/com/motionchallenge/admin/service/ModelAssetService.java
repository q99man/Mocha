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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "활성화된 Pose Landmarker 모델이 등록되어 있지 않습니다."));
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

        modelAssetRepository.findAllByAssetTypeOrderByCreatedAtDesc(ModelAssetType.POSE_LANDMARKER)
                .stream()
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

    private void validateModelFile(MultipartFile modelFile) {
        if (modelFile == null || modelFile.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모델 파일이 필요합니다.");
        }

        String originalFileName = modelFile.getOriginalFilename();
        if (originalFileName == null || !originalFileName.toLowerCase().endsWith(".task")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ".task 모델 파일만 지원합니다.");
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
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "모델 저장 디렉터리를 준비하지 못했습니다.");
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
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "업로드한 모델 파일을 활성화하지 못했습니다.");
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
