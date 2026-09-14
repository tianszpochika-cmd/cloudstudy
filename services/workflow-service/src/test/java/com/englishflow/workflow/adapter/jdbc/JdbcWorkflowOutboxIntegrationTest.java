package com.englishflow.workflow.adapter.jdbc;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The outbox against real MySQL.
 *
 * <p>The property under test is exclusivity, and it cannot be shown in memory: two relays claiming at once
 * must take different rows. A read followed by a write would let both see the same pending row and publish it
 * twice, which is exactly the duplicate the outbox exists to prevent. The claim therefore locks what it
 * selects and skips what another relay holds, and this test holds two relays against each other.
 */
@EnabledIfSystemProperty(named = "workflow.jdbc.integration", matches = "true")
class JdbcWorkflowOutboxIntegrationTest {

    private static JdbcTemplate jdbc() {
        DriverManagerDataSource source = new DriverManagerDataSource(
                required("WORKFLOW_JDBC_TEST_JDBC_URL"), required("WORKFLOW_JDBC_TEST_USERNAME"),
                System.getenv().getOrDefault("WORKFLOW_JDBC_TEST_PASSWORD", ""));
        return new JdbcTemplate(source);
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required");
        }
        return value;
    }


    /**
     * Appends an event and remembers it so the test can remove it again.
     *
     * <p>These tests write to a shared table, and earlier runs left pending rows behind, so a claim cannot
     * assume the newest row is the one it will receive. Each test finds its own event in a batch and deletes
     * it afterwards rather than changing the claim order to suit the test.
     */
    private final java.util.List<String> appended = new java.util.ArrayList<>();

    private String appendTracked(JdbcWorkflowOutbox outbox) {
        String eventId = outbox.append("aggregate-" + UUID.randomUUID(), "workflow.probe.v1", "1.0",
                "dedupe-" + UUID.randomUUID(), "{\"probe\":true}");
        appended.add(eventId);
        return eventId;
    }

    @org.junit.jupiter.api.AfterEach
    void removeWhatThisTestAppended() {
        JdbcTemplate jdbc = jdbc();
        for (String eventId : appended) {
            jdbc.update("DELETE FROM workflow_service.workflow_outbox_event WHERE event_id = ?", eventId);
        }
        appended.clear();
    }

    /** Claims in batches until the wanted event appears, so other pending rows do not confuse the test. */
    private static JdbcWorkflowOutbox.ClaimedEvent claimUntil(JdbcWorkflowOutbox outbox, String wanted) {
        return claimUntil(outbox, wanted, 60);
    }

    /** The same, with the lease length the caller needs: an expiry test has to be able to ask for a short one. */
    private static JdbcWorkflowOutbox.ClaimedEvent claimUntil(JdbcWorkflowOutbox outbox, String wanted, int leaseSeconds) {
        for (int attempt = 0; attempt < 20; attempt += 1) {
            List<JdbcWorkflowOutbox.ClaimedEvent> batch = outbox.claim(20, leaseSeconds);
            if (batch.isEmpty()) return null;
            for (JdbcWorkflowOutbox.ClaimedEvent event : batch) {
                if (event.eventId().equals(wanted)) return event;
            }
        }
        return null;
    }

    /** Whether a claim returns the given event at all. */
    private static boolean claims(JdbcWorkflowOutbox outbox, String wanted) {
        return claimUntil(outbox, wanted) != null;
    }

    @Test
    void twoRelaysClaimingAtOnceTakeDifferentEvents() {
        JdbcTemplate jdbc = jdbc();
        JdbcWorkflowOutbox first = new JdbcWorkflowOutbox(jdbc, "relay-a");
        JdbcWorkflowOutbox second = new JdbcWorkflowOutbox(jdbc, "relay-b");
        String left = appendTracked(first);
        String right = appendTracked(first);

        // Exactly one row each, so neither relay can take both and the two claims must cover the two events
        // this test appended rather than some leftover from an earlier run.
        List<JdbcWorkflowOutbox.ClaimedEvent> a = first.claim(1, 60);
        List<JdbcWorkflowOutbox.ClaimedEvent> b = second.claim(1, 60);

        assertEquals(1, a.size(), "the first relay should claim one event");
        assertEquals(1, b.size(), "the second relay should claim one event");
        assertFalse(a.getFirst().eventId().equals(b.getFirst().eventId()),
                "two relays must not claim the same event");
        List<String> taken = List.of(a.getFirst().eventId(), b.getFirst().eventId());
        assertTrue(taken.contains(left) && taken.contains(right),
                "the two claims have to cover the two events this test appended: took " + taken + " for " + left + " and " + right);
    }

    @Test
    void aPublishedEventIsNotClaimedAgain() {
        JdbcTemplate jdbc = jdbc();
        JdbcWorkflowOutbox outbox = new JdbcWorkflowOutbox(jdbc, "relay-a");
        String eventId = appendTracked(outbox);

        assertNotNull(claimUntil(outbox, eventId), "the appended event should be claimable");
        assertTrue(outbox.markPublished(eventId));
        assertTrue(outbox.statusOf(eventId).startsWith("PUBLISHED"), outbox.statusOf(eventId));

        // Claiming again must not return it: a published event is done.
        assertFalse(claims(outbox, eventId), "a published event must not be claimed a second time");
    }

    @Test
    void markPublishedOnlyAppliesToAClaimedEvent() {
        JdbcTemplate jdbc = jdbc();
        JdbcWorkflowOutbox outbox = new JdbcWorkflowOutbox(jdbc, "relay-a");
        String eventId = appendTracked(outbox);

        // Not claimed yet, so publishing it would be a claim about work that was never taken.
        assertFalse(outbox.markPublished(eventId), "an unclaimed event must not be markable as published");
        assertTrue(outbox.statusOf(eventId).startsWith("PENDING"), outbox.statusOf(eventId));
    }

    @Test
    void aFailedPublishIsRecordedAndMadeAvailableAgainAfterABackoff() {
        JdbcTemplate jdbc = jdbc();
        JdbcWorkflowOutbox outbox = new JdbcWorkflowOutbox(jdbc, "relay-a");
        String eventId = appendTracked(outbox);
        assertNotNull(claimUntil(outbox, eventId), "the appended event should be claimable");

        assertTrue(outbox.markFailed(eventId, "BROKER_TIMEOUT", "the broker did not answer", 60));

        String status = outbox.statusOf(eventId);
        assertTrue(status.startsWith("PENDING"), status);
        // The attempt is counted here rather than on publish, so a relay that dies mid-run still shows it tried.
        assertTrue(status.endsWith("|1"), status);
        // The backoff means it is not immediately claimable, which is what stops a tight retry loop.
        assertFalse(claims(outbox, eventId), "a backed-off event must not be claimed again straight away");
    }

    @Test
    void claimsWhoseHolderNeverCameBackAreReleased() {
        JdbcTemplate jdbc = jdbc();
        JdbcWorkflowOutbox crashed = new JdbcWorkflowOutbox(jdbc, "relay-crashed");
        String eventId = appendTracked(crashed);
        // A one-second lease, taken through the helper with that length rather than the default sixty: the
        // earlier version asked for one second and then claimed with sixty, so the row was still held.
        assertNotNull(claimUntil(crashed, eventId, 1), "the appended event should be claimable");
        assertTrue(crashed.statusOf(eventId).startsWith("CLAIMED"));

        // The holder never returned; its lease runs out.
        try {
            // Two and a half seconds against a one-second lease: the earlier margin was too tight and the row
            // had not expired when the assertion ran.
            Thread.sleep(2_500L);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }

        String before = jdbc.queryForObject(
                "SELECT CONCAT(status, '|', IFNULL(locked_until,'null'), '|', UTC_TIMESTAMP(6)) FROM workflow_service.workflow_outbox_event WHERE event_id = ?",
                String.class, eventId);
        assertTrue(crashed.releaseExpiredClaims() >= 1,
                "at least the expired claim should be released; row was " + before);
        assertTrue(crashed.statusOf(eventId).startsWith("PENDING"), crashed.statusOf(eventId));
    }
}
