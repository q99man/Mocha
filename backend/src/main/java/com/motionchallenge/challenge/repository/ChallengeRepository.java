package com.motionchallenge.challenge.repository;

import com.motionchallenge.challenge.entity.Challenge;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChallengeRepository extends JpaRepository<Challenge, Long> {

    List<Challenge> findAllByIsActiveTrueOrderByCreatedAtDesc();

    List<Challenge> findTop3ByIsActiveTrueOrderByCreatedAtDesc();

    Optional<Challenge> findByIdAndIsActiveTrue(Long id);
}
