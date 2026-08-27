package com.englishflow.content.adapter.failclosed;

import com.englishflow.content.domain.ContentOperationException;

/** Shared fail-closed error for a service process without an explicitly configured store. */
public final class ContentPersistenceFailure {

    private ContentPersistenceFailure() {
    }

    public static ContentOperationException unavailable() {
        return ContentOperationException.unavailable(
                "CONTENT_PERSISTENCE_UNAVAILABLE",
                "content persistence is disabled; configure CONTENT_PERSISTENCE_MODE=jdbc");
    }
}
