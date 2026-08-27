package com.englishflow.iam;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Independently deployable IAM boundary for the v2 service line.
 *
 * <p>This process owns IAM facts and provider ports. It is not an OAuth/OIDC token server and
 * never accepts or mints access/refresh tokens. While the approved external IdP adapter is
 * disabled, the HTTP provider boundary returns a structured fail-closed response.</p>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class IamServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IamServiceApplication.class, args);
    }
}
