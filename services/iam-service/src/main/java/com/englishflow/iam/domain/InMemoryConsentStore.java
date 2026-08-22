package com.englishflow.iam.domain;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Local/test adapter for IAM-owned consent records. */
public final class InMemoryConsentStore implements ConsentStore {

    private final Map<String, ConsentRecord> records = new ConcurrentHashMap<>();

    @Override
    public ConsentRecord save(ConsentRecord record) {
        records.put(key(record.principalId(), record.type()), record);
        return record;
    }

    @Override
    public Optional<ConsentRecord> find(PrincipalId principalId, ConsentType type) {
        return Optional.ofNullable(records.get(key(principalId, type)));
    }

    private static String key(PrincipalId principalId, ConsentType type) {
        return principalId + ":" + type.name();
    }
}
