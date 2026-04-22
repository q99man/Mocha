package com.motionchallenge.member.oauth;

import com.motionchallenge.member.entity.MemberAuthProvider;
import java.util.Map;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.util.StringUtils;

public record OAuth2MemberProfile(
        MemberAuthProvider authProvider,
        String providerUserId,
        String email,
        String displayName) {

    public static OAuth2MemberProfile from(String registrationId, Map<String, Object> attributes) {
        MemberAuthProvider provider = resolveProvider(registrationId);
        return switch (provider) {
            case GOOGLE -> fromGoogle(attributes);
            case KAKAO -> fromKakao(attributes);
            case NAVER -> fromNaver(attributes);
            case LOCAL -> throw invalid("Unsupported OAuth2 provider.");
        };
    }

    private static OAuth2MemberProfile fromGoogle(Map<String, Object> attributes) {
        return new OAuth2MemberProfile(
                MemberAuthProvider.GOOGLE,
                requiredString(attributes, "sub"),
                optionalString(attributes, "email"),
                firstPresent(optionalString(attributes, "name"), optionalString(attributes, "email"), "Google User"));
    }

    @SuppressWarnings("unchecked")
    private static OAuth2MemberProfile fromKakao(Map<String, Object> attributes) {
        Map<String, Object> account = (Map<String, Object>) attributes.get("kakao_account");
        Map<String, Object> profile = account == null ? null : (Map<String, Object>) account.get("profile");
        return new OAuth2MemberProfile(
                MemberAuthProvider.KAKAO,
                requiredString(attributes, "id"),
                optionalString(account, "email"),
                firstPresent(optionalString(profile, "nickname"), optionalString(account, "email"), "Kakao User"));
    }

    @SuppressWarnings("unchecked")
    private static OAuth2MemberProfile fromNaver(Map<String, Object> attributes) {
        Map<String, Object> response = (Map<String, Object>) attributes.get("response");
        if (response == null) {
            throw invalid("Naver response payload is missing.");
        }
        return new OAuth2MemberProfile(
                MemberAuthProvider.NAVER,
                requiredString(response, "id"),
                optionalString(response, "email"),
                firstPresent(optionalString(response, "name"), optionalString(response, "nickname"), optionalString(response, "email"), "Naver User"));
    }

    private static MemberAuthProvider resolveProvider(String registrationId) {
        if (!StringUtils.hasText(registrationId)) {
            throw invalid("OAuth2 registration id is missing.");
        }
        return switch (registrationId.trim().toLowerCase()) {
            case "google" -> MemberAuthProvider.GOOGLE;
            case "kakao" -> MemberAuthProvider.KAKAO;
            case "naver" -> MemberAuthProvider.NAVER;
            default -> throw invalid("Unsupported OAuth2 provider.");
        };
    }

    private static String requiredString(Map<String, Object> source, String key) {
        String value = optionalString(source, key);
        if (!StringUtils.hasText(value)) {
            throw invalid("Required OAuth2 attribute is missing: " + key);
        }
        return value;
    }

    private static String optionalString(Map<String, Object> source, String key) {
        if (source == null) {
            return null;
        }
        Object value = source.get(key);
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static String firstPresent(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private static OAuth2AuthenticationException invalid(String message) {
        return new OAuth2AuthenticationException(new OAuth2Error("invalid_oauth2_profile", message, null), message);
    }
}
