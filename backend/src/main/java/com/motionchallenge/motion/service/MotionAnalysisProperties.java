package com.motionchallenge.motion.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.motion.analysis")
public class MotionAnalysisProperties {

    private String provider = "mock";
    private String schemaVersion = "v1";
    private final Mediapipe mediapipe = new Mediapipe();

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getSchemaVersion() {
        return schemaVersion;
    }

    public void setSchemaVersion(String schemaVersion) {
        this.schemaVersion = schemaVersion;
    }

    public Mediapipe getMediapipe() {
        return mediapipe;
    }

    public static class Mediapipe {
        private boolean stubEnabled;
        private String endpoint = "http://localhost:8000";
        private long timeoutMillis = 5000L;

        public boolean isStubEnabled() {
            return stubEnabled;
        }

        public void setStubEnabled(boolean stubEnabled) {
            this.stubEnabled = stubEnabled;
        }

        public String getEndpoint() {
            return endpoint;
        }

        public void setEndpoint(String endpoint) {
            this.endpoint = endpoint;
        }

        public long getTimeoutMillis() {
            return timeoutMillis;
        }

        public void setTimeoutMillis(long timeoutMillis) {
            this.timeoutMillis = timeoutMillis;
        }
    }
}
