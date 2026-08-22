package com.englishflow.platform.template.security;

/** Explicit consent state; UNKNOWN is not equivalent to granted. */
public enum ConsentState {
    GRANTED,
    DENIED,
    UNKNOWN
}
