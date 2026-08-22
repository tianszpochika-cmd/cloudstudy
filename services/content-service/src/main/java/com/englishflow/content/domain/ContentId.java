package com.englishflow.content.domain;

import java.util.Objects;
import java.util.regex.Pattern;

public record ContentId(String value) {

    private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{1,127}");

    public ContentId {
        Objects.requireNonNull(value, "content id is required");
        if (!SAFE.matcher(value).matches()) {
            throw ContentOperationException.badRequest("CONTENT_ID_INVALID", "content id has an unsafe format");
        }
    }

    public static ContentId of(String value) {
        return new ContentId(value);
    }
}
