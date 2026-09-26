package com.englishflow.notification.unit;

import tools.jackson.databind.ObjectMapper;
import com.englishflow.notification.adapter.jdbc.JdbcNotificationFactStore;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;
import com.englishflow.notification.domain.NotificationPreference;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

class JdbcNotificationPreferenceCasTest {

    @Test
    void insertCasWritesCanonicalPreferenceColumns() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        var store = new JdbcNotificationFactStore(jdbc, new ObjectMapper());
        var preference = preference(1);

        assertTrue(store.compareAndSetPreference(preference, 0));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> parameters = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(sql.capture(), parameters.capture());
        assertTrue(sql.getValue().contains("category, channel, enabled, locale, consent_version"));
        assertTrue(sql.getValue().contains("dnd_start_local_time, dnd_end_local_time, frequency_policy"));
        assertEquals("REVIEW", parameters.getValue()[2]);
        assertEquals(3, parameters.getValue()[6]);
        assertEquals("WEEKLY_DIGEST", parameters.getValue()[9]);
    }

    @Test
    void updateCasPinsCanonicalOwnerKeyAndExpectedVersion() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        var store = new JdbcNotificationFactStore(jdbc, new ObjectMapper());

        assertTrue(store.compareAndSetPreference(preference(2), 1));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> parameters = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(sql.capture(), parameters.capture());
        assertTrue(sql.getValue().contains("WHERE tenant_id = ? AND principal_id = ? AND category = ? AND channel = ?"));
        assertTrue(sql.getValue().contains("AND version_no = ?"));
        Object[] values = parameters.getValue();
        assertEquals("tenant-1", values[8]);
        assertEquals("learner-1", values[9]);
        assertEquals("REVIEW", values[10]);
        assertEquals("PUSH", values[11]);
        assertEquals(1L, values[12]);
    }

    private static NotificationPreference preference(long version) {
        return new NotificationPreference("tenant-1", "learner-1", NotificationCategory.REVIEW,
                NotificationChannel.PUSH, true, "zh-CN", 3,
                NotificationDndWindow.parse("22:00", "07:00"), NotificationFrequencyPolicy.WEEKLY_DIGEST,
                version, Instant.parse("2026-09-25T12:00:00Z"));
    }
}
