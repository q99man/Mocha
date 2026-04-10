package com.motionchallenge.attempt.repository;

import com.motionchallenge.attempt.entity.Attempt;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttemptRepository extends JpaRepository<Attempt, Long> {

    @Query("select a from Attempt a join fetch a.challenge order by a.createdAt desc, a.id desc")
    List<Attempt> findAllWithChallengeOrderByCreatedAtDesc();

    Optional<Attempt> findTopByChallengeIdOrderByCreatedAtDescIdDesc(Long challengeId);

    @Query("select a from Attempt a where a.challenge.id = :challengeId order by a.createdAt asc, a.id asc")
    List<Attempt> findByChallengeIdOrderByCreatedAtAscIdAsc(@Param("challengeId") Long challengeId);

    @Query("select a from Attempt a join fetch a.challenge where a.challenge.id = :challengeId order by a.createdAt asc, a.id asc")
    List<Attempt> findByChallengeIdWithChallengeOrderByCreatedAtAsc(Long challengeId);

    @Query("select a from Attempt a join fetch a.challenge where a.challenge.id in :challengeIds order by a.createdAt asc, a.id asc")
    List<Attempt> findByChallengeIdInWithChallengeOrderByCreatedAtAsc(List<Long> challengeIds);

    @Query(value = """
            select ranked.id as attemptId,
                   ranked.challenge_id as challengeId,
                   ranked.score as score,
                   ranked.created_at as createdAt,
                   ranked.pose_similarity as poseSimilarity,
                   ranked.timing_similarity as timingSimilarity,
                   ranked.stability_similarity as stabilitySimilarity,
                   ranked.strongest_area as strongestArea,
                   ranked.weakest_area as weakestArea
            from (
                select a.id,
                       a.challenge_id,
                       a.score,
                       a.created_at,
                       a.pose_similarity,
                       a.timing_similarity,
                       a.stability_similarity,
                       a.strongest_area,
                       a.weakest_area,
                       row_number() over (partition by a.challenge_id order by a.created_at desc, a.id desc) as rn
                from attempts a
                join attempt_videos av on av.attempt_id = a.id
                where a.challenge_id in (:challengeIds)
                  and a.status = 'Completed'
            ) ranked
            where ranked.rn <= 2
            order by ranked.challenge_id asc, ranked.created_at asc, ranked.id asc
            """, nativeQuery = true)
    List<ChallengeRetryAttemptProjection> findLatestUploadedAttemptSnapshotsByChallengeIds(
            @Param("challengeIds") Collection<Long> challengeIds);
}
