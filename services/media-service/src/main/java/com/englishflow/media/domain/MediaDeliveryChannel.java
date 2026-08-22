package com.englishflow.media.domain;

import java.util.Locale;

public enum MediaDeliveryChannel {
    STREAM,
    DOWNLOAD,
    OFFLINE,
    PREVIEW,
    RECORDING

    ;

    public static MediaDeliveryChannel parse(String value) {
        if (value == null || value.isBlank()) {
            return STREAM;
        }
        try {
            return value.trim().toUpperCase(Locale.ROOT).equals("DOWNLOAD")
                    ? DOWNLOAD
                    : value.trim().toUpperCase(Locale.ROOT).equals("OFFLINE")
                            ? OFFLINE
                            : value.trim().toUpperCase(Locale.ROOT).equals("PREVIEW")
                                    ? PREVIEW
                                    : value.trim().toUpperCase(Locale.ROOT).equals("RECORDING")
                                            ? RECORDING
                                            : STREAM;
        } catch (RuntimeException exception) {
            throw MediaOperationException.badRequest("MEDIA_CHANNEL_INVALID", "media delivery channel is invalid");
        }
    }
}
