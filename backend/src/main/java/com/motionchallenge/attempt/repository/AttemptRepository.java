package com.motionchallenge.attempt.repository;

import com.motionchallenge.attempt.entity.Attempt;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttemptRepository extends JpaRepository<Attempt, Long> {

    List<Attempt> findAllByOrderByCreatedAtDesc();
}