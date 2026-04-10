package com.motionchallenge.attempt.repository;

import java.time.LocalDateTime;

public interface ChallengeRetryAttemptProjection {

    Long getAttemptId();

    Long getChallengeId();

    Integer getScore();

    LocalDateTime getCreatedAt();

    Integer getPoseSimilarity();

    Integer getTimingSimilarity();

    Integer getStabilitySimilarity();

    String getStrongestArea();

    String getWeakestArea();
}
