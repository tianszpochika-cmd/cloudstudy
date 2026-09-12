package com.englishflow.content.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Outbox relay settings, mirroring the publisher block of the event runtime contract
 * (config/b26-event-runtime.json): row-lock-skip-locked claiming, a 30 second lease, batches of 100
 * and a broker acknowledgement before a row is marked published.
 */
@ConfigurationProperties(prefix = "content.events.relay")
public class ContentEventRelayProperties {

    /** The relay only runs when explicitly enabled; a half-configured broker must not invent facts. */
    private boolean enabled = false;

    /** Destination topic from the contract's topic table: platform.<domain>.v1. */
    private String topic = "platform.content.v1";

    /** Registered loopback broker from config/local-ports.json; non-local values come from env. */
    private String bootstrapServers = "127.0.0.1:19092";

    private int batchSize = 100;

    private Duration lease = Duration.ofSeconds(30);

    private Duration pollInterval = Duration.ofSeconds(5);

    private int maxAttempts = 5;

    private Duration baseDelay = Duration.ofSeconds(1);

    private Duration maxDelay = Duration.ofSeconds(60);

    /** Identifies this instance in the outbox lock columns so a stuck lease can be attributed. */
    private String instanceId = "content-service";

    public boolean isEnabled() { return enabled; }

    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getTopic() { return topic; }

    public void setTopic(String topic) { this.topic = topic; }

    public String getBootstrapServers() { return bootstrapServers; }

    public void setBootstrapServers(String bootstrapServers) { this.bootstrapServers = bootstrapServers; }

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

    public String getInstanceId() { return instanceId; }

    public void setInstanceId(String instanceId) { this.instanceId = instanceId; }
}
