package com.motionchallenge.challenge.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.motionchallenge.challenge.dto.ChallengeResponse;
import java.time.Duration;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class ChallengeCacheService {

    private static final Logger log = LoggerFactory.getLogger(ChallengeCacheService.class);
    private static final String POPULAR_CHALLENGES_CACHE_KEY = "challenge:popular:v1";

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private final Duration cacheTtl;

    public ChallengeCacheService(
            RedisTemplate<String, String> redisTemplate,
            ObjectMapper objectMapper,
            @Value("${app.cache.popular-challenges-ttl-seconds:300}") long cacheTtlSeconds) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.cacheTtl = Duration.ofSeconds(cacheTtlSeconds);
    }

    public List<ChallengeResponse> getPopularChallenges(List<ChallengeResponse> fallback) {
        try {
            String cached = redisTemplate.opsForValue().get(POPULAR_CHALLENGES_CACHE_KEY);
            if (cached != null && !cached.isBlank()) {
                return objectMapper.readValue(cached, new TypeReference<>() {});
            }
        } catch (Exception exception) {
            log.warn("Redis cache read failed for popular challenges, falling back to repository data.", exception);
        }

        try {
            redisTemplate.opsForValue().set(
                    POPULAR_CHALLENGES_CACHE_KEY,
                    objectMapper.writeValueAsString(fallback),
                    cacheTtl);
        } catch (JsonProcessingException exception) {
            log.warn("Could not serialize popular challenge cache payload.", exception);
        } catch (Exception exception) {
            log.warn("Redis cache write failed for popular challenges.", exception);
        }

        return fallback;
    }
}
