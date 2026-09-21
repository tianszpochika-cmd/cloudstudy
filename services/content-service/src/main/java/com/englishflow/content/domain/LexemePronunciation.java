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
    /**
     * B4 language ribbon: accent is an open BCP-47-style tag (uppercase-normalized
     * by the command service). US/UK/SLOW remain the conventional English values;
     * other languages register their own tags such as FR-PARIS.
     */
    private static final Pattern ACCENT = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,15}");
    private static final Set<String> SOURCES = Set.of("HUMAN", "TTS");
    private static final Set<String> QC = Set.of("PENDING", "READY", "CLEAN", "FAILED");

    public LexemePronunciation {
        requireId(pronunciationId, "pronunciationId");
        requireId(lexemeId, "lexemeId");
        requireId(tenantId, "tenantId");
        if (accent == null || !ACCENT.matcher(accent).matches()) {
            throw ContentOperationException.badRequest("LEXEME_PRONUNCIATION_INVALID",
                    "accent must be a 1..16 character tag such as US, UK, SLOW or FR-PARIS");
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
