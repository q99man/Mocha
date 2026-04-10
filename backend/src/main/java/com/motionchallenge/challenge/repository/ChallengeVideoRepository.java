package com.motionchallenge.challenge.repository;

import com.motionchallenge.challenge.entity.ChallengeVideo;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChallengeVideoRepository extends JpaRepository<ChallengeVideo, Long> {

    Optional<ChallengeVideo> findByChallengeId(Long challengeId);

    List<ChallengeVideo> findByChallengeIdIn(Collection<Long> challengeIds);
}
