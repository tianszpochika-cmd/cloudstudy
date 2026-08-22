package com.englishflow.learner.domain;

/** Provenance is explicit so a read-only legacy projection is never mistaken for owned data. */
public enum ProfileSource {
    OWNED,
    LEGACY_SHADOW,
    EMPTY
}
