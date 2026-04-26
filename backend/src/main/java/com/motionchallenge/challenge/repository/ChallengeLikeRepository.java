package com.motionchallenge.challenge.repository;

import com.motionchallenge.challenge.entity.ChallengeLike;
import com.motionchallenge.challenge.entity.Challenge;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChallengeLikeRepository extends JpaRepository<ChallengeLike, Long> {

    interface ChallengeLikeStats {
        Long getChallengeId();

        long getLikeCount();
    }

    boolean existsByChallengeIdAndMemberId(Long challengeId, Long memberId);

    Optional<ChallengeLike> findByChallengeIdAndMemberId(Long challengeId, Long memberId);

    @Query("""
            select challengeLike.challenge.id as challengeId,
                   count(challengeLike) as likeCount
            from ChallengeLike challengeLike
            where challengeLike.challenge.id in :challengeIds
            group by challengeLike.challenge.id
            """)
    List<ChallengeLikeStats> findStatsByChallengeIdIn(@Param("challengeIds") Collection<Long> challengeIds);

    @Query("""
            select challengeLike.challenge.id
            from ChallengeLike challengeLike
            where challengeLike.challenge.id in :challengeIds
              and challengeLike.member.id = :memberId
            """)
    List<Long> findLikedChallengeIdsByMemberId(
            @Param("challengeIds") Collection<Long> challengeIds,
            @Param("memberId") Long memberId);

    @Query("""
            select challengeLike.challenge
            from ChallengeLike challengeLike
            where challengeLike.member.id = :memberId
              and challengeLike.challenge.isActive = true
            order by challengeLike.createdAt desc, challengeLike.id desc
            """)
    List<Challenge> findLikedActiveChallengesByMemberId(@Param("memberId") Long memberId);

    @Modifying
    @Query("delete from ChallengeLike challengeLike where challengeLike.challenge.id = :challengeId")
    void deleteByChallengeId(@Param("challengeId") Long challengeId);
}
