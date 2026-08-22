package com.englishflow.content.domain;

/** Projection audience. Only ASSESSMENT is allowed to receive answer rules. */
public enum ContentAudience {
    PUBLIC,
    LEARNER,
    ASSESSMENT,
    ADMIN_PREVIEW
}
