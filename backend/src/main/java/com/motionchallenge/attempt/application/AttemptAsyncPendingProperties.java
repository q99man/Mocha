package com.motionchallenge.attempt.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.attempt")
public class AttemptAsyncPendingProperties {

    private boolean asyncPendingAutoCompleteEnabled;
    private long asyncPendingAutoCompleteDelayMillis = 2500L;
    private long asyncPendingAutoCompleteRetryDelayMillis = 4000L;
    private int asyncPendingAutoCompleteMaxAttempts = 3;

    public boolean isAsyncPendingAutoCompleteEnabled() {
        return asyncPendingAutoCompleteEnabled;
    }

    public void setAsyncPendingAutoCompleteEnabled(boolean asyncPendingAutoCompleteEnabled) {
        this.asyncPendingAutoCompleteEnabled = asyncPendingAutoCompleteEnabled;
    }

    public long getAsyncPendingAutoCompleteDelayMillis() {
        return asyncPendingAutoCompleteDelayMillis;
    }

    public void setAsyncPendingAutoCompleteDelayMillis(long asyncPendingAutoCompleteDelayMillis) {
        this.asyncPendingAutoCompleteDelayMillis = asyncPendingAutoCompleteDelayMillis;
    }

    public long getAsyncPendingAutoCompleteRetryDelayMillis() {
        return asyncPendingAutoCompleteRetryDelayMillis;
    }

    public void setAsyncPendingAutoCompleteRetryDelayMillis(long asyncPendingAutoCompleteRetryDelayMillis) {
        this.asyncPendingAutoCompleteRetryDelayMillis = asyncPendingAutoCompleteRetryDelayMillis;
    }

    public int getAsyncPendingAutoCompleteMaxAttempts() {
        return asyncPendingAutoCompleteMaxAttempts;
    }

    public void setAsyncPendingAutoCompleteMaxAttempts(int asyncPendingAutoCompleteMaxAttempts) {
        this.asyncPendingAutoCompleteMaxAttempts = asyncPendingAutoCompleteMaxAttempts;
    }
}
