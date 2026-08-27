package com.englishflow.iam.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Local/test adapter for IAM-owned consent records. */
public final class InMemoryConsentStore implements ConsentStore {

    private final Map<String, ConsentRecord> records = new ConcurrentHashMap<>();
    private final Map<String, List<ConsentRecord>> history = new ConcurrentHashMap<>();

    @Override
    public synchronized ConsentRecord append(ConsentRecord record) {
        records.put(key(record.principalId(), record.type()), record);
        history.computeIfAbsent(key(record.principalId(), record.type()), ignored -> new ArrayList<>())
                .add(record);
        return record;
    }

    @Override
    public Optional<ConsentRecord> find(PrincipalId principalId, ConsentType type) {
        return Optional.ofNullable(records.get(key(principalId, type)));
    }

    @Override
    public synchronized List<ConsentRecord> history(PrincipalId principalId, ConsentType type) {
        return List.copyOf(history.getOrDefault(key(principalId, type), List.of()));
    }

    private static String key(PrincipalId principalId, ConsentType type) {
        return principalId + ":" + type.name();
    }
}
