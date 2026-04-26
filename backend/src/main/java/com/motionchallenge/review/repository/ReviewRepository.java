package com.motionchallenge.review.repository;

import com.motionchallenge.review.entity.Review;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    interface ChallengeReviewStats {
        Long getChallengeId();

        long getReviewCount();

        Double getAverageRating();
    }

    @Query("""
            select review
            from Review review
            join fetch review.member
            join fetch review.challenge
            where review.challenge.id = :challengeId
            order by review.createdAt desc, review.id desc
            """)
    List<Review> findAllByChallengeIdWithMemberAndChallengeOrderByCreatedAtDesc(@Param("challengeId") Long challengeId);

    @Query("""
            select review
            from Review review
            join fetch review.member
            join fetch review.challenge
            where review.member.id = :memberId
            order by review.createdAt desc, review.id desc
            """)
    List<Review> findAllByMemberIdWithMemberAndChallengeOrderByCreatedAtDesc(@Param("memberId") Long memberId);

    @Query("""
            select review
            from Review review
            join fetch review.member
            join fetch review.challenge
            where review.challenge.id = :challengeId
              and review.member.id = :memberId
            """)
    Optional<Review> findByChallengeIdAndMemberIdWithMemberAndChallenge(
            @Param("challengeId") Long challengeId,
            @Param("memberId") Long memberId);

    @Query("""
            select review
            from Review review
            join fetch review.member
            join fetch review.challenge
            where review.id = :reviewId
            """)
    Optional<Review> findByIdWithMemberAndChallenge(@Param("reviewId") Long reviewId);

    @Query("""
            select review
            from Review review
            join fetch review.member
            join fetch review.challenge
            order by review.createdAt desc, review.id desc
            """)
    List<Review> findRecentWithMemberAndChallenge(Pageable pageable);

    @Query("""
            select review.challenge.id as challengeId,
                   count(review) as reviewCount,
                   avg(review.rating) as averageRating
            from Review review
            where review.challenge.id in :challengeIds
            group by review.challenge.id
            """)
    List<ChallengeReviewStats> findStatsByChallengeIdIn(@Param("challengeIds") java.util.Collection<Long> challengeIds);

    boolean existsByMemberId(Long memberId);

    @Modifying
    @Query("delete from Review review where review.challenge.id = :challengeId")
    void deleteByChallengeId(@Param("challengeId") Long challengeId);
}
