package com.motionchallenge.member.oauth;

import com.motionchallenge.global.config.AuthProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.servlet.view.RedirectView;
import org.springframework.web.util.UriComponentsBuilder;

@Controller
@ConditionalOnMissingBean(ClientRegistrationRepository.class)
public class OAuth2FallbackController {

    private final AuthProperties authProperties;

    public OAuth2FallbackController(AuthProperties authProperties) {
        this.authProperties = authProperties;
    }

    @GetMapping("/oauth2/authorization/{registrationId}")
    public RedirectView redirectDisabledProvider(
            @PathVariable String registrationId,
            HttpServletRequest request) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(
                authProperties.getNormalizedFrontendBaseUrl()
                        + normalizePath(authProperties.getFailureRedirectPath()));
        builder.replaceQueryParam("mode", "login");
        builder.replaceQueryParam("social", "failure");
        builder.replaceQueryParam("provider", registrationId);
        builder.replaceQueryParam("reason", "disabled");

        String redirectPath = sanitizeRedirectPath(request.getParameter("redirect"));
        if (redirectPath != null) {
            builder.replaceQueryParam("redirect", redirectPath);
        }

        return new RedirectView(builder.encode().build().toUriString());
    }

    private String sanitizeRedirectPath(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String normalized = value.trim();
        if (!normalized.startsWith("/") || normalized.startsWith("//") || normalized.startsWith("/\\")) {
            return null;
        }
        return normalized;
    }

    private String normalizePath(String value) {
        if (value == null || value.isBlank()) {
            return "/auth?error=social";
        }
        return value.startsWith("/") ? value : "/" + value;
    }

}
