package com.motionchallenge.member.service;

import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.entity.MemberRole;
import com.motionchallenge.member.repository.MemberRepository;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentMemberService {

    private final MemberRepository memberRepository;

    public CurrentMemberService(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    @Transactional
    public Member requireCurrentMember() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return resolveCurrentMember(authentication)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }

    @Transactional
    public Optional<Member> getCurrentMember() {
        return resolveCurrentMember(SecurityContextHolder.getContext().getAuthentication());
    }

    private Optional<Member> resolveCurrentMember(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) {
            return Optional.empty();
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof MemberPrincipal memberPrincipal) {
            return memberRepository.findById(memberPrincipal.getId())
                    .or(() -> memberRepository.findByEmail(normalizeEmail(memberPrincipal.getUsername())));
        }

        String username = normalizeEmail(authentication.getName());
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }

        MemberRole role = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals)
                ? MemberRole.ADMIN
                : MemberRole.USER;

        return Optional.of(memberRepository.findByEmail(username)
                .orElseGet(() -> memberRepository.save(new Member(
                        username,
                        "EXTERNAL_AUTH_PRINCIPAL",
                        deriveDisplayName(username),
                        role))));
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private String deriveDisplayName(String email) {
        int atIndex = email.indexOf('@');
        return atIndex > 0 ? email.substring(0, atIndex) : email;
    }
}
