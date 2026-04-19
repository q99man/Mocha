package com.motionchallenge.attempt.repository;

import com.motionchallenge.attempt.entity.Attempt;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttemptRepository extends JpaRepository<Attempt, Long> {

    @Query("select a from Attempt a join fetch a.challenge where a.member.id = :memberId order by a.updatedAt desc, a.id desc")
    List<Attempt> findAllWithChallengeByMemberIdOrderByCreatedAtDesc(@Param("memberId") Long memberId);

    @Query(value = """
            select *
            from attempts
            where challenge_id = :challengeId
            order by updated_at desc, id desc
            limit 1
            """, nativeQuery = true)
    Optional<Attempt> findTopByChallengeIdOrderByCreatedAtDescIdDesc(@Param("challengeId") Long challengeId);

    @Query(value = """
            select *
            from attempts
            where challenge_id = :challengeId
              and member_id = :memberId
            order by updated_at desc, id desc
            limit 1
            """, nativeQuery = true)
    Optional<Attempt> findTopByChallengeIdAndMemberIdOrderByCreatedAtDescIdDesc(
            @Param("challengeId") Long challengeId,
            @Param("memberId") Long memberId);

    @Query("select a from Attempt a join fetch a.challenge where a.id = :attemptId and a.member.id = :memberId")
    Optional<Attempt> findByIdAndMemberIdWithChallenge(@Param("attemptId") Long attemptId, @Param("memberId") Long memberId);

    @Query("select a from Attempt a where a.challenge.id = :challengeId order by a.updatedAt asc, a.id asc")
    List<Attempt> findByChallengeIdOrderByCreatedAtAscIdAsc(@Param("challengeId") Long challengeId);

    @Query("select a from Attempt a where a.challenge.id = :challengeId and a.member.id = :memberId order by a.updatedAt asc, a.id asc")
    List<Attempt> findByChallengeIdAndMemberIdOrderByCreatedAtAscIdAsc(
            @Param("challengeId") Long challengeId,
            @Param("memberId") Long memberId);

    @Query("select a from Attempt a join fetch a.challenge where a.challenge.id = :challengeId order by a.updatedAt asc, a.id asc")
    List<Attempt> findByChallengeIdWithChallengeOrderByCreatedAtAsc(Long challengeId);

    @Query("select a from Attempt a join fetch a.challenge where a.challenge.id = :challengeId and a.member.id = :memberId order by a.updatedAt asc, a.id asc")
    List<Attempt> findByChallengeIdAndMemberIdWithChallengeOrderByCreatedAtAsc(
            @Param("challengeId") Long challengeId,
            @Param("memberId") Long memberId);

    @Query("select a from Attempt a join fetch a.challenge where a.challenge.id in :challengeIds order by a.updatedAt asc, a.id asc")
    List<Attempt> findByChallengeIdInWithChallengeOrderByCreatedAtAsc(List<Long> challengeIds);

    @Query(value = """
            select ranked.id as attemptId,
                   ranked.challenge_id as challengeId,
                   ranked.score as score,
                   ranked.updated_at as createdAt,
                   ranked.pose_similarity as poseSimilarity,
                   ranked.timing_similarity as timingSimilarity,
                   ranked.stability_similarity as stabilitySimilarity,
                   ranked.strongest_area as strongestArea,
                   ranked.weakest_area as weakestArea
            from (
                select a.id,
                       a.challenge_id,
                       a.score,
                       a.updated_at,
                       a.pose_similarity,
                       a.timing_similarity,
                       a.stability_similarity,
                       a.strongest_area,
                       a.weakest_area,
                       row_number() over (partition by a.challenge_id order by a.updated_at desc, a.id desc) as rn
                from attempts a
                join attempt_videos av on av.attempt_id = a.id
                where a.challenge_id in (:challengeIds)
                  and a.status = 'Completed'
            ) ranked
            where ranked.rn <= 2
            order by ranked.challenge_id asc, ranked.updated_at asc, ranked.id asc
            """, nativeQuery = true)
    List<ChallengeRetryAttemptProjection> findLatestUploadedAttemptSnapshotsByChallengeIds(
            @Param("challengeIds") Collection<Long> challengeIds);

    @Query(value = """
            select ranked.id as attemptId,
                   ranked.challenge_id as challengeId,
                   ranked.score as score,
                   ranked.updated_at as createdAt,
                   ranked.pose_similarity as poseSimilarity,
                   ranked.timing_similarity as timingSimilarity,
                   ranked.stability_similarity as stabilitySimilarity,
                   ranked.strongest_area as strongestArea,
                   ranked.weakest_area as weakestArea
            from (
                select a.id,
                       a.challenge_id,
                       a.score,
                       a.updated_at,
                       a.pose_similarity,
                       a.timing_similarity,
                       a.stability_similarity,
                       a.strongest_area,
                       a.weakest_area,
                       row_number() over (partition by a.challenge_id order by a.updated_at desc, a.id desc) as rn
                from attempts a
                join attempt_videos av on av.attempt_id = a.id
                where a.challenge_id in (:challengeIds)
                  and a.member_id = :memberId
                  and a.status = 'Completed'
            ) ranked
            where ranked.rn <= 2
            order by ranked.challenge_id asc, ranked.updated_at asc, ranked.id asc
            """, nativeQuery = true)
    List<ChallengeRetryAttemptProjection> findLatestUploadedAttemptSnapshotsByChallengeIdsAndMemberId(
            @Param("challengeIds") Collection<Long> challengeIds,
            @Param("memberId") Long memberId);
}
