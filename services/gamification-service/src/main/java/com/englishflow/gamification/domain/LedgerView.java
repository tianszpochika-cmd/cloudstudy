package com.englishflow.gamification.domain;

import java.util.List;

public record LedgerView(
        String subjectId,
        List<LedgerEntry> xp,
        List<LedgerEntry> coins,
        boolean conserved) {
}
