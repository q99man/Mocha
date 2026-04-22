package com.motionchallenge.global.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth")
public class AuthProperties {

    private String frontendBaseUrl = "http://localhost:5173";
    private String defaultUserRedirectPath = "/mypage";
    private String defaultAdminRedirectPath = "/admin";
    private String failureRedirectPath = "/auth?error=social";
    private final OAuth2 oauth2 = new OAuth2();

    public String getFrontendBaseUrl() {
        return frontendBaseUrl;
    }

    public void setFrontendBaseUrl(String frontendBaseUrl) {
        this.frontendBaseUrl = frontendBaseUrl;
    }

    public String getDefaultUserRedirectPath() {
        return defaultUserRedirectPath;
    }

    public void setDefaultUserRedirectPath(String defaultUserRedirectPath) {
        this.defaultUserRedirectPath = defaultUserRedirectPath;
    }

    public String getDefaultAdminRedirectPath() {
        return defaultAdminRedirectPath;
    }

    public void setDefaultAdminRedirectPath(String defaultAdminRedirectPath) {
        this.defaultAdminRedirectPath = defaultAdminRedirectPath;
    }

    public String getFailureRedirectPath() {
        return failureRedirectPath;
    }

    public void setFailureRedirectPath(String failureRedirectPath) {
        this.failureRedirectPath = failureRedirectPath;
    }

    public OAuth2 getOauth2() {
        return oauth2;
    }

    public static class OAuth2 {
        private boolean enabled = false;
        private final Provider google = new Provider();
        private final Provider kakao = new Provider();
        private final Provider naver = new Provider();

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public Provider getGoogle() {
            return google;
        }

        public Provider getKakao() {
            return kakao;
        }

        public Provider getNaver() {
            return naver;
        }
    }

    public static class Provider {
        private String clientId;
        private String clientSecret;

        public String getClientId() {
            return clientId;
        }

        public void setClientId(String clientId) {
            this.clientId = clientId;
        }

        public String getClientSecret() {
            return clientSecret;
        }

        public void setClientSecret(String clientSecret) {
            this.clientSecret = clientSecret;
        }
    }
}
