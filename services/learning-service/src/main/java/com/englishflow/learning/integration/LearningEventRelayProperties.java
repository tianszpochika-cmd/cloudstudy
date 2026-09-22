package com.englishflow.learning.integration;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * M5-013 outbound relay settings. Off by default like every other relay: a relay
 * that starts against an unconfigured broker must be an explicit decision.
 */
@ConfigurationProperties(prefix = "learning.events.relay")
public class LearningEventRelayProperties {

    /** Off by default; an unconfigured broker must not silently change delivery semantics. */
    private boolean enabled = false;

    /** From the contract's topic table. The application never creates a topic. */
    private String topic = "platform.learning.v1";

    private String bootstrapServers = "127.0.0.1:19092";

    private String instanceId = "learning-service";

    private int batchSize = 100;

    private Duration lease = Duration.ofSeconds(30);

    private Duration pollInterval = Duration.ofSeconds(5);

    private int maxAttempts = 5;

    private Duration baseDelay = Duration.ofSeconds(1);

    private Duration maxDelay = Duration.ofSeconds(60);

    public boolean isEnabled() { return enabled; }

    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getTopic() { return topic; }

    public void setTopic(String topic) { this.topic = topic; }

    public String getBootstrapServers() { return bootstrapServers; }

    public void setBootstrapServers(String bootstrapServers) { this.bootstrapServers = bootstrapServers; }

    public String getInstanceId() { return instanceId; }

    public void setInstanceId(String instanceId) { this.instanceId = instanceId; }

    public int getBatchSize() { return batchSize; }

    public void setBatchSize(int batchSize) { this.batchSize = batchSize; }

    public Duration getLease() { return lease; }

    public void setLease(Duration lease) { this.lease = lease; }

    public Duration getPollInterval() { return pollInterval; }

    public void setPollInterval(Duration pollInterval) { this.pollInterval = pollInterval; }

    public int getMaxAttempts() { return maxAttempts; }

    public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }

    public Duration getBaseDelay() { return baseDelay; }

    public void setBaseDelay(Duration baseDelay) { this.baseDelay = baseDelay; }

    public Duration getMaxDelay() { return maxDelay; }

    public void setMaxDelay(Duration maxDelay) { this.maxDelay = maxDelay; }
}
