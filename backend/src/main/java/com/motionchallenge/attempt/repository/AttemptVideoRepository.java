package com.motionchallenge.attempt.repository;

import com.motionchallenge.attempt.entity.AttemptVideo;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttemptVideoRepository extends JpaRepository<AttemptVideo, Long> {

    Optional<AttemptVideo> findByAttemptId(Long attemptId);
}