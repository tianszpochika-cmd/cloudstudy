package com.englishflow.modules.user.repository;

import com.englishflow.modules.user.domain.AuditEvent;

import java.util.List;

public interface AuditEventRepository {

    AuditEvent append(AuditEvent event);

    List<AuditEvent> findByActor(String tenantId, long userId);
}
