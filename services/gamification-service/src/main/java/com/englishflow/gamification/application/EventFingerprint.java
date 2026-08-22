package com.englishflow.gamification.application;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import com.englishflow.gamification.domain.TrustedCompletionEvent;

/** Stable payload fingerprint used to reject same-key/different-payload replays. */
public final class EventFingerprint {

    private EventFingerprint() {
    }

    public static String of(TrustedCompletionEvent event) {
        String canonical = String.join("|",
                event.sourceService(), event.eventType(), event.eventId(), event.traceId(),
                event.schemaVersion(), event.occurredAt().toString(), event.subject(),
                event.aggregateId(), event.ruleVersion(),
                event.userTimeZone() == null ? "" : event.userTimeZone().getId());
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte value : digest) {
                result.append(String.format("%02x", value));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }
}
