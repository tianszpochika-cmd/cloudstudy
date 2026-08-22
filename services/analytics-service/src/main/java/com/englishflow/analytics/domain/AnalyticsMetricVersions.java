package com.englishflow.analytics.domain;

import java.util.Set;

/** Version policy for metric definitions, separate from event schema versions. */
public final class AnalyticsMetricVersions {

    public static final String ALL_CURRENT = "analytics.v1";
    private static final Set<String> CURRENT = Set.of(
            "learning.v1", "workflow.v1", "growth.v1", "social.v1", "notification.v1");

    private AnalyticsMetricVersions() {
    }

    public static boolean isSupported(String requested) {
        return ALL_CURRENT.equals(requested) || CURRENT.contains(requested);
    }

    public static boolean matches(String actual, String requested) {
        return requested == null || ALL_CURRENT.equals(requested) || actual.equals(requested);
    }
}
