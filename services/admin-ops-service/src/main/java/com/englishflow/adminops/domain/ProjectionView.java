package com.englishflow.adminops.domain;

import java.util.Map;

/** Safe admin projection; raw subject IDs and domain-specific private fields never leave this view. */
public record ProjectionView(
        Domain domain,
        String resourceRef,
        String ownerRef,
        String version,
        String status,
        Map<String, String> safeFields) {

    public ProjectionView {
        safeFields = safeFields == null ? Map.of() : Map.copyOf(safeFields);
    }
}
