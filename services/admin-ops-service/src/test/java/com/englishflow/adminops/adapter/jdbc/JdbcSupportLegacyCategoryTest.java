package com.englishflow.adminops.adapter.jdbc;

import com.englishflow.adminops.support.TicketCategory;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JdbcSupportLegacyCategoryTest {

    @Test
    void unknownBulkFixtureCategoryRemainsVisibleAsReadOnlyLegacyValue() {
        assertThat(JdbcAdminOpsAdapters.SupportTickets.legacySafeCategory("CONTENT_CORRECTION"))
                .isEqualTo(TicketCategory.CONTENT_CORRECTION);
        assertThat(JdbcAdminOpsAdapters.SupportTickets.legacySafeCategory("bulk-100x-invalid"))
                .isEqualTo(TicketCategory.LEGACY_UNMAPPED);
        assertThat(JdbcAdminOpsAdapters.SupportTickets.legacySafeCategory(null))
                .isEqualTo(TicketCategory.LEGACY_UNMAPPED);
    }
}
