package com.motionchallenge.member.oauth;

import com.motionchallenge.global.config.AuthProperties;
import com.motionchallenge.member.dto.MemberSessionResponse;
import com.motionchallenge.member.dto.OAuth2LoginResult;
import com.motionchallenge.member.service.AuthService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class OAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private final AuthService authService;
    private final AuthProperties authProperties;
    private final OAuth2RedirectAuthorizationRequestRepository authorizationRequestRepository;

    public OAuth2AuthenticationSuccessHandler(
            AuthService authService,
            AuthProperties authProperties,
            OAuth2RedirectAuthorizationRequestRepository authorizationRequestRepository) {
        this.authService = authService;
        this.authProperties = authProperties;
        this.authorizationRequestRepository = authorizationRequestRepository;
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException, ServletException {
        if (!(authentication instanceof OAuth2AuthenticationToken oauth2AuthenticationToken)) {
            response.sendRedirect(buildFrontendRedirectPath(resolveDefaultPath("USER"), "local", "login"));
            return;
        }

        OAuth2User oauth2User = oauth2AuthenticationToken.getPrincipal();
        OAuth2LoginResult result = authService.loginWithOAuth2(
                oauth2AuthenticationToken.getAuthorizedClientRegistrationId(),
                oauth2User.getAttributes(),
                request,
                response);
        MemberSessionResponse session = result.session();

        String requestedPath = authorizationRequestRepository.consumeRedirectPath(request);
        String targetPath = resolveTargetPath(requestedPath, session.role());
        response.sendRedirect(buildFrontendRedirectPath(targetPath, session.authProvider(), result.status().getQueryValue()));
    }

    private String resolveTargetPath(String requestedPath, String role) {
        if (requestedPath == null || requestedPath.isBlank()) {
            return resolveDefaultPath(role);
        }
        if (requestedPath.startsWith("/admin") && !"ADMIN".equals(role)) {
            return authProperties.getDefaultUserRedirectPath();
        }
        return requestedPath;
    }

    private String resolveDefaultPath(String role) {
        return "ADMIN".equals(role)
                ? authProperties.getDefaultAdminRedirectPath()
                : authProperties.getDefaultUserRedirectPath();
    }

    private String buildFrontendRedirectPath(String path, String authProvider, String socialStatus) {
        String baseUrl = authProperties.getNormalizedFrontendBaseUrl();
        String normalizedPath = path.startsWith("/") ? path : "/" + path;
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(baseUrl + normalizedPath);
        if (normalizedPath.startsWith("/auth")) {
            builder.replaceQueryParam("mode", "login");
        } else {
            builder.replaceQueryParam("auth", "login");
        }
        builder.replaceQueryParam("redirect", normalizedPath);
        builder.replaceQueryParam("social", socialStatus);
        builder.replaceQueryParam("provider", authProvider.toLowerCase(Locale.ROOT));
        return builder.encode().build().toUriString();
    }
}
