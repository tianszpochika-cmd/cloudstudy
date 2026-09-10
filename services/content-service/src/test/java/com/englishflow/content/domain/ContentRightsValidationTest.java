package com.englishflow.content.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Copyright/licence rule tests: validity, channel scope, time window and fail-closed semantics. */
@DisplayName("ContentRights validation and channel rules")
class ContentRightsValidationTest {

    private static final Instant NOW = Instant.parse("2026-08-22T00:00:00Z");

    private static ContentRights rights(
            CopyrightStatus status, boolean learning, Set<String> channels, Instant start, Instant expire, String evidence) {
        return new ContentRights("src", "lic", status, learning, channels, start, expire, evidence);
    }

    @Test
    @DisplayName("active rights within window allow the permitted channels")
    void activeRightsAllowPermittedChannels() {
        ContentRights rights = rights(CopyrightStatus.ACTIVE, true,
                Set.of("PUBLIC", "LEARNER", "ASSESSMENT"), NOW.minusSeconds(60), null, "evidence-1");
        assertTrue(rights.allows(ContentChannel.PUBLIC, NOW));
        assertTrue(rights.allows(ContentChannel.LEARNER, NOW));
        assertTrue(rights.allows(ContentChannel.ASSESSMENT, NOW));
        assertTrue(rights.isActive(NOW));
    }

    @Test
    @DisplayName("the wildcard channel grants every channel")
    void wildcardChannelGrantsAll() {
        ContentRights rights = rights(CopyrightStatus.ACTIVE, true,
                Set.of("*"), NOW.minusSeconds(60), null, "evidence-1");
        assertTrue(rights.allows(ContentChannel.PUBLIC, NOW));
        assertTrue(rights.allows(ContentChannel.ADMIN, NOW));
        assertTrue(rights.allows(ContentChannel.ASSESSMENT, NOW));
    }

    @Test
    @DisplayName("expired rights deny every channel")
    void expiredRightsDeny() {
        ContentRights rights = rights(CopyrightStatus.ACTIVE, true,
                Set.of("PUBLIC"), NOW.minusSeconds(120), NOW.minusSeconds(60), "evidence-1");
        assertFalse(rights.allows(ContentChannel.PUBLIC, NOW));
        assertFalse(rights.isActive(NOW));
    }

    @Test
    @DisplayName("rights that have not started yet deny every channel")
    void notYetStartedRightsDeny() {
        ContentRights rights = rights(CopyrightStatus.ACTIVE, true,
                Set.of("PUBLIC"), NOW.plusSeconds(60), null, "evidence-1");
        assertFalse(rights.allows(ContentChannel.PUBLIC, NOW));
        assertFalse(rights.isActive(NOW));
    }

    @Test
    @DisplayName("revoked copyright status denies every channel")
    void revokedRightsDeny() {
        ContentRights rights = rights(CopyrightStatus.REVOKED, true,
                Set.of("PUBLIC"), NOW.minusSeconds(60), null, "evidence-1");
        assertFalse(rights.allows(ContentChannel.PUBLIC, NOW));
    }

    @Test
    @DisplayName("channels that are not granted deny the request")
    void ungrantedChannelDenies() {
        ContentRights rights = rights(CopyrightStatus.ACTIVE, true,
                Set.of("PUBLIC"), NOW.minusSeconds(60), null, "evidence-1");
        assertFalse(rights.allows(ContentChannel.ASSESSMENT, NOW));
    }

    @Test
    @DisplayName("learning rights require authorization evidence")
    void learningRequiresEvidence() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> rights(CopyrightStatus.ACTIVE, true, Set.of("PUBLIC"), null, null, null));
        assertEquals("CONTENT_RIGHTS_EVIDENCE_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("a reversed time window is rejected")
    void reversedWindowRejected() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> rights(CopyrightStatus.ACTIVE, false, Set.of("PUBLIC"),
                        NOW.plusSeconds(60), NOW.minusSeconds(60), null));
        assertEquals("CONTENT_RIGHTS_WINDOW_INVALID", ex.code());
    }

    @Test
    @DisplayName("permitted channels are required")
    void emptyChannelsRejected() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> rights(CopyrightStatus.ACTIVE, false, Set.of(), null, null, null));
        assertEquals("CONTENT_RIGHTS_CHANNELS_REQUIRED", ex.code());
    }

    @Test
    @DisplayName("a blank channel value is rejected")
    void blankChannelRejected() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> rights(CopyrightStatus.ACTIVE, false, Set.of("PUBLIC", " "), null, null, null));
        assertEquals("CONTENT_RIGHTS_CHANNELS_INVALID", ex.code());
    }

    @Test
    @DisplayName("source and license codes are required")
    void missingSourceOrLicenseRejected() {
        ContentOperationException ex = assertThrows(ContentOperationException.class,
                () -> new ContentRights(null, "lic", CopyrightStatus.ACTIVE, false,
                        Set.of("PUBLIC"), null, null, null));
        assertEquals("CONTENT_RIGHTS_INVALID", ex.code());
    }

    @Test
    @DisplayName("channel names are normalized to upper case")
    void channelNamesNormalized() {
        ContentRights rights = new ContentRights("src", "lic", CopyrightStatus.ACTIVE, true,
                Set.of("public", "Learner"), NOW.minusSeconds(60), null, "evidence-1");
        assertTrue(rights.allows(ContentChannel.PUBLIC, NOW));
        assertTrue(rights.allows(ContentChannel.LEARNER, NOW));
    }

    @Test
    @DisplayName("channel list is immutable after construction")
    void channelsImmutable() {
        Set<String> channels = new java.util.HashSet<>(List.of("PUBLIC"));
        ContentRights rights = rights(CopyrightStatus.ACTIVE, false, channels, null, null, null);
        channels.add("LEARNER");
        assertFalse(rights.allows(ContentChannel.LEARNER, NOW), "external mutation must not change granted channels");
    }
}
