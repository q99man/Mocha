package com.motionchallenge.member.service;

import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.entity.MemberRole;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class MemberPrincipal implements UserDetails {

    private final Long id;
    private final String email;
    private final String passwordHash;
    private final String displayName;
    private final MemberRole role;

    public MemberPrincipal(Member member) {
        this.id = member.getId();
        this.email = member.getEmail();
        this.passwordHash = member.getPasswordHash();
        this.displayName = member.getDisplayName();
        this.role = member.getRole();
    }

    public Long getId() {
        return id;
    }

    public String getDisplayName() {
        return displayName;
    }

    public MemberRole getRole() {
        return role;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }
}
