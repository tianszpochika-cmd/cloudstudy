package com.englishflow.adminops.domain;

import java.util.List;

public interface AuditTrail {

    AuditRecord append(AuditEvent event);

    List<AuditRecord> snapshot();

    AuditPage page(String tenantRef, Long beforeSequence, int pageSize);
}
