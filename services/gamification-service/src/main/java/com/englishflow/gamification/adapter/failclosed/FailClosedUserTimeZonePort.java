package com.englishflow.gamification.adapter.failclosed;

import com.englishflow.gamification.domain.GamificationPersistenceException;
import com.englishflow.gamification.port.UserTimeZonePort;
import java.time.ZoneId;

/**
 * Prevents local-real from substituting a configured or process-local timezone for the
 * learner-owned profile fact. The learner profile integration must be durable before this port
 * can be enabled for real business traffic.
 */
public final class FailClosedUserTimeZonePort implements UserTimeZonePort {

    @Override
    public ZoneId zoneFor(String subjectId) {
        throw GamificationPersistenceException.localRealUnavailable(
                "learner-owned user timezone fact");
    }
}
