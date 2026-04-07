package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.entity.AttemptProcessingJob;
import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AttemptProcessingJobStateService {

    private final AttemptProcessingJobRepository attemptProcessingJobRepository;

    public AttemptProcessingJobStateService(AttemptProcessingJobRepository attemptProcessingJobRepository) {
        this.attemptProcessingJobRepository = attemptProcessingJobRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<AttemptProcessingJob> markProcessing(String trackingId, String runtimeState, String processingNotice) {
        return attemptProcessingJobRepository.findByTrackingId(trackingId)
                .map(job -> {
                    job.markProcessing(runtimeState, processingNotice);
                    return attemptProcessingJobRepository.save(job);
                });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<AttemptProcessingJob> markCompleted(
            String trackingId,
            Long resultAttemptId,
            String runtimeState,
            String processingNotice) {
        return attemptProcessingJobRepository.findByTrackingId(trackingId)
                .map(job -> {
                    job.markCompleted(resultAttemptId, runtimeState, processingNotice);
                    return attemptProcessingJobRepository.save(job);
                });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<AttemptProcessingJob> markFailed(
            String trackingId,
            String failureCode,
            String runtimeState,
            String processingNotice) {
        return attemptProcessingJobRepository.findByTrackingId(trackingId)
                .map(job -> {
                    job.markFailed(failureCode, runtimeState, processingNotice);
                    return attemptProcessingJobRepository.save(job);
                });
    }
}
