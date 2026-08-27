package com.englishflow.gateway.rate;

import com.englishflow.gateway.config.GatewayProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

/**
 * Redis fixed-window backend. The Lua script makes increment and expiry
 * atomic, so multiple Gateway instances share one admission decision.
 */
@Component
@ConditionalOnProperty(prefix = "gateway.rate-limit", name = "backend", havingValue = "redis")
public final class RedisRateLimitBackend implements RateLimitBackend {

    private static final DefaultRedisScript<String> SCRIPT = new DefaultRedisScript<>(
            "local current = redis.call('INCR', KEYS[1]) "
                    + "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end "
                    + "local ttl = redis.call('PTTL', KEYS[1]) "
                    + "return tostring(current) .. ':' .. tostring(ttl)",
            String.class
    );

    private final ReactiveStringRedisTemplate redis;

    public RedisRateLimitBackend(ReactiveStringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public Mono<RateLimitDecision> consume(String key, GatewayProperties.RateLimit policy) {
        long now = Instant.now().toEpochMilli();
        String redisKey = "englishflow:gateway:rate-limit:" + digest(key);
        return redis.execute(
                        SCRIPT,
                        List.of(redisKey),
                        Long.toString(policy.window().toMillis())
                )
                .next()
                .switchIfEmpty(Mono.error(new IllegalStateException("rate-limit-script-returned-no-result")))
                .map(result -> decision(result, policy, now));
    }

    private static RateLimitDecision decision(
            String result,
            GatewayProperties.RateLimit policy,
            long now
    ) {
        String[] values = result.split(":", 2);
        long used = Long.parseLong(values[0]);
        long ttlMillis = values.length == 2 ? Long.parseLong(values[1]) : policy.window().toMillis();
        long reset = now + Math.max(1_000L, ttlMillis);
        return new RateLimitDecision(
                used <= policy.requestsPerWindow(),
                policy.requestsPerWindow(),
                Math.max(0, policy.requestsPerWindow() - used),
                (reset + 999) / 1000
        );
    }

    private static String digest(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the runtime", exception);
        }
    }
}
