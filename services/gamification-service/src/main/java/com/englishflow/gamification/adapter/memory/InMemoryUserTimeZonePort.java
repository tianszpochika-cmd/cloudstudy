package com.englishflow.gamification.adapter.memory;

import com.englishflow.gamification.port.UserTimeZonePort;
import java.time.ZoneId;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/** Test/dev profile adapter; a production adapter reads the learner-owned profile fact. */
public final class InMemoryUserTimeZonePort implements UserTimeZonePort {

    private final ZoneId defaultZone;
    private final ConcurrentHashMap<String, ZoneId> zones = new ConcurrentHashMap<>();

    public InMemoryUserTimeZonePort(ZoneId defaultZone) {
        this.defaultZone = Objects.requireNonNull(defaultZone, "defaultZone");
    }

    @Override
    public ZoneId zoneFor(String subjectId) {
        return zones.getOrDefault(subjectId, defaultZone);
    }

    public void setZone(String subjectId, ZoneId zone) {
        zones.put(subjectId, Objects.requireNonNull(zone, "zone"));
    }
}
