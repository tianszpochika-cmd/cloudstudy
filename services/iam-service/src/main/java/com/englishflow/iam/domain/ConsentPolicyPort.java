package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

/** Server-owned published consent policy boundary. */
public interface ConsentPolicyPort {

    ConsentPolicyDescriptor descriptor(ConsentType type);

    default ConsentVersion currentVersion(ConsentType type) {
        return descriptor(type).documentVersion();
    }

    /** Whether this policy has been explicitly provisioned for write decisions. */
    default boolean writesEnabled() {
        return true;
    }

    /** Whether the descriptors may be used as authorization facts, not merely displayed. */
    default boolean evaluationEnabled() {
        return true;
    }

    default Set<ConsentPolicyDescriptor> descriptors() {
        return Set.copyOf(Arrays.stream(ConsentType.values())
                .map(this::descriptor)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
    }

    default Set<String> requiredPurposesFor(String capability) {
        return descriptors().stream()
                .filter(value -> value.requiredFor(capability))
                .map(ConsentPolicyDescriptor::purpose)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    default boolean current(ConsentPolicyDescriptor descriptor, Instant now) {
        return descriptor != null && descriptor.isPublishedAt(now);
    }
}
