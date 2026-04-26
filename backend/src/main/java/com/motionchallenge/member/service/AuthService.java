package com.motionchallenge.member.service;

import com.motionchallenge.member.dto.AuthLoginRequest;
import com.motionchallenge.member.dto.AuthRegisterRequest;
import com.motionchallenge.member.dto.AccountPasswordChangeRequest;
import com.motionchallenge.member.dto.AccountProfileUpdateRequest;
import com.motionchallenge.member.dto.AccountWithdrawalRequest;
import com.motionchallenge.member.dto.MemberSessionResponse;
import com.motionchallenge.member.dto.OAuth2LoginResult;
import com.motionchallenge.member.dto.OAuth2LoginStatus;
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.entity.MemberAuthProvider;
import com.motionchallenge.member.entity.MemberRole;
import com.motionchallenge.member.oauth.OAuth2MemberProfile;
import com.motionchallenge.member.repository.MemberRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Locale;
import java.util.Map;
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
    private final CurrentMemberService currentMemberService;
    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();
    private final SecurityContextHolderStrategy securityContextHolderStrategy =
            SecurityContextHolder.getContextHolderStrategy();

    public AuthService(
            MemberRepository memberRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            CurrentMemberService currentMemberService) {
        this.memberRepository = memberRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.currentMemberService = currentMemberService;
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
        Member member = memberRepository.saveAndFlush(Member.local(
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

    @Transactional
    public OAuth2LoginResult loginWithOAuth2(
            String registrationId,
            Map<String, Object> attributes,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        OAuth2MemberProfile profile = OAuth2MemberProfile.from(registrationId, attributes);
        OAuth2UpsertResult result = upsertOAuth2Member(profile);
        persistAuthenticatedSession(result.member(), httpRequest, httpResponse);
        return new OAuth2LoginResult(MemberSessionResponse.from(result.member()), result.status());
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
                memberPrincipal.getAuthProvider().name(),
                memberPrincipal.getRole().name(),
                true));
    }

    @Transactional
    public MemberSessionResponse updateAccountProfile(
            AccountProfileUpdateRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        Member member = currentMemberService.requireCurrentMember();
        String normalizedDisplayName = normalizeDisplayName(request.displayName());

        member.updateProfile(member.getEmail(), normalizedDisplayName, member.getRole());
        persistAuthenticatedSession(member, httpRequest, httpResponse);
        return MemberSessionResponse.from(member);
    }

    @Transactional
    public void changeAccountPassword(AccountPasswordChangeRequest request) {
        Member member = currentMemberService.requireCurrentMember();
        if (!member.isLocalAccount()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.");
        }
        if (!passwordEncoder.matches(request.currentPassword(), member.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 일치하지 않습니다.");
        }

        member.updatePasswordHash(passwordEncoder.encode(request.newPassword().trim()));
    }

    @Transactional
    public void withdrawAccount(
            AccountWithdrawalRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        if (!request.confirmed()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "회원탈퇴 확인이 필요합니다.");
        }

        Member member = currentMemberService.requireCurrentMember();
        if (member.getRole() == MemberRole.ADMIN && memberRepository.countByRole(MemberRole.ADMIN) <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "최소 한 명의 관리자 계정은 유지되어야 합니다.");
        }
        if (member.isLocalAccount()
                && (request.currentPassword() == null
                || !passwordEncoder.matches(request.currentPassword(), member.getPasswordHash()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 일치하지 않습니다.");
        }

        member.withdraw(
                "withdrawn-" + member.getId() + "@mocha.local",
                "탈퇴회원",
                passwordEncoder.encode("WITHDRAWN_ACCOUNT_" + member.getId() + "_" + System.nanoTime()));
        logout(httpRequest, httpResponse);
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
                memberPrincipal.getAuthProvider().name(),
                memberPrincipal.getRole().name(),
                true);
    }

    private OAuth2UpsertResult upsertOAuth2Member(OAuth2MemberProfile profile) {
        return memberRepository.findByAuthProviderAndProviderUserId(profile.authProvider(), profile.providerUserId())
                .map(existing -> updateExistingSocialMember(existing, profile))
                .orElseGet(() -> memberRepository.findByEmail(resolveSocialEmail(profile))
                        .map(existing -> linkExistingMember(existing, profile))
                        .orElseGet(() -> createSocialMember(profile)));
    }

    private OAuth2UpsertResult updateExistingSocialMember(Member member, OAuth2MemberProfile profile) {
        member.updateProfile(resolveSocialEmail(profile), normalizeSocialDisplayName(profile), member.getRole());
        member.updateSocialIdentity(profile.authProvider(), profile.providerUserId());
        return new OAuth2UpsertResult(member, OAuth2LoginStatus.LOGIN);
    }

    private OAuth2UpsertResult linkExistingMember(Member member, OAuth2MemberProfile profile) {
        member.updateProfile(resolveSocialEmail(profile), normalizeSocialDisplayName(profile), member.getRole());
        member.updateSocialIdentity(profile.authProvider(), profile.providerUserId());
        return new OAuth2UpsertResult(member, OAuth2LoginStatus.LINKED);
    }

    private OAuth2UpsertResult createSocialMember(OAuth2MemberProfile profile) {
        MemberRole role = memberRepository.existsByRole(MemberRole.ADMIN) ? MemberRole.USER : MemberRole.ADMIN;
        Member member = memberRepository.save(Member.social(
                profile.authProvider(),
                profile.providerUserId(),
                resolveSocialEmail(profile),
                normalizeSocialDisplayName(profile),
                role));
        return new OAuth2UpsertResult(member, OAuth2LoginStatus.REGISTERED);
    }

    private record OAuth2UpsertResult(
            Member member,
            OAuth2LoginStatus status) {
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

    private String normalizeSocialDisplayName(OAuth2MemberProfile profile) {
        String candidate = profile.displayName() == null ? "" : profile.displayName().trim();
        if (!candidate.isBlank()) {
            return candidate.length() <= 40 ? candidate : candidate.substring(0, 40);
        }
        String email = resolveSocialEmail(profile);
        int atIndex = email.indexOf('@');
        String fallback = atIndex > 0 ? email.substring(0, atIndex) : email;
        return fallback.length() <= 40 ? fallback : fallback.substring(0, 40);
    }

    private String resolveSocialEmail(OAuth2MemberProfile profile) {
        String normalized = normalizeEmail(profile.email());
        if (normalized != null && !normalized.isBlank()) {
            return normalized;
        }
        return profile.authProvider().name().toLowerCase(Locale.ROOT) + "_" + profile.providerUserId() + "@oauth.mocha.local";
    }
}
