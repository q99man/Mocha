package com.motionchallenge.member.oauth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

@Component
public class OAuth2RedirectAuthorizationRequestRepository
        implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    private static final String REDIRECT_PATH_ATTRIBUTE =
            OAuth2RedirectAuthorizationRequestRepository.class.getName() + ".REDIRECT_PATH";

    private final HttpSessionOAuth2AuthorizationRequestRepository delegate =
            new HttpSessionOAuth2AuthorizationRequestRepository();

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        return delegate.loadAuthorizationRequest(request);
    }

    @Override
    public void saveAuthorizationRequest(
            OAuth2AuthorizationRequest authorizationRequest,
            HttpServletRequest request,
            HttpServletResponse response) {
        delegate.saveAuthorizationRequest(authorizationRequest, request, response);

        HttpSession session = request.getSession(authorizationRequest != null);
        if (authorizationRequest == null) {
            removeRedirectPath(session);
            return;
        }

        String redirect = sanitizeRedirectPath(request.getParameter("redirect"));
        if (redirect != null && session != null) {
            session.setAttribute(REDIRECT_PATH_ATTRIBUTE, redirect);
        }
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(
            HttpServletRequest request,
            HttpServletResponse response) {
        return delegate.removeAuthorizationRequest(request, response);
    }

    public String consumeRedirectPath(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        Object value = session.getAttribute(REDIRECT_PATH_ATTRIBUTE);
        removeRedirectPath(session);
        return value instanceof String text ? text : null;
    }

    private void removeRedirectPath(HttpSession session) {
        if (session != null) {
            session.removeAttribute(REDIRECT_PATH_ATTRIBUTE);
        }
    }

    private String sanitizeRedirectPath(String redirectPath) {
        if (redirectPath == null) {
            return null;
        }

        String normalized = redirectPath.trim();
        if (normalized.isEmpty()) {
            return null;
        }

        if (!normalized.startsWith("/") || normalized.startsWith("//") || normalized.startsWith("/\\")) {
            return null;
        }

        return normalized;
    }
}
