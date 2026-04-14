package com.motionchallenge.attempt.repository;

import com.motionchallenge.attempt.entity.AttemptVideo;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttemptVideoRepository extends JpaRepository<AttemptVideo, Long> {

    Optional<AttemptVideo> findByAttemptId(Long attemptId);

    @Query("select av from AttemptVideo av where av.attempt.id in :attemptIds")
    List<AttemptVideo> findByAttemptIdIn(@Param("attemptIds") Collection<Long> attemptIds);

    @Query("select av.attempt.id from AttemptVideo av where av.attempt.id in :attemptIds")
    List<Long> findAttemptIdsByAttemptIdIn(Collection<Long> attemptIds);
}
