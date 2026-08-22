package com.englishflow.iam.domain;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Provider-neutral reference adapter for tests and local logic checks. It is not a production
 * persistence implementation and does not access core-api tables.
 */
public final class InMemoryPrincipalMappingStore implements PrincipalMappingPort {

    private final Map<String, PrincipalMapping> byExternalIdentity = new HashMap<>();
    private final Map<PrincipalId, PrincipalMapping> byPrincipal = new HashMap<>();

    @Override
    public synchronized Optional<PrincipalMapping> findByExternalIdentity(ExternalIdentity identity) {
        return Optional.ofNullable(byExternalIdentity.get(identity.stableKey()));
    }

    @Override
    public synchronized PrincipalMapping createIfAbsent(PrincipalMapping mapping) {
        Objects.requireNonNull(mapping, "mapping");
        PrincipalMapping existingExternal = byExternalIdentity.get(mapping.externalIdentity().stableKey());
        if (existingExternal != null) {
            if (!existingExternal.principalId().equals(mapping.principalId())) {
                throw new IamPolicyException(
                        IamDecisionCode.PRINCIPAL_MAPPING_CONFLICT,
                        "iam.principal_mapping.immutable");
            }
            return existingExternal;
        }

        PrincipalMapping existingPrincipal = byPrincipal.get(mapping.principalId());
        if (existingPrincipal != null
                && !existingPrincipal.externalIdentity().equals(mapping.externalIdentity())) {
            throw new IamPolicyException(
                    IamDecisionCode.PRINCIPAL_MAPPING_CONFLICT,
                    "iam.principal_mapping.immutable");
        }

        byExternalIdentity.put(mapping.externalIdentity().stableKey(), mapping);
        byPrincipal.put(mapping.principalId(), mapping);
        return mapping;
    }
}
