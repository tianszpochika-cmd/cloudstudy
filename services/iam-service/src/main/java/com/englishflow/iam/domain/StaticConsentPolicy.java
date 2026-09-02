package com.englishflow.iam.domain;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Explicit policy-version adapter for tests/local configuration. */
public final class StaticConsentPolicy implements ConsentPolicyPort {

    private final Map<ConsentType, ConsentPolicyDescriptor> descriptors;
    private final boolean writesEnabled;
    private final boolean evaluationEnabled;

    private StaticConsentPolicy() {
        this.descriptors = Map.of();
        this.writesEnabled = false;
        this.evaluationEnabled = false;
    }

    /**
     * Backward-compatible constructor for old in-process fixtures. New composition roots should
     * use {@link #strict(Map, boolean)} with complete published descriptors.
     */
    public StaticConsentPolicy(Map<ConsentType, ?> values) {
        this(values, true, true, false);
    }

    private StaticConsentPolicy(Map<ConsentType, ?> values, boolean writesEnabled,
                                boolean evaluationEnabled, boolean strict) {
        Objects.requireNonNull(values, "values");
        EnumMap<ConsentType, ConsentPolicyDescriptor> mapped = new EnumMap<>(ConsentType.class);
        for (ConsentType type : ConsentType.values()) {
            Object value = values.get(type);
            if (value instanceof ConsentPolicyDescriptor descriptor) {
                if (descriptor.type() != type) {
                    throw new IllegalArgumentException("consent policy descriptor type mismatch");
                }
                mapped.put(type, descriptor);
            } else if (value instanceof ConsentVersion version) {
                mapped.put(type, ConsentPolicyDescriptor.legacyCandidate(type, version));
            } else if (!strict) {
                // Old unit fixtures only named TERMS/PRIVACY. Missing types remain explicit
                // local candidates and cannot be mistaken for a production published policy.
                mapped.put(type, ConsentPolicyDescriptor.localCandidate(type));
            } else {
                throw new IllegalArgumentException("all B8 consent types need a published descriptor");
            }
        }
        this.descriptors = Map.copyOf(mapped);
        this.writesEnabled = writesEnabled;
        this.evaluationEnabled = evaluationEnabled;
    }

    public static StaticConsentPolicy strict(Map<ConsentType, ConsentPolicyDescriptor> descriptors,
                                             boolean writesEnabled) {
        return new StaticConsentPolicy(descriptors, writesEnabled, writesEnabled, true);
    }

    public static StaticConsentPolicy strict(Map<ConsentType, ConsentPolicyDescriptor> descriptors,
                                             boolean writesEnabled, boolean evaluationEnabled) {
        return new StaticConsentPolicy(descriptors, writesEnabled, evaluationEnabled, true);
    }

    public static StaticConsentPolicy localCandidate(boolean writesEnabled) {
        if (!writesEnabled) {
            // A non-local composition root must not expose the local candidate document facts at
            // all. Missing published configuration is an unavailable policy, not a read-only
            // policy whose fixture values could leak into responses or authorization context.
            return new StaticConsentPolicy();
        }
        EnumMap<ConsentType, ConsentPolicyDescriptor> descriptors = new EnumMap<>(ConsentType.class);
        for (ConsentType type : ConsentType.values()) {
            descriptors.put(type, ConsentPolicyDescriptor.localCandidate(type));
        }
        return strict(descriptors, writesEnabled);
    }

    /**
     * Adapter for pre-M2-002 in-process PDP fixtures, where one version represented both the
     * document and policy fact. Runtime composition must use the explicitly separated descriptor
     * set from {@link #localCandidate(boolean)} or a provisioned policy source instead.
     */
    static StaticConsentPolicy legacyCompatibility() {
        ConsentVersion version = new ConsentVersion("b30-consent-v1");
        EnumMap<ConsentType, ConsentPolicyDescriptor> descriptors = new EnumMap<>(ConsentType.class);
        for (ConsentType type : ConsentType.values()) {
            descriptors.put(type, ConsentPolicyDescriptor.legacyCandidate(type, version));
        }
        return strict(descriptors, true, true);
    }

    @Override
    public ConsentPolicyDescriptor descriptor(ConsentType type) {
        ConsentPolicyDescriptor descriptor = descriptors.get(type);
        if (descriptor == null) {
            throw new IamPolicyException(
                    IamDecisionCode.POLICY_UNAVAILABLE,
                    "iam.consent.version_unavailable");
        }
        return descriptor;
    }

    @Override
    public Set<ConsentPolicyDescriptor> descriptors() {
        return descriptors.isEmpty() ? Set.of() : ConsentPolicyPort.super.descriptors();
    }

    @Override
    public boolean writesEnabled() {
        return writesEnabled;
    }

    @Override
    public boolean evaluationEnabled() {
        return evaluationEnabled;
    }
}
