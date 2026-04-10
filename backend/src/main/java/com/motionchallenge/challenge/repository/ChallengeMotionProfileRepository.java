package com.motionchallenge.challenge.repository;

import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChallengeMotionProfileRepository extends JpaRepository<ChallengeMotionProfile, Long> {

    Optional<ChallengeMotionProfile> findByChallengeId(Long challengeId);

    void deleteByChallengeId(Long challengeId);
}
