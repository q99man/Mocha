package com.motionchallenge.video.service;

import java.nio.file.Path;

public record StoredVideo(
        String originalFileName,
        String storagePath,
        Path absolutePath,
        String contentType,
        long size) {
}