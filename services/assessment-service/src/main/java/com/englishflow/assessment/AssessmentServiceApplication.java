package com.englishflow.assessment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;

/** Runtime composition root. Domain tests intentionally do not require Spring. */
@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
public class AssessmentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AssessmentServiceApplication.class, args);
    }
}
