package com.englishflow.workflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Saga state, scheduled jobs, compensation, dead letter handling and manual recovery.
 *
 * <p>This service owns its own schema and holds no domain facts: a saga records how far a cross-domain
 * operation got and what compensates each completed step, and the domains remain the owners of what those
 * steps changed. It never writes another owner's tables.
 */
@SpringBootApplication
public class WorkflowServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkflowServiceApplication.class, args);
    }
}
