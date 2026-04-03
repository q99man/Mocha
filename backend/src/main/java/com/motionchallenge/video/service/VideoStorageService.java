package com.motionchallenge.video.service;

import org.springframework.web.multipart.MultipartFile;

public interface VideoStorageService {

    StoredVideo storeChallengeReferenceVideo(Long challengeId, MultipartFile file);

    StoredVideo storeAttemptVideo(Long challengeId, MultipartFile file);

    StoredVideo loadStoredVideo(String originalFileName, String storagePath, String contentType, long size);
}