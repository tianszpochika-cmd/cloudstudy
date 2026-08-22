package com.englishflow.adminops.adapter.memory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.englishflow.adminops.domain.AdminPep;
import com.englishflow.adminops.domain.AdminPrincipal;
import com.englishflow.adminops.domain.AdminProjectionPort;
import com.englishflow.adminops.domain.ProjectionQuery;
import com.englishflow.adminops.domain.ProjectionRecord;

/**
 * Test/development read-model adapter. It has no domain write method and is intentionally
 * replaceable by a content/commerce/learner projection client.
 */
public final class InMemoryAdminProjection implements AdminProjectionPort {

    private final AdminPep pep = new AdminPep();
    private final List<ProjectionRecord> records = new ArrayList<>();

    public synchronized InMemoryAdminProjection seed(ProjectionRecord record) {
        records.add(record);
        return this;
    }

    @Override
    public synchronized List<ProjectionRecord> query(AdminPrincipal principal, ProjectionQuery query) {
        pep.requireAuthenticated(principal);
        List<ProjectionRecord> result = records.stream()
                .filter(record -> record.domain() == query.domain())
                .filter(record -> query.resourceRef() == null || query.resourceRef().equals(record.resourceRef()))
                .filter(record -> principal.tenantId().equals(record.tenantId()))
                .limit(query.limit())
                .toList();
        return List.copyOf(result);
    }

    public synchronized List<ProjectionRecord> snapshot() {
        return List.copyOf(records);
    }
}
