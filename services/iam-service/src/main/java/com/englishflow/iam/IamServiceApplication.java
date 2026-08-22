package com.englishflow.iam;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Independently deployable IAM boundary for the v2 service line.
 *
 * <p>This process owns IAM facts and provider ports. It is not an OAuth/OIDC token server and
 * has no controller that accepts or mints access/refresh tokens.</p>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class IamServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IamServiceApplication.class, args);
    }
}
