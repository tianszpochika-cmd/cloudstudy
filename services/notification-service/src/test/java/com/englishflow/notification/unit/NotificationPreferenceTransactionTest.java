package com.englishflow.notification.unit;

import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationConsentStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryNotificationSubscriptionStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationTemplateStore;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.UpdatePreferenceCommand;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationAuditEvent;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.port.NotificationAuditEventPort;
import com.englishflow.notification.port.NotificationFactStore;
import com.englishflow.notification.port.StoredIdempotency;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NotificationPreferenceTransactionTest {

    private static final Instant NOW = Instant.parse("2026-09-25T00:00:00Z");
    private static final String SCOPE = "preference:platform:learner-1";
    private static final String KEY = "preference-key-1";

    @Test
    void auditFailureRollsBackPreferenceAndIdempotencyBeforeRetry() {
        AtomicReference<NotificationPreference> preference = new AtomicReference<>();
        AtomicReference<StoredIdempotency> idempotency = new AtomicReference<>();
        NotificationFactStore store = mock(NotificationFactStore.class);
        when(store.findIdempotency(SCOPE, KEY)).thenAnswer(ignored -> Optional.ofNullable(idempotency.get()));
        when(store.findPreference("platform", "learner-1", NotificationCategory.LEARNING, NotificationChannel.IN_APP))
                .thenAnswer(ignored -> Optional.ofNullable(preference.get()));
        when(store.compareAndSetPreference(any(NotificationPreference.class), anyLong())).thenAnswer(invocation -> {
            NotificationPreference next = invocation.getArgument(0);
            long expectedVersion = invocation.getArgument(1);
            NotificationPreference previous = preference.get();
            long currentVersion = previous == null ? 0 : previous.version();
            if (currentVersion != expectedVersion) return false;
            preference.set(next);
            rollbackOnFailure(() -> preference.set(previous));
            return true;
        });
        doAnswer(invocation -> {
            StoredIdempotency previous = idempotency.get();
            idempotency.set(invocation.getArgument(2));
            rollbackOnFailure(() -> idempotency.set(previous));
            return null;
        }).when(store).saveIdempotency(anyString(), anyString(), any(StoredIdempotency.class));

        AtomicInteger auditAttempts = new AtomicInteger();
        NotificationAuditEventPort audit = mock(NotificationAuditEventPort.class);
        doAnswer(invocation -> {
            if (auditAttempts.getAndIncrement() == 0) throw new IllegalStateException("injected audit failure");
            return null;
        }).when(audit).append(any(NotificationAuditEvent.class));

        TransactionTemplate transaction = new TransactionTemplate(new TestTransactionManager());
        NotificationApplicationService service = service(store, audit, transaction);
        var context = NotificationPrincipalContext.authenticated("platform", "learner-1", "device-1");
        var command = new UpdatePreferenceCommand("LEARNING", NotificationCategory.LEARNING,
                NotificationChannel.IN_APP, true, "zh-CN", 1,
                NotificationDndWindow.parse("23:00", "08:00"), NotificationFrequencyPolicy.IMMEDIATE, 0);

        assertThrows(IllegalStateException.class, () -> service.updatePreference(context, command,
                new IdempotencyKey(KEY), new RequestMetadata("request-1", "trace-1")));
        assertNull(preference.get(), "preference fact must roll back when audit persistence fails");
        assertNull(idempotency.get(), "idempotency receipt must roll back with the preference fact");

        var retry = service.updatePreference(context, command,
                new IdempotencyKey(KEY), new RequestMetadata("request-1", "trace-1"));
        assertEquals(1, retry.version(), "retry with the original expectedVersion must be able to apply");
        assertEquals(retry, idempotency.get().value());
    }

    private static NotificationApplicationService service(NotificationFactStore store,
            NotificationAuditEventPort audit, TransactionTemplate transaction) {
        return new NotificationApplicationService(store, new InMemoryWorkflowPort(), new InMemoryDeliveryTransport(),
                new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(), new NotificationAccessPolicy(),
                Clock.fixed(NOW, ZoneOffset.UTC), 5, Duration.ofSeconds(30), audit,
                new InMemoryNotificationConsentStore(), new InMemoryNotificationSubscriptionStore(),
                new InMemoryNotificationTemplateStore(), transaction);
    }

    private static void rollbackOnFailure(Runnable rollback) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            throw new AssertionError("preference write escaped the transaction boundary");
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) rollback.run();
            }
        });
    }

    private static final class TestTransactionManager extends AbstractPlatformTransactionManager {

        @Override
        protected Object doGetTransaction() {
            return new Object();
        }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {
        }

        @Override
        protected void doCommit(DefaultTransactionStatus status) {
        }

        @Override
        protected void doRollback(DefaultTransactionStatus status) {
        }
    }
}
