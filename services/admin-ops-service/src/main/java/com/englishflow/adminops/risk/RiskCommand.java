package com.englishflow.adminops.risk;

/**
 * Case decisions. ISOLATE records containment against an owner-flow receipt
 * (it never executes domain isolation itself); UNISOLATE releases containment
 * back to triage; ESCALATE hands the case to support or audit with a ref;
 * CLOSE ends it with a resolution. Every decision needs a reason.
 */
public enum RiskCommand {
    TRIAGE,
    ISOLATE,
    UNISOLATE,
    ESCALATE,
    CLOSE
}
