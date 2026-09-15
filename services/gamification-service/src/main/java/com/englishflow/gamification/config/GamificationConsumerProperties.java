package com.englishflow.gamification.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * M7-001 inbound consumer settings for trusted learning completions: the contract's
 * consumer group, bounded retries with exponential backoff plus jitter, and DLQ routing
 * once the attempt budget is exhausted. Off by default like every other consumer.
 */
@ConfigurationProperties(prefix = "gamification.events.consumer")
public class GamificationConsumerProperties {

    /** Off by default; a consumer that starts against an unconfigured broker must not be implicit. */
    private boolean enabled = false;

    /** From the contract's topic table: cg.gamification-from-learning.v1. */
    private String groupId = "cg.gamification-from-learning.v1";

    private String topic = "platform.learning.v1";

    private String dlqTopic = "platform.events.dlq.v1";

    private String bootstrapServers = "127.0.0.1:19092";

    private int maxAttempts = 5;

    private Duration baseDelay = Duration.ofSeconds(1);

    private Duration maxDelay = Duration.ofSeconds(60);

    private Duration pollTimeout = Duration.ofSeconds(3);

    public boolean isEnabled() { return enabled; }

    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getGroupId() { return groupId; }

    public void setGroupId(String groupId) { this.groupId = groupId; }

    public String getTopic() { return topic; }

    public void setTopic(String topic) { this.topic = topic; }

    public String getDlqTopic() { return dlqTopic; }

    public void setDlqTopic(String dlqTopic) { this.dlqTopic = dlqTopic; }

    public String getBootstrapServers() { return bootstrapServers; }

    public void setBootstrapServers(String bootstrapServers) { this.bootstrapServers = bootstrapServers; }

    public int getMaxAttempts() { return maxAttempts; }

    public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }

    public Duration getBaseDelay() { return baseDelay; }

    public void setBaseDelay(Duration baseDelay) { this.baseDelay = baseDelay; }

    public Duration getMaxDelay() { return maxDelay; }

    public void setMaxDelay(Duration maxDelay) { this.maxDelay = maxDelay; }

    public Duration getPollTimeout() { return pollTimeout; }

    public void setPollTimeout(Duration pollTimeout) { this.pollTimeout = pollTimeout; }
}
