package com.motionchallenge.member.dto;

public enum OAuth2LoginStatus {
    LOGIN("login"),
    LINKED("linked"),
    REGISTERED("signup");

    private final String queryValue;

    OAuth2LoginStatus(String queryValue) {
        this.queryValue = queryValue;
    }

    public String getQueryValue() {
        return queryValue;
    }
}
