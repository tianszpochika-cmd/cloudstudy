package com.englishflow.media.domain;

public enum MediaKind {
    AUDIO,
    IMAGE,
    VIDEO,
    DOCUMENT,
    MODEL_3D,
    SVG,
    WAVEFORM,
    OFFLINE_BUNDLE,
    RECORDING,
    OTHER;

    public static MediaKind parse(String value) {
        if (value == null || value.isBlank()) {
            throw MediaOperationException.badRequest("MEDIA_KIND_INVALID", "media kind is required");
        }
        try {
            String normalized = value.trim().toUpperCase(java.util.Locale.ROOT);
            return switch (normalized) {
                case "3D_MODEL" -> MODEL_3D;
                case "OFFLINE" -> OFFLINE_BUNDLE;
                default -> valueOf(normalized);
            };
        } catch (IllegalArgumentException exception) {
            throw MediaOperationException.badRequest("MEDIA_KIND_INVALID", "media kind is invalid");
        }
    }
}
