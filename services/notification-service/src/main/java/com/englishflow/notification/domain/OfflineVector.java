package com.englishflow.notification.domain;

import java.util.LinkedHashMap;
import java.util.Map;

/** Immutable vector clock used to explain concurrent offline updates. */
public record OfflineVector(Map<String, Long> values) {

    public enum Relation {
        EQUAL,
        DOMINATES,
        DOMINATED_BY,
        CONCURRENT
    }

    public OfflineVector {
        if (values == null || values.isEmpty()) {
            values = Map.of();
        } else {
            LinkedHashMap<String, Long> normalized = new LinkedHashMap<>();
            values.forEach((device, version) -> {
                if (device == null || device.isBlank() || version == null || version < 0) {
                    throw NotificationDomainException.invalid("offline vector contains an invalid entry");
                }
                normalized.put(device.trim(), version);
            });
            values = Map.copyOf(normalized);
        }
    }

    public Relation relationTo(OfflineVector other) {
        if (other == null) {
            throw NotificationDomainException.invalid("offline vector is required");
        }
        boolean thisAtLeast = atLeastAsLargeAs(other);
        boolean otherAtLeast = other.atLeastAsLargeAs(this);
        if (thisAtLeast && otherAtLeast) {
            return Relation.EQUAL;
        }
        if (thisAtLeast) {
            return Relation.DOMINATES;
        }
        if (otherAtLeast) {
            return Relation.DOMINATED_BY;
        }
        return Relation.CONCURRENT;
    }

    public OfflineVector merge(OfflineVector other) {
        if (other == null) {
            throw NotificationDomainException.invalid("offline vector is required");
        }
        LinkedHashMap<String, Long> merged = new LinkedHashMap<>(values);
        other.values.forEach((device, version) -> merged.merge(device, version, Math::max));
        return new OfflineVector(merged);
    }

    private boolean atLeastAsLargeAs(OfflineVector other) {
        for (Map.Entry<String, Long> entry : other.values.entrySet()) {
            if (values.getOrDefault(entry.getKey(), 0L) < entry.getValue()) {
                return false;
            }
        }
        return true;
    }
}
