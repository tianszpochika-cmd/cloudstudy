package com.englishflow.platform.template;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Minimal entry point for a copied v2 service.
 *
 * <p>Domain controllers, persistence adapters and shared ORM models deliberately do not
 * belong in this template.</p>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class ServiceTemplateApplication {

    public static void main(String[] args) {
        SpringApplication.run(ServiceTemplateApplication.class, args);
    }
}
