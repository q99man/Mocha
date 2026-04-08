package com.motionchallenge.challenge.service;

import com.motionchallenge.challenge.entity.Challenge;
import com.motionchallenge.challenge.entity.ChallengeMotionProfile;
import com.motionchallenge.challenge.entity.ReferenceAnalysisStatus;
import com.motionchallenge.challenge.repository.ChallengeMotionProfileRepository;
import com.motionchallenge.challenge.repository.ChallengeRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ChallengeDataInitializer {

    @Bean
    CommandLineRunner challengeSeeder(
            ChallengeRepository challengeRepository,
            ChallengeMotionProfileRepository challengeMotionProfileRepository) {
        return args -> {
            if (challengeRepository.count() == 0) {
                challengeRepository.save(new Challenge(
                        "사이드 그루브",
                        "상체 리듬과 부드러운 팔 전환을 집중 연습하는 입문용 챌린지입니다.",
                        "댄스",
                        "쉬움",
                        "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=900&q=80",
                        null,
                        20,
                        true,
                        ReferenceAnalysisStatus.NOT_ANALYZED,
                        null));
                challengeRepository.save(new Challenge(
                        "파워 스텝 스프린트",
                        "균형감과 자세 제어, 탄력 있는 전신 동작을 중심으로 구성한 피트니스 챌린지입니다.",
                        "피트니스",
                        "보통",
                        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80",
                        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                        30,
                        true,
                        ReferenceAnalysisStatus.NOT_ANALYZED,
                        null));
                challengeRepository.save(new Challenge(
                        "리듬 비트",
                        "빠른 스텝 전환과 강한 정지 동작 타이밍을 맞추는 퍼포먼스 챌린지입니다.",
                        "퍼포먼스",
                        "어려움",
                        "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=80",
                        null,
                        25,
                        true,
                        ReferenceAnalysisStatus.NOT_ANALYZED,
                        null));
            }

            List<Challenge> challenges = challengeRepository.findAllByIsActiveTrueOrderByCreatedAtDesc();
            if (challenges.isEmpty()) {
                return;
            }

            boolean hasReadyChallenge = challenges.stream()
                    .anyMatch(challenge -> challengeMotionProfileRepository.findByChallengeId(challenge.getId()).isPresent()
                            && challenge.getReferenceAnalysisStatus() == ReferenceAnalysisStatus.COMPLETED);
            if (hasReadyChallenge) {
                return;
            }

            Challenge readyChallenge = challenges.get(0);
            LocalDateTime analyzedAt = LocalDateTime.now().minusMinutes(5);
            readyChallenge.markReferenceAnalysisCompleted(analyzedAt);
            challengeRepository.save(readyChallenge);
            challengeMotionProfileRepository.save(new ChallengeMotionProfile(
                    readyChallenge,
                    "{\"seed\":\"dev-ready-profile\",\"version\":\"v1\"}",
                    4201,
                    64,
                    readyChallenge.getDurationSec() * 1000L,
                    "seed-ready-profile",
                    analyzedAt));
        };
    }
}