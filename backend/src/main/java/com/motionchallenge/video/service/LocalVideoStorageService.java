package com.motionchallenge.video.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LocalVideoStorageService implements VideoStorageService {

    private final Path rootPath;

    public LocalVideoStorageService(@Value("${app.storage.local-root:uploads}") String localRoot) {
        this.rootPath = Paths.get(localRoot).toAbsolutePath().normalize();
    }

    @Override
    public StoredVideo storeChallengeReferenceVideo(Long challengeId, MultipartFile file) {
        return store(file, Path.of("challenges", String.valueOf(challengeId), "reference"));
    }

    @Override
    public StoredVideo storeAttemptVideo(Long challengeId, MultipartFile file) {
        return store(file, Path.of("attempts", String.valueOf(challengeId)));
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "鍮꾨뵒???뚯씪 寃쎈줈媛 ?좏슚?섏? ?딆뒿?덈떎.");
        }

        try {
            Files.deleteIfExists(absolutePath);
            cleanupEmptyParents(absolutePath.getParent());
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "鍮꾨뵒???뚯씪 ?곗궘??ㅽ뙣?덉뒿?덈떎.", exception);
        }
    }

    private StoredVideo store(MultipartFile file, Path subDirectory) {
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
