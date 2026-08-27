package com.englishflow.iam.oidc;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Local/test adapter with atomic consume semantics; it is not a production session store. */
public final class InMemoryAuthorizationTransactionStore implements AuthorizationTransactionPort {

    private final Map<String, AuthorizationTransaction> transactions = new ConcurrentHashMap<>();
    private final Set<String> consumedStates = ConcurrentHashMap.newKeySet();
    private final Duration ttl;
    private final java.time.Clock clock;

    public InMemoryAuthorizationTransactionStore(Duration ttl, java.time.Clock clock) {
        if (ttl == null || ttl.isNegative() || ttl.isZero()) {
            throw new IllegalArgumentException("ttl must be positive");
        }
        this.ttl = ttl;
        this.clock = java.util.Objects.requireNonNull(clock, "clock");
    }

    @Override
    public Optional<AuthorizationTransaction> find(String state) {
        if (state == null || state.isBlank()) {
            return Optional.empty();
        }
        AuthorizationTransaction transaction = transactions.get(state);
        if (transaction == null) {
            return Optional.empty();
        }
        if (!Instant.now(clock).isBefore(transaction.expiresAt())) {
            transactions.remove(state, transaction);
            return Optional.empty();
        }
        return Optional.of(transaction);
    }

    @Override
    public void save(AuthorizationTransaction transaction) {
        if (!Instant.now(clock).isBefore(transaction.expiresAt())) {
            throw new IllegalArgumentException("authorization transaction is already expired");
        }
        if (transaction.expiresAt().isAfter(transaction.createdAt().plus(ttl))) {
            throw new IllegalArgumentException("authorization transaction exceeds store TTL");
        }
        if (transactions.putIfAbsent(transaction.state(), transaction) != null) {
            throw new IllegalStateException("authorization transaction state already exists");
        }
    }

    @Override
    public Optional<AuthorizationTransaction> consume(String state) {
        if (state == null || state.isBlank()) {
            return Optional.empty();
        }
        AuthorizationTransaction transaction = transactions.remove(state);
        if (transaction == null) {
            return Optional.empty();
        }
        if (!Instant.now(clock).isBefore(transaction.expiresAt())) {
            return Optional.empty();
        }
        consumedStates.add(state);
        return Optional.of(transaction);
    }

    @Override
    public boolean wasConsumed(String state) {
        return state != null && consumedStates.contains(state);
    }
}
