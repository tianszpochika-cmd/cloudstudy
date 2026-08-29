package com.englishflow.iam;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Independently deployable IAM boundary for the v2 service line.
 *
 * <p>This process is the platform-owned account/password authentication center. It signs short-
 * lived RS256 access JWTs, publishes the public JWKS and owns opaque refresh-token rotation,
 * replay detection, device sessions and revocation.</p>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class IamServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IamServiceApplication.class, args);
    }
}
