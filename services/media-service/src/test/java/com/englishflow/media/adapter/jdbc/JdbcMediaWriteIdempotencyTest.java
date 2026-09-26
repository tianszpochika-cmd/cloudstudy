package com.englishflow.media.adapter.jdbc;

import com.englishflow.media.application.MediaWriteFingerprint;
import com.englishflow.media.domain.MediaAuthorizationContext;
import com.englishflow.media.domain.MediaOperationException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JdbcMediaWriteIdempotencyTest {

    @Test
    void concurrentInstancesCommitOneMutationAndReplayOriginalResponse() throws Exception {
        Fixture fixture = new Fixture();
        fixture.jdbc.update("INSERT INTO media_asset(asset_id, asset_version) VALUES ('asset-1', 1)");
        CountDownLatch firstEntered = new CountDownLatch(1);
        CountDownLatch allowFirst = new CountDownLatch(1);
        var first = CompletableFuture.supplyAsync(() -> fixture.first.execute(
                "activate", "asset-1", Map.of("checksum", "sha-a"), fixture.principal,
                "activate-key-001", () -> {}, () -> {
                    firstEntered.countDown();
                    await(allowFirst);
                    return fixture.mutate();
                }));
        assertTrue(firstEntered.await(5, TimeUnit.SECONDS));
        var second = CompletableFuture.supplyAsync(() -> fixture.second.execute(
                "activate", "asset-1", Map.of("checksum", "sha-a"), fixture.principal,
                "activate-key-001", () -> {}, fixture::mutate));
        allowFirst.countDown();
        assertEquals(first.get(5, TimeUnit.SECONDS), second.get(5, TimeUnit.SECONDS));
        assertEquals(2, fixture.version());
        assertEquals(1, fixture.eventCount());
        assertEquals(1, fixture.receiptCount());
        assertEquals("MEDIA_IDEMPOTENCY_CONFLICT", assertThrows(MediaOperationException.class,
                () -> fixture.second.execute("activate", "asset-1", Map.of("checksum", "sha-b"),
                        fixture.principal, "activate-key-001", () -> {}, fixture::mutate)).code());
        assertEquals(1, fixture.eventCount());
    }

    @Test
    void failedCommandRollsBackAssetEventAndClaim() {
        Fixture fixture = new Fixture();
        fixture.jdbc.update("INSERT INTO media_asset(asset_id, asset_version) VALUES ('asset-1', 1)");
        assertThrows(IllegalStateException.class, () -> fixture.first.execute(
                "retry", "asset-1", Map.of(), fixture.principal,
                "retry-key-001", () -> {}, () -> {
                    fixture.mutate();
                    throw new IllegalStateException("simulated outbox failure");
                }));
        assertEquals(1, fixture.version());
        assertEquals(0, fixture.eventCount());
        assertEquals(0, fixture.receiptCount());
        assertEquals(2, ((Number) ((Map<?, ?>) fixture.second.execute(
                "retry", "asset-1", Map.of(), fixture.principal,
                "retry-key-001", () -> {}, fixture::mutate).get("asset")).get("assetVersion")).intValue());
        assertEquals(1, fixture.eventCount());
    }

    @Test
    void authorizationIsRecheckedBeforeStoredResponseIsReturned() {
        Fixture fixture = new Fixture();
        fixture.jdbc.update("INSERT INTO media_asset(asset_id, asset_version) VALUES ('asset-1', 1)");
        fixture.first.execute("subtitle", "asset-1", Map.of("locale", "zh-CN"), fixture.principal,
                "subtitle-key-001", () -> {}, fixture::mutate);
        assertThrows(MediaOperationException.class, () -> fixture.second.execute(
                "subtitle", "asset-1", Map.of("locale", "zh-CN"), fixture.principal,
                "subtitle-key-001", () -> { throw MediaOperationException.forbidden(
                        "MEDIA_WRITE_FORBIDDEN", "permission revoked"); }, fixture::mutate));
        assertEquals(1, fixture.eventCount());
    }

    @Test
    void digestIgnoresChannelSetOrderAndRejectsUnsafeKeys() {
        assertEquals(
                MediaWriteFingerprint.digest("asset-1", Map.of("permittedChannels", Set.of("STREAM", "DOWNLOAD"))),
                MediaWriteFingerprint.digest("asset-1", Map.of("permittedChannels", Set.of("DOWNLOAD", "STREAM"))));
        assertThrows(MediaOperationException.class, () -> MediaWriteFingerprint.key("short"));
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("test latch timed out");
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(interrupted);
        }
    }

    private static final class Fixture {
        final JdbcDataSource dataSource = new JdbcDataSource();
        final JdbcTemplate jdbc;
        final JdbcMediaWriteIdempotency first;
        final JdbcMediaWriteIdempotency second;
        final MediaAuthorizationContext principal = MediaAuthorizationContext.verified(
                "owner-1", "tenant-1", Set.of("learner"), Set.of("media:write"),
                "PHASE_1", Set.of(), true, true, "request-1");

        Fixture() {
            dataSource.setURL("jdbc:h2:mem:media-idem-" + java.util.UUID.randomUUID()
                    + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
            jdbc = new JdbcTemplate(dataSource);
            jdbc.execute("CREATE SCHEMA media_owner");
            jdbc.execute("CREATE TABLE media_owner.media_write_idempotency_record ("
                    + "tenant_id VARCHAR(128) NOT NULL, subject_id VARCHAR(128) NOT NULL, "
                    + "operation_name VARCHAR(64) NOT NULL, idempotency_key VARCHAR(128) NOT NULL, "
                    + "request_fingerprint CHAR(64) NOT NULL, response_json CLOB, "
                    + "created_at TIMESTAMP NOT NULL, "
                    + "PRIMARY KEY(tenant_id, subject_id, operation_name, idempotency_key))");
            jdbc.execute("CREATE TABLE media_asset (asset_id VARCHAR(36) PRIMARY KEY, asset_version INT NOT NULL)");
            jdbc.execute("CREATE TABLE media_outbox_event (event_id INT AUTO_INCREMENT PRIMARY KEY, asset_id VARCHAR(36))");
            ObjectMapper mapper = new ObjectMapper();
            first = new JdbcMediaWriteIdempotency(jdbc, dataSource, "media_owner", mapper);
            second = new JdbcMediaWriteIdempotency(jdbc, dataSource, "media_owner", mapper);
        }

        Map<String, Object> mutate() {
            jdbc.update("UPDATE media_asset SET asset_version = asset_version + 1 WHERE asset_id = 'asset-1'");
            jdbc.update("INSERT INTO media_outbox_event(asset_id) VALUES ('asset-1')");
            return Map.of("asset", Map.of("assetVersion", version()));
        }

        int version() {
            return jdbc.queryForObject("SELECT asset_version FROM media_asset WHERE asset_id = 'asset-1'", Integer.class);
        }

        int eventCount() {
            return jdbc.queryForObject("SELECT COUNT(*) FROM media_outbox_event", Integer.class);
        }

        int receiptCount() {
            return jdbc.queryForObject("SELECT COUNT(*) FROM media_owner.media_write_idempotency_record", Integer.class);
        }
    }
}
