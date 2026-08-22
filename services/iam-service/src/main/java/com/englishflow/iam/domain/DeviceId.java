package com.englishflow.iam.domain;

import java.util.Objects;
import java.util.regex.Pattern;

/** Platform-generated or platform-bound device identifier; never a tenant authority. */
public record DeviceId(String value) {

    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");

    public DeviceId {
        Objects.requireNonNull(value, "value");
        if (!SAFE.matcher(value).matches()) {
            throw new IllegalArgumentException("device id is invalid");
        }
    }
}
