package com.englishflow.adminops.risk;

/** How a case entered the queue. Rule hits carry the detecting rule identity. */
public enum RiskSource {
    ANALYST_FILED,
    RULE_HIT
}
