package com.motionchallenge.attempt.repository;

import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttemptProcessingJobRepository extends JpaRepository<AttemptProcessingJob, Long> {

    boolean existsByMemberId(Long memberId);

    Optional<AttemptProcessingJob> findByTrackingId(String trackingId);

    Optional<AttemptProcessingJob> findByTrackingIdAndMemberId(String trackingId, Long memberId);

    Optional<AttemptProcessingJob> findTopByChallengeIdOrderByCreatedAtDesc(Long challengeId);

    Optional<AttemptProcessingJob> findTopByChallengeIdOrderByUpdatedAtDesc(Long challengeId);

    Optional<AttemptProcessingJob> findTopByChallengeIdAndMemberIdOrderByUpdatedAtDesc(Long challengeId, Long memberId);

    Optional<AttemptProcessingJob> findTopByResultAttemptIdOrderByUpdatedAtDesc(Long resultAttemptId);

    List<AttemptProcessingJob> findByResultAttemptIdInOrderByResultAttemptIdAscUpdatedAtDescIdDesc(
            Collection<Long> resultAttemptIds);

    List<AttemptProcessingJob> findByChallengeIdOrderByCreatedAtAsc(Long challengeId);
}
