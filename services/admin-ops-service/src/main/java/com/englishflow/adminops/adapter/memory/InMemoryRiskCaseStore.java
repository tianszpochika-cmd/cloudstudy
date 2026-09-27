package com.englishflow.adminops.adapter.memory;

import com.englishflow.adminops.domain.AdminOpsException;
import com.englishflow.adminops.risk.RiskCaseRecord;
import com.englishflow.adminops.risk.RiskCaseStore;
import com.englishflow.adminops.risk.RiskStatus;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Test/development store used only outside the local-real profile. */
public final class InMemoryRiskCaseStore implements RiskCaseStore {

    private final Map<String, RiskCaseRecord> cases = new LinkedHashMap<>();

    @Override
    public synchronized void create(RiskCaseRecord kase) {
        cases.put(kase.caseId(), kase);
    }

    @Override
    public synchronized List<RiskCaseRecord> list(String tenantId) {
        return cases.values().stream()
                .filter(kase -> tenantId.equals(kase.tenantId()))
                .toList();
    }

    @Override
    public synchronized Optional<RiskCaseRecord> find(String tenantId, String caseId) {
        return Optional.ofNullable(cases.get(caseId))
                .filter(kase -> tenantId.equals(kase.tenantId()));
    }

    @Override
    public synchronized void update(RiskCaseRecord kase, long expectedVersion) {
        RiskCaseRecord current = cases.get(kase.caseId());
        if (current == null || !kase.tenantId().equals(current.tenantId())
                || current.version() != expectedVersion) {
            throw AdminOpsException.conflict("RISK_VERSION_CONFLICT", "case changed; reload before retrying");
        }
        cases.put(kase.caseId(), kase);
    }

    @Override
    public synchronized List<RiskCaseRecord> findOpenByRuleSubject(
            String tenantId, String ruleId, String subjectRef) {
        return cases.values().stream()
                .filter(kase -> tenantId.equals(kase.tenantId()))
                .filter(kase -> ruleId.equals(kase.ruleId()))
                .filter(kase -> subjectRef.equals(kase.subjectRef()))
                .filter(kase -> kase.status() != RiskStatus.CLOSED)
                .toList();
    }
}
