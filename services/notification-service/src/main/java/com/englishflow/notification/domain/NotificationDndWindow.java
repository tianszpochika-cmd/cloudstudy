package com.englishflow.notification.domain;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Objects;

/** Local wall-clock quiet hours. The IANA zone is server-derived at the API boundary. */
public record NotificationDndWindow(LocalTime startLocalTime, LocalTime endLocalTime) {

    private static final DateTimeFormatter WIRE_TIME = DateTimeFormatter.ofPattern("HH:mm");

    public NotificationDndWindow {
        Objects.requireNonNull(startLocalTime, "startLocalTime");
        Objects.requireNonNull(endLocalTime, "endLocalTime");
        if (startLocalTime.getSecond() != 0 || startLocalTime.getNano() != 0
                || endLocalTime.getSecond() != 0 || endLocalTime.getNano() != 0) {
            throw NotificationDomainException.invalid("DND window must use minute precision");
        }
    }

    public static NotificationDndWindow parse(String start, String end) {
        try {
            // ISO_LOCAL_TIME also reads the seconds that Jackson may include in
            // a durable idempotency snapshot. HTTP validation still requires HH:mm.
            return new NotificationDndWindow(LocalTime.parse(start), LocalTime.parse(end));
        } catch (DateTimeParseException | NullPointerException exception) {
            throw NotificationDomainException.invalid("DND window time is invalid");
        }
    }

    public String startWireValue() { return WIRE_TIME.format(startLocalTime); }
    public String endWireValue() { return WIRE_TIME.format(endLocalTime); }

    /** Start inclusive, end exclusive; equal endpoints mean no quiet window. */
    public boolean contains(LocalTime time) {
        Objects.requireNonNull(time, "time");
        if (startLocalTime.equals(endLocalTime)) return false;
        if (startLocalTime.isBefore(endLocalTime)) {
            return !time.isBefore(startLocalTime) && time.isBefore(endLocalTime);
        }
        return !time.isBefore(startLocalTime) || time.isBefore(endLocalTime);
    }
}
