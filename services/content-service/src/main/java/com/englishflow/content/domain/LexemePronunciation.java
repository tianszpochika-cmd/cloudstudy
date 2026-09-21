package com.englishflow.content.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * One pronunciation asset reference for a lexeme. Audio bytes never flow
 * through content-service; this row only carries the media-service asset id,
 * technical metadata and the QC verdict.
 */
public record LexemePronunciation(
        String pronunciationId,
        String lexemeId,
        String tenantId,
        String accent,
        String ipa,
        String audioAssetId,
        String sourceType,
        String voiceName,
        Integer durationMs,
        Integer sampleRate,
        Integer bitrateKbps,
        String qcStatus,
        String qcBy,
        Instant qcAt,
        Instant createdAt) {

    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");
    private static final Set<String> ACCENTS = Set.of("US", "UK", "SLOW");
    private static final Set<String> SOURCES = Set.of("HUMAN", "TTS");
    private static final Set<String> QC = Set.of("PENDING", "READY", "CLEAN", "FAILED");

    public LexemePronunciation {
        requireId(pronunciationId, "pronunciationId");
        requireId(lexemeId, "lexemeId");
        requireId(tenantId, "tenantId");
        if (!ACCENTS.contains(accent)) {
            throw ContentOperationException.badRequest("LEXEME_PRONUNCIATION_INVALID", "accent must be US, UK or SLOW");
        }
        if (ipa == null || ipa.isBlank() || ipa.length() > 128) {
            throw ContentOperationException.badRequest("LEXEME_PRONUNCIATION_INVALID", "ipa must be 1..128 characters");
        }
        requireId(audioAssetId, "audioAssetId");
        if (!SOURCES.contains(sourceType)) {
            throw ContentOperationException.badRequest("LEXEME_PRONUNCIATION_INVALID", "sourceType must be HUMAN or TTS");
        }
        if (!QC.contains(qcStatus)) {
            throw ContentOperationException.badRequest("LEXEME_PRONUNCIATION_INVALID", "qcStatus is invalid");
        }
        Objects.requireNonNull(createdAt, "createdAt is required");
    }

    private static void requireId(String value, String field) {
        Objects.requireNonNull(value, field + " is required");
        if (!SAFE_ID.matcher(value).matches()) {
            throw ContentOperationException.badRequest("LEXEME_PRONUNCIATION_INVALID", field + " has an unsafe format");
        }
    }
}
