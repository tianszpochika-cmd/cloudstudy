package com.englishflow.iam.domain;

import java.util.Objects;
import java.util.regex.Pattern;

/** Version of a policy text, never a client-controlled free-form authority. */
public record ConsentVersion(String value) {

    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,63}");

    public ConsentVersion {
        Objects.requireNonNull(value, "value");
        if (!SAFE.matcher(value).matches()) {
            throw new IllegalArgumentException("consent version is invalid");
        }
    }
}
