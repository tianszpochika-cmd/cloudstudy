package com.englishflow.modules.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Repository;

/** Deterministic, thread-safe substitute used until the MySQL adapter is wired. */
@Repository
public final class InMemoryIdentityRepository implements IdentityRepository {

    private final AtomicLong sequence = new AtomicLong(0);
    private final ConcurrentMap<String, AuthIdentity> byPhoneHash = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, AuthIdentity> byUserId = new ConcurrentHashMap<>();

    @Override
    public Optional<AuthIdentity> findByPhoneLookupHash(String phoneLookupHash) {
        return Optional.ofNullable(byPhoneHash.get(phoneLookupHash));
    }

    @Override
    public Optional<AuthIdentity> findByUserId(long userId) {
        return Optional.ofNullable(byUserId.get(userId));
    }

    @Override
    public synchronized AuthIdentity create(
            String phoneLookupHash,
            Instant adultConfirmedAt,
            String privacyPolicyVersion,
            Instant privacyConsentedAt,
            Instant now
    ) {
        if (byPhoneHash.containsKey(phoneLookupHash)) {
            throw AuthException.identityExists();
        }
        long userId = sequence.incrementAndGet();
        AuthIdentity identity = new AuthIdentity(
                userId,
                UUID.randomUUID().toString(),
                phoneLookupHash,
                AuthIdentityStatus.ACTIVE,
                now,
                adultConfirmedAt,
                privacyConsentedAt,
                privacyPolicyVersion,
                now,
                now
        );
        byPhoneHash.put(phoneLookupHash, identity);
        byUserId.put(userId, identity);
        return identity;
    }

    @Override
    public void recordLogin(AuthIdentity identity, Instant at) {
        identity.recordLogin(at);
    }

    public int size() {
        return byUserId.size();
    }
}
