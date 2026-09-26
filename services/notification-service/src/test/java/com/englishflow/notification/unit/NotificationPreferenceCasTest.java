package com.englishflow.notification.unit;

import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.application.UpdatePreferenceCommand;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;
import com.englishflow.notification.domain.NotificationPreference;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NotificationPreferenceCasTest {

    private static final Instant NOW = Instant.parse("2026-09-25T00:00:00Z");

    @Test
    void inMemoryStoreRejectsStalePreferenceWrites() {
        var store = new InMemoryNotificationFactStore();
        var first = new NotificationPreference("platform", "learner-1", NotificationCategory.LEARNING,
                NotificationChannel.IN_APP, true, "zh-CN", 1, NotificationDndWindow.parse("23:00", "08:00"),
                NotificationFrequencyPolicy.IMMEDIATE, 1, NOW);

        assertTrue(store.compareAndSetPreference(first, 0));
        assertFalse(store.compareAndSetPreference(first, 0));

        var second = first.change(false, "zh-CN", 1, NotificationDndWindow.parse("22:00", "07:00"),
                NotificationFrequencyPolicy.WEEKLY_DIGEST, NOW.plusSeconds(1));
        assertFalse(store.compareAndSetPreference(second, 0));
        assertTrue(store.compareAndSetPreference(second, 1));
        assertEquals(2, store.findPreference("platform", "learner-1", NotificationCategory.LEARNING,
                NotificationChannel.IN_APP)
                .orElseThrow().version());
    }

    @Test
    void preferenceCommandRejectsMissingVersionSentinel() {
        assertThrows(RuntimeException.class, () -> new UpdatePreferenceCommand(
                "LEARNING", NotificationCategory.LEARNING, NotificationChannel.IN_APP, true, "zh-CN", 1,
                NotificationDndWindow.parse("23:00", "08:00"), NotificationFrequencyPolicy.IMMEDIATE, -1));
    }
}
