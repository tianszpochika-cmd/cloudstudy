package com.englishflow.gamification.port;

import java.time.ZoneId;

/** Reads the user-owned timezone fact; event payload timezone is never accepted. */
public interface UserTimeZonePort {

    ZoneId zoneFor(String subjectId);
}
