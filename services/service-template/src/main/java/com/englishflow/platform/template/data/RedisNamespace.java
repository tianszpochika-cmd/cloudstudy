package com.englishflow.platform.template.data;

import java.util.Objects;
import java.util.regex.Pattern;

/** Redis is a short-lived/rebuildable namespace, never the durable source of truth. */
public record RedisNamespace(String value) {

    private static final Pattern SAFE_NAMESPACE = Pattern.compile("[a-z][a-z0-9._-]{0,63}");
    private static final Pattern SAFE_SEGMENT = Pattern.compile("[a-z0-9][a-z0-9._-]{0,127}");
    private static final Pattern SENSITIVE_SEGMENT = Pattern.compile(".*(password|secret|token|email|phone|audio|payment).*", Pattern.CASE_INSENSITIVE);

    public RedisNamespace {
        Objects.requireNonNull(value, "redis namespace is required");
        if (!SAFE_NAMESPACE.matcher(value).matches()) {
            throw new IllegalArgumentException("redis namespace has an unsafe format");
        }
    }

    public String key(String... segments) {
        if (segments == null || segments.length == 0) throw new IllegalArgumentException("at least one key segment is required");
        StringBuilder key = new StringBuilder(value);
        for (String segment : segments) {
            if (segment == null || !SAFE_SEGMENT.matcher(segment).matches() || SENSITIVE_SEGMENT.matcher(segment).matches()) {
                throw new IllegalArgumentException("redis key segment is unsafe");
            }
            key.append(':').append(segment);
        }
        return key.toString();
    }
}

