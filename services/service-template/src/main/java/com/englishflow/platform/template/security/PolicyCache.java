package com.englishflow.platform.template.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Short-lived in-memory policy cache. It is not a source of truth and never accepts an
 * unverified policy package.
 */
public final class PolicyCache {

    private final Clock clock;
    private final Duration maxAge;
    private final AtomicReference<Entry> current = new AtomicReference<>();

    public PolicyCache(Clock clock, Duration maxAge) {
        this.clock = Objects.requireNonNull(clock, "clock is required");
        this.maxAge = Objects.requireNonNull(maxAge, "maxAge is required");
        if (maxAge.isZero() || maxAge.isNegative()) {
            throw new IllegalArgumentException("policy cache maxAge must be positive");
        }
    }

    /** Replace the cache only with a policy whose signature was verified by a trusted loader. */
    public void put(PolicySnapshot snapshot) {
        Objects.requireNonNull(snapshot, "policy snapshot is required");
        if (!snapshot.signatureVerified()) {
            throw new SecurityException("unverified policy snapshot cannot enter the cache");
        }
        Instant loadedAt = clock.instant();
        if (!snapshot.version().isFresh(loadedAt)) {
            throw new SecurityException("expired policy snapshot cannot enter the cache");
        }
        current.updateAndGet(existing -> {
            if (existing != null && snapshot.version().isOlderThan(existing.snapshot().version())) {
                throw new SecurityException("policy rollback rejected");
            }
            return new Entry(snapshot, loadedAt);
        });
    }

    public Optional<PolicySnapshot> current() {
        Entry entry = current.get();
        return entry == null ? Optional.empty() : Optional.of(entry.snapshot());
    }

    public Optional<PolicySnapshot> fresh() {
        Entry entry = current.get();
        if (entry == null) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        if (!entry.snapshot().version().isFresh(now)
                || now.isAfter(entry.loadedAt().plus(maxAge))) {
            return Optional.empty();
        }
        return Optional.of(entry.snapshot());
    }

    public void clear() {
        current.set(null);
    }

    private record Entry(PolicySnapshot snapshot, Instant loadedAt) {
    }
}
