package com.englishflow.media.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Copyright/license reference evaluated on every media read.
 * It is never inferred client-side — a missing or non-active right always denies.
 */
class MediaRightsReferenceTest {

    private static final Instant NOW = Instant.parse("2026-09-10T00:00:00Z");
    private static final Instant START = NOW.minusSeconds(3600);
    private static final Instant EXPIRY = NOW.plusSeconds(3600);

    private static String codeOf(Throwable thrown) {
        assertThat(thrown).isInstanceOf(MediaOperationException.class);
        return ((MediaOperationException) thrown).code();
    }

    private static MediaRightsReference rights(MediaRightsStatus status, Set<String> channels,
                                               Instant startsAt, Instant expiresAt, boolean allowOffline,
                                               String evidenceRef) {
        return new MediaRightsReference("rights-1", "cv-1", "LIC-1",
                status, channels, startsAt, expiresAt, allowOffline, evidenceRef);
    }

    private static MediaRightsReference active(Set<String> channels, boolean allowOffline) {
        return rights(MediaRightsStatus.ACTIVE, channels, START, EXPIRY, allowOffline, "evidence-1");
    }

    // --- construction guards ---

    @Test
    void activeRightsRequireAuthorizationEvidence() {
        assertThatThrownBy(() -> rights(MediaRightsStatus.ACTIVE, Set.of("STREAM"), START, EXPIRY, false, null))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_RIGHTS_EVIDENCE_REQUIRED"));
    }

    @Test
    void nonActiveRightsDoNotRequireEvidence() {
        assertThat(rights(MediaRightsStatus.PENDING, Set.of("STREAM"), START, EXPIRY, false, null))
                .isNotNull();
    }

    @Test
    void missingRightsStatusIsRejected() {
        assertThatThrownBy(() -> rights(null, Set.of("STREAM"), START, EXPIRY, false, "evidence-1"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_RIGHTS_INVALID"));
    }

    @Test
    void expiryMustBeStrictlyAfterStart() {
        assertThatThrownBy(() -> rights(MediaRightsStatus.ACTIVE, Set.of("STREAM"), NOW, NOW, false, "evidence-1"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_RIGHTS_WINDOW_INVALID"));
        assertThatThrownBy(() -> rights(MediaRightsStatus.ACTIVE, Set.of("STREAM"), NOW, NOW.minusSeconds(1), false, "evidence-1"))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo("MEDIA_RIGHTS_WINDOW_INVALID"));
    }

    @Test
    void permittedChannelsAreNormalizedToUpperCase() {
        assertThat(rights(MediaRightsStatus.ACTIVE, Set.of("stream"), START, EXPIRY, false, "evidence-1")
                .permittedChannels()).containsExactly("STREAM");
    }

    // --- allows(): null and status gates ---

    @Test
    void nullChannelNeverAllows() {
        assertThat(active(Set.of("STREAM"), false).allows(null, NOW)).isFalse();
    }

    @Test
    void nullNowNeverAllows() {
        assertThat(active(Set.of("STREAM"), false).allows(MediaDeliveryChannel.STREAM, null)).isFalse();
    }

    @Test
    void onlyActiveRightsAllowDelivery() {
        for (MediaRightsStatus status : MediaRightsStatus.values()) {
            boolean allowed = rights(status, Set.of("STREAM"), START, EXPIRY, false, "evidence-1")
                    .allows(MediaDeliveryChannel.STREAM, NOW);
            assertThat(allowed).as("status=%s", status).isEqualTo(status == MediaRightsStatus.ACTIVE);
        }
    }

    // --- allows(): channel gating ---

    @Test
    void channelMustBeInPermittedList() {
        MediaRightsReference streamOnly = active(Set.of("STREAM"), false);

        assertThat(streamOnly.allows(MediaDeliveryChannel.STREAM, NOW)).isTrue();
        assertThat(streamOnly.allows(MediaDeliveryChannel.DOWNLOAD, NOW)).isFalse();
        assertThat(streamOnly.allows(MediaDeliveryChannel.PREVIEW, NOW)).isFalse();
    }

    @Test
    void wildcardPermitsEveryChannel() {
        MediaRightsReference wildcard = active(Set.of("*"), false);

        assertThat(wildcard.allows(MediaDeliveryChannel.STREAM, NOW)).isTrue();
        assertThat(wildcard.allows(MediaDeliveryChannel.DOWNLOAD, NOW)).isTrue();
        assertThat(wildcard.allows(MediaDeliveryChannel.PREVIEW, NOW)).isTrue();
        assertThat(wildcard.allows(MediaDeliveryChannel.RECORDING, NOW)).isTrue();
    }

    // --- allows(): time window ---

    @Test
    void deliveryBeforeStartIsDenied() {
        assertThat(active(Set.of("STREAM"), false).allows(MediaDeliveryChannel.STREAM, START.minusSeconds(1)))
                .isFalse();
    }

    @Test
    void deliveryAtExactStartIsAllowed() {
        assertThat(active(Set.of("STREAM"), false).allows(MediaDeliveryChannel.STREAM, START)).isTrue();
    }

    @Test
    void deliveryJustBeforeExpiryIsAllowed() {
        assertThat(active(Set.of("STREAM"), false)
                .allows(MediaDeliveryChannel.STREAM, EXPIRY.minusMillis(1))).isTrue();
    }

    @Test
    void deliveryAtExactExpiryIsDenied() {
        // half-open window: [startsAt, expiresAt)
        assertThat(active(Set.of("STREAM"), false).allows(MediaDeliveryChannel.STREAM, EXPIRY)).isFalse();
    }

    @Test
    void deliveryAfterExpiryIsDenied() {
        assertThat(active(Set.of("STREAM"), false).allows(MediaDeliveryChannel.STREAM, EXPIRY.plusSeconds(1)))
                .isFalse();
    }

    @Test
    void openEndedRightsHaveNoExpiry() {
        MediaRightsReference openEnded = rights(MediaRightsStatus.ACTIVE, Set.of("STREAM"),
                START, null, false, "evidence-1");

        assertThat(openEnded.allows(MediaDeliveryChannel.STREAM, NOW.plusSeconds(86_400 * 365))).isTrue();
    }

    // --- allows(): offline gate ---

    @Test
    void offlineDeliveryRequiresAllowOfflineFlag() {
        assertThat(active(Set.of("*"), false).allows(MediaDeliveryChannel.OFFLINE, NOW)).isFalse();
        assertThat(active(Set.of("*"), true).allows(MediaDeliveryChannel.OFFLINE, NOW)).isTrue();
    }

    @Test
    void allowOfflineDoesNotGrantNonPermittedOnlineChannel() {
        MediaRightsReference streamOnlyOffline = active(Set.of("STREAM"), true);

        assertThat(streamOnlyOffline.allows(MediaDeliveryChannel.OFFLINE, NOW)).isFalse(); // not permitted
        assertThat(streamOnlyOffline.allows(MediaDeliveryChannel.STREAM, NOW)).isTrue();
    }
}
