package com.englishflow.iam.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Explicit local-only audit sink; production selects the durable IAM audit table. */
public final class InMemoryAuditFactPort implements AuditFactPort {
    private final List<AuditDecision> decisions = Collections.synchronizedList(new ArrayList<>());

    @Override
    public void append(AuditDecision decision) { decisions.add(decision); }

    public List<AuditDecision> decisions() { return List.copyOf(decisions); }
}
