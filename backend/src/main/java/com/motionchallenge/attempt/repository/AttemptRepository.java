package com.motionchallenge.attempt.repository;

import com.motionchallenge.attempt.entity.Attempt;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AttemptRepository extends JpaRepository<Attempt, Long> {

    @Query("select a from Attempt a join fetch a.challenge order by a.createdAt desc, a.id desc")
    List<Attempt> findAllWithChallengeOrderByCreatedAtDesc();

    Optional<Attempt> findTopByChallengeIdOrderByCreatedAtDesc(Long challengeId);

    List<Attempt> findByChallengeIdOrderByCreatedAtAsc(Long challengeId);

    @Query("select a from Attempt a join fetch a.challenge where a.challenge.id = :challengeId order by a.createdAt asc, a.id asc")
    List<Attempt> findByChallengeIdWithChallengeOrderByCreatedAtAsc(Long challengeId);

    @Query("select a from Attempt a join fetch a.challenge where a.challenge.id in :challengeIds order by a.createdAt asc, a.id asc")
    List<Attempt> findByChallengeIdInWithChallengeOrderByCreatedAtAsc(List<Long> challengeIds);
}
