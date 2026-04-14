package com.motionchallenge.challenge.repository;

import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ChallengeMotionProfileRepository extends JpaRepository<ChallengeMotionProfile, Long> {

    Optional<ChallengeMotionProfile> findByChallengeId(Long challengeId);

    List<ChallengeMotionProfile> findByChallengeIdIn(Collection<Long> challengeIds);

    @Query("select cmp.challenge.id from ChallengeMotionProfile cmp where cmp.challenge.id in :challengeIds")
    List<Long> findChallengeIdsByChallengeIdIn(Collection<Long> challengeIds);

    void deleteByChallengeId(Long challengeId);
}
