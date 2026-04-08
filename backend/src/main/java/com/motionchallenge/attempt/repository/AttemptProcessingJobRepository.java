package com.motionchallenge.attempt.repository;

import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttemptProcessingJobRepository extends JpaRepository<AttemptProcessingJob, Long> {

    Optional<AttemptProcessingJob> findByTrackingId(String trackingId);

    Optional<AttemptProcessingJob> findTopByChallengeIdOrderByCreatedAtDesc(Long challengeId);

    Optional<AttemptProcessingJob> findTopByChallengeIdOrderByUpdatedAtDesc(Long challengeId);

    Optional<AttemptProcessingJob> findTopByResultAttemptIdOrderByUpdatedAtDesc(Long resultAttemptId);
}