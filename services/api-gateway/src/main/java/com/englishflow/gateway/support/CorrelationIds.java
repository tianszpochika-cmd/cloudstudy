package com.englishflow.gateway.support;

import java.util.UUID;
import java.util.regex.Pattern;

public final class CorrelationIds {

    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9._:-]{1,128}");
    private static final Pattern TRACEPARENT = Pattern.compile("^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$");

    private CorrelationIds() {
    }

    public static String requestId(String candidate, int maxLength) {
        return isSafe(candidate, maxLength) ? candidate : UUID.randomUUID().toString();
    }

    public static String traceId(String candidate, String traceparent, int maxLength) {
        if (isSafe(candidate, maxLength)) {
            return candidate;
        }
        if (traceparent != null) {
            var match = TRACEPARENT.matcher(traceparent);
            if (match.matches()
                    && !allZero(match.group(1))
                    && !allZero(match.group(2))) {
                return match.group(1);
            }
        }
        return UUID.randomUUID().toString().replace("-", "");
    }

    private static boolean isSafe(String value, int maxLength) {
        return value != null && value.length() <= maxLength && SAFE_ID.matcher(value).matches();
    }

    private static boolean allZero(String value) {
        return value.chars().allMatch(character -> character == '0');
    }
}
