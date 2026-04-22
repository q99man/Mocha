package com.motionchallenge.member.repository;

import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.entity.MemberAuthProvider;
import com.motionchallenge.member.entity.MemberRole;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemberRepository extends JpaRepository<Member, Long> {

    Optional<Member> findByEmail(String email);

    Optional<Member> findByAuthProviderAndProviderUserId(MemberAuthProvider authProvider, String providerUserId);

    boolean existsByEmail(String email);

    boolean existsByRole(MemberRole role);

    long countByRole(MemberRole role);

    List<Member> findTop6ByOrderByCreatedAtDesc();

    @Query(
            value = """
                    select member
                    from Member member
                    where (:role is null or member.role = :role)
                      and (:authProvider is null or member.authProvider = :authProvider)
                      and (
                          :keyword is null
                          or lower(member.email) like lower(concat('%', :keyword, '%'))
                          or lower(member.displayName) like lower(concat('%', :keyword, '%'))
                      )
                    """,
            countQuery = """
                    select count(member)
                    from Member member
                    where (:role is null or member.role = :role)
                      and (:authProvider is null or member.authProvider = :authProvider)
                      and (
                          :keyword is null
                          or lower(member.email) like lower(concat('%', :keyword, '%'))
                          or lower(member.displayName) like lower(concat('%', :keyword, '%'))
                      )
                    """)
    Page<Member> search(
            @Param("role") MemberRole role,
            @Param("authProvider") MemberAuthProvider authProvider,
            @Param("keyword") String keyword,
            Pageable pageable);
}
