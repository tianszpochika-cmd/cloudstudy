package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.domain.AuditEvent;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Repository
public final class InMemoryAuditEventRepository implements AuditEventRepository {

    private final CopyOnWriteArrayList<AuditEvent> events = new CopyOnWriteArrayList<>();

    @Override
    public AuditEvent append(AuditEvent event) {
        events.add(event);
        return event;
    }

    @Override
    public List<AuditEvent> findByActor(String tenantId, long userId) {
        return events.stream()
                .filter(event -> tenantId.equals(event.tenantId()) && userId == event.actorUserId())
                .toList();
    }
}
