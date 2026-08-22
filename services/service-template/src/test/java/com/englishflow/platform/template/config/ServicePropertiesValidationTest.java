package com.englishflow.platform.template.config;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

import org.junit.jupiter.api.Test;

class ServicePropertiesValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void missingMetadataIsRejected() {
        ServiceProperties properties = new ServiceProperties();

        assertThat(validator.validate(properties))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("name", "owner", "schema", "redisNamespace", "port");
    }

    @Test
    void invalidPortAndIdentifiersAreRejected() {
        ServiceProperties properties = new ServiceProperties();
        properties.setName("Invalid Service Name");
        properties.setOwner("platform owner");
        properties.setSchema("service-schema");
        properties.setRedisNamespace("redis namespace");
        properties.setPort(65536);

        assertThat(validator.validate(properties))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("name", "owner", "schema", "redisNamespace", "port");
    }
}
