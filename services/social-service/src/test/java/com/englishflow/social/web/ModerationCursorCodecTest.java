package com.englishflow.social.web;

import com.englishflow.social.domain.SocialException;
import org.junit.jupiter.api.Test;
import java.util.Base64;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ModerationCursorCodecTest {
    private final ModerationCursorCodec codec = new ModerationCursorCodec(
            "isolated-test-key-with-at-least-thirty-two-bytes");

    @Test
    void bindsCursorToTenantFilterAndServerSignature() {
        String cursor = codec.encode("tenant-a", "OPEN", 102L);
        assertEquals(102L, codec.decode(cursor, "tenant-a", "OPEN"));
        assertNotEquals(cursor, codec.encode("tenant-a", "OPEN", 102L), "each sealed cursor uses a fresh nonce");
        assertNotEquals("v1:OPEN:102", new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8),
                "the internal global sequence must not be visible in cursor bytes");
        assertEquals("MODERATION_CURSOR_INVALID", assertThrows(SocialException.class,
                () -> codec.decode(cursor, "tenant-b", "OPEN")).code());
        assertEquals("MODERATION_CURSOR_INVALID", assertThrows(SocialException.class,
                () -> codec.decode(cursor, "tenant-a", "RESOLVED")).code());
        assertEquals("MODERATION_CURSOR_INVALID", assertThrows(SocialException.class,
                () -> codec.decode(cursor.substring(0, cursor.length() - 2) + "AA", "tenant-a", "OPEN")).code());
        assertEquals("MODERATION_CURSOR_INVALID", assertThrows(SocialException.class,
                () -> codec.decode("not-a-cursor", "tenant-a", "OPEN")).code());
    }

    @Test
    void missingSigningKeyFailsClosedBeforeIssuingOrAcceptingCursor() {
        ModerationCursorCodec unconfigured = new ModerationCursorCodec("");
        assertEquals("MODERATION_CURSOR_UNAVAILABLE", assertThrows(SocialException.class,
                () -> unconfigured.encode("tenant-a", "OPEN", 1L)).code());
        assertEquals("MODERATION_CURSOR_UNAVAILABLE", assertThrows(SocialException.class,
                () -> unconfigured.decode("cursor", "tenant-a", "OPEN")).code());
    }

    @Test
    void opaqueReferencesAreStableOnlyWithinTheSameTenantAndKind() {
        String one = codec.reference("tenant-a", "subject", "subject-raw-1");
        assertEquals(one, codec.reference("tenant-a", "subject", "subject-raw-1"));
        assertNotEquals(one, codec.reference("tenant-b", "subject", "subject-raw-1"));
        assertNotEquals(one, codec.reference("tenant-a", "room", "subject-raw-1"));
    }
}
