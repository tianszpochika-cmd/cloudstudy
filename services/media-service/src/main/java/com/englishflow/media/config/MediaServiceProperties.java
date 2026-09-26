package com.englishflow.media.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "media")
public class MediaServiceProperties {

    private String serviceName = "media-service";
    private String owner = "media-service";
    private String schema = "media_service";
    private String redisNamespace = "media";
    private String signedUrlBaseUrl = "https://media.example.invalid/objects";
    private Duration signedUrlTtl = Duration.ofMinutes(5);
    private Duration maxSignedUrlTtl = Duration.ofMinutes(15);
    private boolean objectStoreEnabled;
    private String objectStoreEndpoint = "";
    private String objectStorePublicEndpoint = "";
    private String objectStoreBucket = "";
    private String objectStoreAccessKey = "";
    private String objectStoreSecretKey = "";
    private String objectStoreRegion = "us-east-1";

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public String getSchema() {
        return schema;
    }

    public void setSchema(String schema) {
        this.schema = schema;
    }

    public String getRedisNamespace() {
        return redisNamespace;
    }

    public void setRedisNamespace(String redisNamespace) {
        this.redisNamespace = redisNamespace;
    }

    public String getSignedUrlBaseUrl() {
        return signedUrlBaseUrl;
    }

    public void setSignedUrlBaseUrl(String signedUrlBaseUrl) {
        this.signedUrlBaseUrl = signedUrlBaseUrl;
    }

    public Duration getSignedUrlTtl() {
        return signedUrlTtl;
    }

    public void setSignedUrlTtl(Duration signedUrlTtl) {
        this.signedUrlTtl = signedUrlTtl;
    }

    public Duration getMaxSignedUrlTtl() {
        return maxSignedUrlTtl;
    }

    public void setMaxSignedUrlTtl(Duration maxSignedUrlTtl) {
        this.maxSignedUrlTtl = maxSignedUrlTtl;
    }

    public boolean isObjectStoreEnabled() { return objectStoreEnabled; }
    public void setObjectStoreEnabled(boolean value) { objectStoreEnabled = value; }
    public String getObjectStoreEndpoint() { return objectStoreEndpoint; }
    public void setObjectStoreEndpoint(String value) { objectStoreEndpoint = value; }
    public String getObjectStorePublicEndpoint() { return objectStorePublicEndpoint; }
    public void setObjectStorePublicEndpoint(String value) { objectStorePublicEndpoint = value; }
    public String getObjectStoreBucket() { return objectStoreBucket; }
    public void setObjectStoreBucket(String value) { objectStoreBucket = value; }
    public String getObjectStoreAccessKey() { return objectStoreAccessKey; }
    public void setObjectStoreAccessKey(String value) { objectStoreAccessKey = value; }
    public String getObjectStoreSecretKey() { return objectStoreSecretKey; }
    public void setObjectStoreSecretKey(String value) { objectStoreSecretKey = value; }
    public String getObjectStoreRegion() { return objectStoreRegion; }
    public void setObjectStoreRegion(String value) { objectStoreRegion = value; }
}
