package com.englishflow.workflow.adapter.jdbc;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Job leases against real MySQL.
 *
 * <p>The property that matters cannot be tested in memory: two instances starting at the same moment must not
 * both run the job. The store decides with one conditional statement so the database arbitrates, and these
 * tests hold two holders against each other to show that only one wins — the loser is refused, and after the
 * lease expires the other may take it, which is what stops a crashed holder from blocking a job forever.
 */
@EnabledIfSystemProperty(named = "workflow.jdbc.integration", matches = "true")
class JdbcJobLeaseStoreIntegrationTest {

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

    private static String jobName() {
        return "probe-" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void oneOfTwoInstancesTakesTheLeaseAndTheOtherIsRefused() {
        JdbcTemplate jdbc = jdbc();
        String job = jobName();
        JdbcJobLeaseStore first = new JdbcJobLeaseStore(jdbc, "instance-a");
        JdbcJobLeaseStore second = new JdbcJobLeaseStore(jdbc, "instance-b");
        first.declare(job, "*/5 * * * *");

        JdbcJobLeaseStore.LeaseAttempt won = first.acquire(job, Duration.ofMinutes(5));
        JdbcJobLeaseStore.LeaseAttempt lost = second.acquire(job, Duration.ofMinutes(5));

        assertTrue(won.acquired(), "a free lease must be takeable");
        assertFalse(lost.acquired(), "a second instance must not take a lease that is running");
        assertTrue(lost.reason().contains("still running"), lost.reason());
        assertTrue(first.holds(job, "instance-a"), "the winner holds it, read back from the database");
        assertFalse(second.holds(job, "instance-b"));
    }

    @Test
    void anExpiredLeaseIsReclaimableSoACrashedHolderDoesNotBlockTheJobForever() {
        JdbcTemplate jdbc = jdbc();
        String job = jobName();
        JdbcJobLeaseStore crashed = new JdbcJobLeaseStore(jdbc, "instance-crashed");
        crashed.declare(job, "*/5 * * * *");
        assertTrue(crashed.acquire(job, Duration.ofSeconds(1)).acquired());

        // The holder never finished; its lease runs out.
        try {
            Thread.sleep(1_200L);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }

        JdbcJobLeaseStore healthy = new JdbcJobLeaseStore(jdbc, "instance-healthy");
        JdbcJobLeaseStore.LeaseAttempt reclaimed = healthy.acquire(job, Duration.ofMinutes(5));

        assertTrue(reclaimed.acquired(), "an expired lease has to be reclaimable");
        assertTrue(healthy.holds(job, "instance-healthy"));
    }

    @Test
    void theHolderMayRenewItsOwnLeaseAndFinishingReleasesIt() {
        JdbcTemplate jdbc = jdbc();
        String job = jobName();
        JdbcJobLeaseStore store = new JdbcJobLeaseStore(jdbc, "instance-a");
        store.declare(job, "*/5 * * * *");
        assertTrue(store.acquire(job, Duration.ofMinutes(5)).acquired());

        assertTrue(store.acquire(job, Duration.ofMinutes(5)).acquired(), "the holder may renew");
        store.finish(job, "SUCCEEDED", null, Instant.now().plusSeconds(300));

        assertFalse(store.holds(job, "instance-a"), "finishing releases the lease");
        assertTrue(store.describe(job).orElseThrow().contains("SUCCEEDED"));
        // The attempt count is incremented on acquire, so a job that kills its process shows repeated
        // attempts rather than looking like it never ran.
        assertTrue(store.describe(job).orElseThrow().contains("|2|"), store.describe(job).orElseThrow());
    }

    @Test
    void aDisabledJobIsNotAcquiredAndSaysWhy() {
        JdbcTemplate jdbc = jdbc();
        String job = jobName();
        JdbcJobLeaseStore store = new JdbcJobLeaseStore(jdbc, "instance-a");
        store.declare(job, "*/5 * * * *");
        jdbc.update("UPDATE workflow_service.scheduled_job SET enabled = 0 WHERE job_name = ?", job);

        JdbcJobLeaseStore.LeaseAttempt refused = store.acquire(job, Duration.ofMinutes(5));

        assertFalse(refused.acquired());
        assertEquals("job is disabled", refused.reason());
    }

    @Test
    void anUnknownJobIsRefusedRatherThanSilentlyCreated() {
        JdbcTemplate jdbc = jdbc();
        JdbcJobLeaseStore store = new JdbcJobLeaseStore(jdbc, "instance-a");

        JdbcJobLeaseStore.LeaseAttempt refused = store.acquire("never-declared-" + UUID.randomUUID(), Duration.ofMinutes(5));

        assertFalse(refused.acquired());
        assertEquals("no such job", refused.reason());
    }
}
