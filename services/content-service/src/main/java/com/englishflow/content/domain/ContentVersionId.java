package com.englishflow.content.domain;

/** Numeric identity aligned with the B9 API, event and MySQL BIGINT contract. */
public record ContentVersionId(long value) {

    public ContentVersionId {
        if (value < 1) {
            throw ContentOperationException.badRequest(
                    "CONTENT_VERSION_ID_INVALID", "content version id must be positive");
        }
    }

    /** Compatibility constructor for adapters that receive a path/header value as text. */
    public ContentVersionId(String value) {
        this(parse(value));
    }

    public static ContentVersionId of(long value) {
        return new ContentVersionId(value);
    }

    public static ContentVersionId of(String value) {
        return new ContentVersionId(value);
    }

    private static long parse(String value) {
        if (value == null || !value.matches("[1-9][0-9]{0,18}")) {
            throw ContentOperationException.badRequest(
                    "CONTENT_VERSION_ID_INVALID", "content version id must be a positive int64");
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            throw ContentOperationException.badRequest(
                    "CONTENT_VERSION_ID_INVALID", "content version id must be a positive int64");
        }
    }
}
