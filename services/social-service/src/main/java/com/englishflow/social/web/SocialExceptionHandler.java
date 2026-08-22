package com.englishflow.social.web;

/**
 * Compatibility marker for the pre-B12 adapter. The active exception boundary is
 * {@link ApiExceptionHandler}; keeping a second {@code @RestControllerAdvice} here would make
 * malformed JSON handling ambiguous at runtime.
 */
public final class SocialExceptionHandler {

    private SocialExceptionHandler() {
    }
}
