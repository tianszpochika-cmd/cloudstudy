package com.englishflow.social.web;

import java.util.Objects;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * M7-004 regression fix: local-real had no lease sweeper, so a dropped
 * session held its seat forever and rooms filled with dead leases. Every join
 * hands out leaseExpiresAt, which is the documented end of the seat; this
 * sweep enforces it the way the in-memory state machine does, moves the
 * member to LEFT, and auto-releases their running focus sessions.
 */
@Component
@Profile("local-real")
public final class SocialLocalRealLeaseSweeper {

    private final JdbcTemplate jdbc;

    public SocialLocalRealLeaseSweeper(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc is required");
    }

    @Scheduled(fixedDelayString = "${social.local-real-lease-sweeper-ms:30000}")
    public void sweepExpiredLeases() {
        jdbc.update("UPDATE soc_room_member m JOIN soc_seat_lease s ON s.tenant_id = m.tenant_id "
                        + "AND s.room_id = m.room_id AND s.subject_id = m.subject_id "
                        + "SET m.state = 'LEFT', m.presence_state = 'OFFLINE', m.left_at = UTC_TIMESTAMP(3) "
                        + "WHERE s.state = 'OCCUPIED' AND s.lease_expires_at < UTC_TIMESTAMP(3) AND m.state = 'ACTIVE'");
        jdbc.update("UPDATE soc_focus_state f JOIN soc_seat_lease s ON s.tenant_id = f.tenant_id "
                        + "AND s.room_id = f.room_id AND s.subject_id = f.subject_id "
                        + "SET f.state = 'AUTO_RELEASED', f.ended_at = UTC_TIMESTAMP(3) "
                        + "WHERE s.state = 'OCCUPIED' AND s.lease_expires_at < UTC_TIMESTAMP(3) AND f.state IN ('RUNNING', 'PAUSED')");
        jdbc.update("UPDATE soc_seat_lease SET subject_id = NULL, state = 'AVAILABLE', lease_id = NULL, "
                        + "lease_expires_at = NULL, released_at = UTC_TIMESTAMP(3), release_reason = 'LEASE_TIMEOUT' "
                        + "WHERE state = 'OCCUPIED' AND lease_expires_at < UTC_TIMESTAMP(3)");
    }
}
