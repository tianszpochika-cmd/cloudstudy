package com.englishflow.media.domain;

/** Trusted transcoder callback shape. It carries integrity metadata, never derived media bytes. */
public record MediaRenditionDraft(
        String renditionKey,
        String mimeType,
        String objectVersion,
        String checksumSha256,
        long sizeBytes,
        boolean supportsRange,
        RenditionStatus status,
        String failureCode) {
}
