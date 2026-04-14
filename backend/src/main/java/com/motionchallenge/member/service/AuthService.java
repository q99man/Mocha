package com.motionchallenge.member.service;

import com.motionchallenge.member.dto.AuthLoginRequest;
import com.motionchallenge.member.dto.AuthRegisterRequest;
import com.motionchallenge.member.dto.MemberSessionResponse;
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.entity.MemberRole;
import com.motionchallenge.member.repository.MemberRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();
    private final SecurityContextHolderStrategy securityContextHolderStrategy =
            SecurityContextHolder.getContextHolderStrategy();

    public AuthService(
            MemberRepository memberRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager) {
        this.memberRepository = memberRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
    }

    @Transactional
    public MemberSessionResponse register(
            AuthRegisterRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        String normalizedDisplayName = normalizeDisplayName(request.getDisplayName());
        if (memberRepository.existsByEmail(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 가입된 이메일입니다.");
        }

        MemberRole role = memberRepository.existsByRole(MemberRole.ADMIN) ? MemberRole.USER : MemberRole.ADMIN;
        Member member = memberRepository.saveAndFlush(new Member(
                normalizedEmail,
                passwordEncoder.encode(request.getPassword()),
                normalizedDisplayName,
                role));

        persistAuthenticatedSession(member, httpRequest, httpResponse);
        return MemberSessionResponse.from(member);
    }

    public MemberSessionResponse login(
            AuthLoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        Authentication authentication =
                authenticateAndPersist(normalizedEmail, request.getPassword(), httpRequest, httpResponse);
        return toSessionResponse(authentication);
    }

    public void logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        SecurityContextHolder.clearContext();
        securityContextRepository.saveContext(new SecurityContextImpl(), httpRequest, httpResponse);
        if (httpRequest.getSession(false) != null) {
            httpRequest.getSession(false).invalidate();
        }
    }

    public Optional<MemberSessionResponse> getCurrentSession(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof MemberPrincipal memberPrincipal)) {
            return Optional.empty();
        }
        return Optional.of(new MemberSessionResponse(
                memberPrincipal.getId(),
                memberPrincipal.getUsername(),
                memberPrincipal.getDisplayName(),
                memberPrincipal.getRole().name(),
                true));
    }

    private Authentication authenticateAndPersist(
            String email,
            String rawPassword,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, rawPassword));
        SecurityContext context = new SecurityContextImpl(authentication);
        securityContextHolderStrategy.setContext(context);
        securityContextRepository.saveContext(context, httpRequest, httpResponse);
        httpRequest.getSession(true);
        return authentication;
    }

    private void persistAuthenticatedSession(
            Member member,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        MemberPrincipal principal = new MemberPrincipal(member);
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                principal,
                null,
                principal.getAuthorities());
        SecurityContext context = new SecurityContextImpl(authentication);
        securityContextHolderStrategy.setContext(context);
        securityContextRepository.saveContext(context, httpRequest, httpResponse);
        httpRequest.getSession(true);
    }

    private MemberSessionResponse toSessionResponse(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof MemberPrincipal memberPrincipal)) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "로그인 사용자 정보를 확인할 수 없습니다.");
        }
        return new MemberSessionResponse(
                memberPrincipal.getId(),
                memberPrincipal.getUsername(),
                memberPrincipal.getDisplayName(),
                memberPrincipal.getRole().name(),
                true);
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeDisplayName(String displayName) {
        if (displayName == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "?쒖떆 ?대쫫???꾩슂?⑸땲??");
        }
        String normalized = displayName.trim();
        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "?쒖떆 ?대쫫???꾩슂?⑸땲??");
        }
        return normalized;
    }
}
