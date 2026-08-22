package com.englishflow.adminops.support;

import java.time.Duration;
import java.time.Instant;

public enum SlaStatus {
    ON_TRACK,
    AT_RISK,
    BREACHED,
    PAUSED,
    RESOLVED;

    public static SlaStatus calculate(TicketState state, Instant dueAt, Instant now) {
        if (state == TicketState.RESOLVED || state == TicketState.CLOSED) {
            return RESOLVED;
        }
        if (state == TicketState.WAITING_CUSTOMER) {
            return PAUSED;
        }
        if (now.isAfter(dueAt)) {
            return BREACHED;
        }
        return Duration.between(now, dueAt).compareTo(Duration.ofHours(4)) <= 0 ? AT_RISK : ON_TRACK;
    }
}
