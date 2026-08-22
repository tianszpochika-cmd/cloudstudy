package com.englishflow.gamification.domain;

import java.time.LocalDate;
import java.time.ZoneId;

public record StreakProjection(
        String timeZone,
        LocalDate latestActiveDate,
        int currentStreak,
        int longestStreak,
        int activeDateCount) {

    public static StreakProjection from(ZoneId zone, java.util.Set<LocalDate> activeDates) {
        if (activeDates.isEmpty()) {
            return new StreakProjection(zone.getId(), null, 0, 0, 0);
        }
        LocalDate latest = activeDates.stream().max(LocalDate::compareTo).orElseThrow();
        int current = consecutiveEndingAt(activeDates, latest);
        int longest = 0;
        for (LocalDate date : activeDates) {
            longest = Math.max(longest, consecutiveEndingAt(activeDates, date));
        }
        return new StreakProjection(zone.getId(), latest, current, longest, activeDates.size());
    }

    private static int consecutiveEndingAt(java.util.Set<LocalDate> dates, LocalDate end) {
        int count = 0;
        LocalDate cursor = end;
        while (dates.contains(cursor)) {
            count++;
            cursor = cursor.minusDays(1);
        }
        return count;
    }
}
