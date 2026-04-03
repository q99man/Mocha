package com.motionchallenge.motion.service;

import com.motionchallenge.video.service.StoredVideo;

public interface MotionAnalysisService {

    MotionAnalysisResult analyzeReferenceVideo(StoredVideo storedVideo);

    MotionAnalysisResult analyzeAttemptVideo(StoredVideo storedVideo);
}