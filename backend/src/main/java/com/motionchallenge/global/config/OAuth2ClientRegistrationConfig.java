package com.motionchallenge.global.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.util.StringUtils;

@Configuration
@ConditionalOnProperty(prefix = "app.auth.oauth2", name = "enabled", havingValue = "true")
public class OAuth2ClientRegistrationConfig {

    @Bean
    public ClientRegistrationRepository clientRegistrationRepository(AuthProperties authProperties) {
        List<ClientRegistration> registrations = new ArrayList<>();

        if (StringUtils.hasText(authProperties.getOauth2().getGoogle().getClientId())) {
            registrations.add(CommonOAuth2Provider.GOOGLE.getBuilder("google")
                    .clientId(authProperties.getOauth2().getGoogle().getClientId())
                    .clientSecret(authProperties.getOauth2().getGoogle().getClientSecret())
                    .scope("openid", "profile", "email")
                    .build());
        }

        if (StringUtils.hasText(authProperties.getOauth2().getKakao().getClientId())) {
            registrations.add(ClientRegistration.withRegistrationId("kakao")
                    .clientName("Kakao")
                    .clientId(authProperties.getOauth2().getKakao().getClientId())
                    .clientSecret(authProperties.getOauth2().getKakao().getClientSecret())
                    .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                    .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                    .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                    .scope("profile_nickname", "account_email")
                    .authorizationUri("https://kauth.kakao.com/oauth/authorize")
                    .tokenUri("https://kauth.kakao.com/oauth/token")
                    .userInfoUri("https://kapi.kakao.com/v2/user/me")
                    .userNameAttributeName("id")
                    .build());
        }

        if (StringUtils.hasText(authProperties.getOauth2().getNaver().getClientId())) {
            registrations.add(ClientRegistration.withRegistrationId("naver")
                    .clientName("Naver")
                    .clientId(authProperties.getOauth2().getNaver().getClientId())
                    .clientSecret(authProperties.getOauth2().getNaver().getClientSecret())
                    .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                    .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                    .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                    .scope("name", "email")
                    .authorizationUri("https://nid.naver.com/oauth2.0/authorize")
                    .tokenUri("https://nid.naver.com/oauth2.0/token")
                    .userInfoUri("https://openapi.naver.com/v1/nid/me")
                    .userNameAttributeName("response")
                    .build());
        }

        if (registrations.isEmpty()) {
            throw new IllegalStateException("OAuth2 is enabled but no provider client configuration was supplied.");
        }

        return new InMemoryClientRegistrationRepository(registrations);
    }
}
