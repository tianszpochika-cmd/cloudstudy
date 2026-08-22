package com.englishflow.content.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Service ownership and namespace facts; these are deployment facts, not client input. */
@Validated
@ConfigurationProperties(prefix = "service", ignoreUnknownFields = false, ignoreInvalidFields = false)
public class ContentServiceProperties {

    private static final String SERVICE_NAME = "[a-z0-9][a-z0-9-]{0,62}[a-z0-9]";
    private static final String IDENTIFIER = "[A-Za-z0-9][A-Za-z0-9._:-]{0,127}";
    private static final String SCHEMA = "[a-z][a-z0-9_]{0,62}";

    @NotBlank
    @Size(max = 64)
    @Pattern(regexp = SERVICE_NAME)
    private String name;

    @NotBlank
    @Size(max = 128)
    @Pattern(regexp = IDENTIFIER)
    private String owner;

    @NotBlank
    @Size(max = 63)
    @Pattern(regexp = SCHEMA)
    private String schema;

    @NotBlank
    @Size(max = 128)
    @Pattern(regexp = IDENTIFIER)
    private String redisNamespace;

    @Min(1)
    @Max(65535)
    private int port;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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

    public int getPort() {
        return port;
    }

    public void setPort(int port) {
        this.port = port;
    }
}
