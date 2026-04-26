package com.motionchallenge.member.controller;

import com.motionchallenge.member.dto.AccountPasswordChangeRequest;
import com.motionchallenge.member.dto.AccountProfileUpdateRequest;
import com.motionchallenge.member.dto.AccountWithdrawalRequest;
import com.motionchallenge.member.dto.AuthLoginRequest;
import com.motionchallenge.member.dto.AuthRegisterRequest;
import com.motionchallenge.member.dto.MemberSessionResponse;
import com.motionchallenge.member.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public MemberSessionResponse register(
            @Valid @RequestBody AuthRegisterRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        return authService.register(request, httpRequest, httpResponse);
    }

    @PostMapping("/login")
    public MemberSessionResponse login(
            @Valid @RequestBody AuthLoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        return authService.login(request, httpRequest, httpResponse);
    }

    @PostMapping("/logout")
    public Map<String, Boolean> logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        authService.logout(httpRequest, httpResponse);
        return Map.of("success", true);
    }

    @GetMapping("/me")
    public ResponseEntity<MemberSessionResponse> me(Authentication authentication) {
        return authService.getCurrentSession(authentication)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    @PatchMapping("/me")
    public MemberSessionResponse updateProfile(
            @Valid @RequestBody AccountProfileUpdateRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        return authService.updateAccountProfile(request, httpRequest, httpResponse);
    }

    @PatchMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody AccountPasswordChangeRequest request) {
        authService.changeAccountPassword(request);
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(
            @RequestBody AccountWithdrawalRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        authService.withdrawAccount(request, httpRequest, httpResponse);
    }
}
