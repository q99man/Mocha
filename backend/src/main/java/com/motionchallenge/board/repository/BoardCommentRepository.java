package com.motionchallenge.board.repository;

import com.motionchallenge.board.entity.BoardComment;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoardCommentRepository extends JpaRepository<BoardComment, Long> {

    @Query("""
            select comment
            from BoardComment comment
            join fetch comment.member
            where comment.post.id = :postId
            order by comment.createdAt asc, comment.id asc
            """)
    List<BoardComment> findAllByPostIdWithMemberOrderByCreatedAtAsc(@Param("postId") Long postId);

    @Query("""
            select comment
            from BoardComment comment
            join fetch comment.member
            join fetch comment.post
            where comment.id = :commentId
            """)
    Optional<BoardComment> findByIdWithMemberAndPost(@Param("commentId") Long commentId);

    @Query("""
            select comment.post.id, count(comment)
            from BoardComment comment
            where comment.post.id in :postIds
            group by comment.post.id
            """)
    List<Object[]> countByPostIds(@Param("postIds") List<Long> postIds);

    long countByPostId(Long postId);

    boolean existsByMemberId(Long memberId);

    @Modifying
    @Query("delete from BoardComment comment where comment.post.id = :postId")
    void deleteByPostId(@Param("postId") Long postId);
}
