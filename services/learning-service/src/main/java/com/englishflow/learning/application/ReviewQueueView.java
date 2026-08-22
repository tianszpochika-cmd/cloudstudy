package com.englishflow.learning.application;

import com.englishflow.learning.domain.LearningTenantScope;
import com.englishflow.learning.domain.SrsState;

import java.time.LocalDate;
import java.util.List;

/** Read-only queue view; creating a view never writes a schedule or review fact. */
public record ReviewQueueView(
        LearningTenantScope scope,
        LocalDate localDate,
        String timeZoneId,
        String rulesVersion,
        List<SrsState> items) {

    public ReviewQueueView {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
