package com.motionchallenge.global.config;

import com.motionchallenge.member.oauth.OAuth2AuthenticationFailureHandler;
import com.motionchallenge.member.oauth.OAuth2AuthenticationSuccessHandler;
import com.motionchallenge.member.oauth.OAuth2RedirectAuthorizationRequestRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(AuthProperties.class)
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ObjectProvider<ClientRegistrationRepository> clientRegistrationRepositoryProvider,
            ObjectProvider<OAuth2RedirectAuthorizationRequestRepository> authorizationRequestRepositoryProvider,
            ObjectProvider<OAuth2AuthenticationSuccessHandler> successHandlerProvider,
            ObjectProvider<OAuth2AuthenticationFailureHandler> failureHandlerProvider) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/api/auth/**", "/uploads/**", "/actuator/health").permitAll()
                        .requestMatchers("/api/attempts/**").authenticated()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().permitAll());

        if (clientRegistrationRepositoryProvider.getIfAvailable() != null) {
            http.oauth2Login(oauth2 -> oauth2
                    .authorizationEndpoint(authorization -> authorization
                            .authorizationRequestRepository(authorizationRequestRepositoryProvider.getObject()))
                    .successHandler(successHandlerProvider.getObject())
                    .failureHandler(failureHandlerProvider.getObject()));
        }

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
