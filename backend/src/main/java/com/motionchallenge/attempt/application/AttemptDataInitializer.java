package com.motionchallenge.attempt.application;

import com.motionchallenge.attempt.entity.Attempt;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AttemptDataInitializer {

    @Bean
    CommandLineRunner attemptSeeder(AttemptRepository attemptRepository, ChallengeRepository challengeRepository) {
        return args -> {
            if (attemptRepository.count() > 0) {
                return;
            }

            List<Challenge> challenges = challengeRepository.findAllByIsActiveTrueOrderByCreatedAtDesc();
            if (challenges.isEmpty()) {
                return;
            }

            Challenge firstChallenge = challenges.get(0);
            attemptRepository.save(new Attempt(
                    firstChallenge,
                    84,
                    AttemptStatus.COMPLETED,
                    null,
                    true,
                    "샘플 preview 흐름으로 만든 완료 결과입니다. 실제 업로드 자동 채점 결과와는 다를 수 있습니다.",
                    "초기 완료 샘플 기록"));

            if (challenges.size() > 1) {
                Challenge secondChallenge = challenges.get(1);
                attemptRepository.save(new Attempt(
                        secondChallenge,
                        0,
                        AttemptStatus.PREPARED,
                        null,
                        false,
                        "준비 단계에서 저장한 기록입니다. 실제 업로드와 자동 채점은 아직 진행하지 않았습니다.",
                        "카메라 준비 단계까지 저장한 기록"));
            }
        };
    }
}