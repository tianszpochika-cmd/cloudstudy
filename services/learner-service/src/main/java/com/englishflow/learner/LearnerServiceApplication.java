package com.englishflow.learner;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.health.DataSourceHealthContributorAutoConfiguration;

/**
 * Runtime shell for the learner bounded context.
 *
 * <p>HTTP controllers and durable adapters are intentionally supplied only after the
 * contract/migration tasks land. The domain ports below make that boundary explicit instead of
 * silently wiring an in-memory store into a deployable service.</p>
 */
@SpringBootApplication(exclude = {
        DataSourceAutoConfiguration.class,
        DataSourceTransactionManagerAutoConfiguration.class,
        DataSourceHealthContributorAutoConfiguration.class
})
@ConfigurationPropertiesScan
public class LearnerServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(LearnerServiceApplication.class, args);
    }
}
