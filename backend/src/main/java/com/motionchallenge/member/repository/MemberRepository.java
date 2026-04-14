package com.motionchallenge.member.repository;

import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.entity.MemberRole;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRepository extends JpaRepository<Member, Long> {

    Optional<Member> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByRole(MemberRole role);
}
