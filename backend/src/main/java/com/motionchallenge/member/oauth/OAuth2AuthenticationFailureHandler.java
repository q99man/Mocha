package com.motionchallenge.member.oauth;

import com.motionchallenge.global.config.AuthProperties;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class OAuth2AuthenticationFailureHandler implements AuthenticationFailureHandler {

    private final AuthProperties authProperties;
    private final OAuth2RedirectAuthorizationRequestRepository authorizationRequestRepository;

    public OAuth2AuthenticationFailureHandler(
            AuthProperties authProperties,
            OAuth2RedirectAuthorizationRequestRepository authorizationRequestRepository) {
        this.authProperties = authProperties;
        this.authorizationRequestRepository = authorizationRequestRepository;
    }

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception) throws IOException, ServletException {
        String requestedPath = authorizationRequestRepository.consumeRedirectPath(request);
        response.sendRedirect(buildFailureRedirectPath(
                authProperties.getFailureRedirectPath(),
                requestedPath,
                resolveProvider(request),
                resolveReason(exception)));
    }

    private String buildFailureRedirectPath(String failurePath, String requestedPath, String provider, String reason) {
        String baseUrl = authProperties.getNormalizedFrontendBaseUrl();
        String normalizedPath = failurePath.startsWith("/") ? failurePath : "/" + failurePath;
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(baseUrl + normalizedPath);
        if (normalizedPath.startsWith("/auth")) {
            builder.replaceQueryParam("mode", "login");
        } else {
            builder.replaceQueryParam("auth", "login");
        }
        builder.replaceQueryParam("social", "failure");
        if (requestedPath != null && !requestedPath.isBlank()) {
            builder.replaceQueryParam("redirect", requestedPath);
        }
        if (provider != null && !provider.isBlank()) {
            builder.replaceQueryParam("provider", provider);
        }
        if (reason != null && !reason.isBlank()) {
            builder.replaceQueryParam("reason", reason);
        }
        return builder.encode().build().toUriString();
    }

    private String resolveProvider(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null || uri.isBlank()) {
            return null;
        }
        int lastSlashIndex = uri.lastIndexOf('/');
        if (lastSlashIndex < 0 || lastSlashIndex >= uri.length() - 1) {
            return null;
        }
        return uri.substring(lastSlashIndex + 1).toLowerCase(Locale.ROOT);
    }

    private String resolveReason(AuthenticationException exception) {
        String message = exception.getMessage();
        if (message != null && message.toLowerCase(Locale.ROOT).contains("access_denied")) {
            return "cancelled";
        }
        return "failed";
    }
}
