package com.motionchallenge.board.repository;

import com.motionchallenge.board.entity.BoardCategory;
import com.motionchallenge.board.entity.BoardPost;
import com.motionchallenge.board.entity.BoardPostSourceType;
import java.util.Optional;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoardPostRepository extends JpaRepository<BoardPost, Long> {

    @Query(
            value = """
                    select post
                    from BoardPost post
                    where (:category is null or post.category = :category)
                      and (:sourceType is null or post.sourceType = :sourceType)
                      and (:challengeId is null or post.challengeId = :challengeId)
                      and (
                          :keyword is null
                          or lower(post.title) like lower(concat('%', :keyword, '%'))
                          or lower(post.content) like lower(concat('%', :keyword, '%'))
                          or lower(coalesce(post.challengeTitle, '')) like lower(concat('%', :keyword, '%'))
                      )
                    order by post.pinned desc, post.createdAt desc, post.id desc
                    """,
            countQuery = """
                    select count(post)
                    from BoardPost post
                    where (:category is null or post.category = :category)
                      and (:sourceType is null or post.sourceType = :sourceType)
                      and (:challengeId is null or post.challengeId = :challengeId)
                      and (
                          :keyword is null
                          or lower(post.title) like lower(concat('%', :keyword, '%'))
                          or lower(post.content) like lower(concat('%', :keyword, '%'))
                          or lower(coalesce(post.challengeTitle, '')) like lower(concat('%', :keyword, '%'))
                      )
                    """)
    Page<BoardPost> search(
            @Param("category") BoardCategory category,
            @Param("sourceType") BoardPostSourceType sourceType,
            @Param("challengeId") Long challengeId,
            @Param("keyword") String keyword,
            Pageable pageable);

    @Query(
            value = """
                    select post
                    from BoardPost post
                    where post.member.id = :memberId
                      and (:sourceType is null or post.sourceType = :sourceType)
                    order by post.createdAt desc, post.id desc
                    """,
            countQuery = """
                    select count(post)
                    from BoardPost post
                    where post.member.id = :memberId
                      and (:sourceType is null or post.sourceType = :sourceType)
                    """)
    Page<BoardPost> findAllByMemberId(
            @Param("memberId") Long memberId,
            @Param("sourceType") BoardPostSourceType sourceType,
            Pageable pageable);

    @Query("""
            select post
            from BoardPost post
            join fetch post.member
            where post.id = :postId
            """)
    Optional<BoardPost> findByIdWithMember(@Param("postId") Long postId);

    Optional<BoardPost> findByReviewId(Long reviewId);

    List<BoardPost> findAllByReviewIdIn(List<Long> reviewIds);

    long countBySourceType(BoardPostSourceType sourceType);

    @Query("""
            select post.challengeId, post.challengeTitle, count(post), avg(post.reviewRating)
            from BoardPost post
            where post.sourceType = :sourceType
              and post.challengeId is not null
              and post.challengeTitle is not null
              and post.reviewRating is not null
            group by post.challengeId, post.challengeTitle
            order by count(post) desc, avg(post.reviewRating) desc, post.challengeTitle asc
            """)
    List<Object[]> findTopChallengeReviewSummaries(
            @Param("sourceType") BoardPostSourceType sourceType,
            Pageable pageable);
}
