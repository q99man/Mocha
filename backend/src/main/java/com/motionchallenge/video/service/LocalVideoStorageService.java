package com.motionchallenge.video.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LocalVideoStorageService implements VideoStorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalVideoStorageService.class);
    private static final String NORMALIZED_CONTENT_TYPE = "video/mp4";

    private final Path rootPath;
    private final boolean audioNormalizationEnabled;
    private final String ffmpegPath;
    private final double targetLufs;
    private final double truePeak;
    private final double loudnessRange;
    private final Duration audioNormalizationTimeout;

    public LocalVideoStorageService(
            @Value("${app.storage.local-root:uploads}") String localRoot,
            @Value("${app.video.audio-normalization.enabled:true}") boolean audioNormalizationEnabled,
            @Value("${app.video.audio-normalization.ffmpeg-path:ffmpeg}") String ffmpegPath,
            @Value("${app.video.audio-normalization.target-lufs:-16}") double targetLufs,
            @Value("${app.video.audio-normalization.true-peak:-1.5}") double truePeak,
            @Value("${app.video.audio-normalization.loudness-range:11}") double loudnessRange,
            @Value("${app.video.audio-normalization.timeout-seconds:180}") long audioNormalizationTimeoutSeconds) {
        this.rootPath = Paths.get(localRoot).toAbsolutePath().normalize();
        this.audioNormalizationEnabled = audioNormalizationEnabled;
        this.ffmpegPath = ffmpegPath;
        this.targetLufs = targetLufs;
        this.truePeak = truePeak;
        this.loudnessRange = loudnessRange;
        this.audioNormalizationTimeout = Duration.ofSeconds(Math.max(1, audioNormalizationTimeoutSeconds));
    }

    @Override
    public StoredVideo storeChallengeReferenceVideo(Long challengeId, MultipartFile file) {
        return store(file, Path.of("challenges", String.valueOf(challengeId), "reference"), true);
    }

    @Override
    public StoredVideo storeAttemptVideo(Long challengeId, MultipartFile file) {
        return store(file, Path.of("attempts", String.valueOf(challengeId)), false);
    }

    @Override
    public StoredVideo loadStoredVideo(String originalFileName, String storagePath, String contentType, long size) {
        Path absolutePath = rootPath.resolve(storagePath).normalize();
        if (!Files.exists(absolutePath)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "저장된 비디오 파일을 찾을 수 없습니다.");
        }

        return new StoredVideo(originalFileName, storagePath, absolutePath, contentType, size);
    }

    @Override
    public void deleteStoredVideo(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) {
            return;
        }

        Path absolutePath = rootPath.resolve(storagePath).normalize();
        if (!absolutePath.startsWith(rootPath)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비디오 파일 경로가 유효하지 않습니다.");
        }

        try {
            Files.deleteIfExists(absolutePath);
            cleanupEmptyParents(absolutePath.getParent());
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "비디오 파일 삭제에 실패했습니다.", exception);
        }
    }

    private StoredVideo store(MultipartFile file, Path subDirectory, boolean normalizeAudio) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비디오 파일이 필요합니다.");
        }

        String originalFileName = file.getOriginalFilename() == null ? "video.bin" : file.getOriginalFilename();
        String extension = extractExtension(originalFileName);
        String savedFileName = UUID.randomUUID() + extension;
        Path targetDirectory = rootPath.resolve(subDirectory).normalize();
        Path targetPath = targetDirectory.resolve(savedFileName).normalize();

        try {
            Files.createDirectories(targetDirectory);
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            // TODO: 로컬 저장을 S3 등 외부 스토리지로 교체할 때 이 구현만 교체하면 됩니다.
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "비디오 파일 저장에 실패했습니다.");
        }

        StoredVideo normalizedVideo = normalizeAudioIfPossible(
                originalFileName,
                file.getContentType(),
                targetPath,
                normalizeAudio);
        if (normalizedVideo != null) {
            return normalizedVideo;
        }

        return new StoredVideo(
                originalFileName,
                rootPath.relativize(targetPath).toString().replace('\\', '/'),
                targetPath,
                file.getContentType(),
                file.getSize());
    }

    private String extractExtension(String originalFileName) {
        int lastDotIndex = originalFileName.lastIndexOf('.');
        if (lastDotIndex < 0) {
            return "";
        }

        return originalFileName.substring(lastDotIndex);
    }

    private StoredVideo normalizeAudioIfPossible(
            String originalFileName,
            String originalContentType,
            Path sourcePath,
            boolean normalizeAudio) {
        if (!normalizeAudio || !audioNormalizationEnabled) {
            return null;
        }

        Path normalizedPath = replaceExtension(sourcePath, "-normalized.mp4");
        String loudnormFilter = "loudnorm=I=%s:TP=%s:LRA=%s".formatted(targetLufs, truePeak, loudnessRange);
        ProcessBuilder processBuilder = new ProcessBuilder(
                ffmpegPath,
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                sourcePath.toString(),
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "20",
                "-af",
                loudnormFilter,
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
                normalizedPath.toString());
        processBuilder.redirectErrorStream(true);

        try {
            Process process = processBuilder.start();
            boolean finished = process.waitFor(audioNormalizationTimeout.toSeconds(), TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                Files.deleteIfExists(normalizedPath);
                log.warn("Challenge reference video audio normalization timed out: {}", sourcePath);
                return null;
            }

            int exitCode = process.exitValue();
            if (exitCode != 0 || !Files.exists(normalizedPath) || Files.size(normalizedPath) == 0) {
                Files.deleteIfExists(normalizedPath);
                log.warn("Challenge reference video audio normalization skipped. ffmpeg exitCode={}, source={}", exitCode, sourcePath);
                return null;
            }

            Files.deleteIfExists(sourcePath);
            return new StoredVideo(
                    originalFileName,
                    rootPath.relativize(normalizedPath).toString().replace('\\', '/'),
                    normalizedPath,
                    NORMALIZED_CONTENT_TYPE,
                    Files.size(normalizedPath));
        } catch (IOException exception) {
            deleteQuietly(normalizedPath);
            log.warn(
                    "Challenge reference video audio normalization skipped. ffmpegPath={}, contentType={}, source={}",
                    ffmpegPath,
                    originalContentType,
                    sourcePath);
            return null;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            deleteQuietly(normalizedPath);
            log.warn("Challenge reference video audio normalization interrupted: {}", sourcePath);
            return null;
        }
    }

    private Path replaceExtension(Path sourcePath, String suffixWithExtension) {
        String fileName = sourcePath.getFileName().toString();
        int lastDotIndex = fileName.lastIndexOf('.');
        String baseName = lastDotIndex < 0 ? fileName : fileName.substring(0, lastDotIndex);
        return sourcePath.resolveSibling(baseName + suffixWithExtension);
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // Best-effort cleanup only.
        }
    }

    private void cleanupEmptyParents(Path directory) throws IOException {
        Path current = directory;
        while (current != null && current.startsWith(rootPath) && !current.equals(rootPath)) {
            if (!Files.exists(current) || !isDirectoryEmpty(current)) {
                return;
            }
            Files.deleteIfExists(current);
            current = current.getParent();
        }
    }

    private boolean isDirectoryEmpty(Path directory) throws IOException {
        try (var children = Files.list(directory)) {
            return children.findAny().isEmpty();
        }
    }
}
