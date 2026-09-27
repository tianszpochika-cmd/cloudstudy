package com.englishflow.adminops.risk;

import java.util.List;
import java.util.Optional;

/** Risk-case persistence boundary; admin-ops-owned facts only. */
public interface RiskCaseStore {

    void create(RiskCaseRecord kase);

    List<RiskCaseRecord> list(String tenantId);

    Optional<RiskCaseRecord> find(String tenantId, String caseId);

    /** CAS update guarded by the expected version. */
    void update(RiskCaseRecord kase, long expectedVersion);

    /** Open (non-closed) cases filed by a rule for one subject reference. */
    List<RiskCaseRecord> findOpenByRuleSubject(String tenantId, String ruleId, String subjectRef);
}
