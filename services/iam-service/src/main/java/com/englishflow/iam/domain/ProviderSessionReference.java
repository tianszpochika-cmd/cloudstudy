package com.englishflow.iam.domain;

import java.util.Objects;
import java.util.regex.Pattern;

/** Non-secret reference understood by the provider adapter; it is not an access or refresh token. */
public record ProviderSessionReference(String value) {

    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");

    public ProviderSessionReference {
        Objects.requireNonNull(value, "value");
        if (!SAFE.matcher(value).matches()) {
            throw new IllegalArgumentException("provider session reference is invalid");
        }
    }
}
