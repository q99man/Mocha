package com.motionchallenge;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@EnableJpaAuditing
@SpringBootApplication
public class MotionChallengeApplication {

    public static void main(String[] args) {
        SpringApplication.run(MotionChallengeApplication.class, args);
    }
}

