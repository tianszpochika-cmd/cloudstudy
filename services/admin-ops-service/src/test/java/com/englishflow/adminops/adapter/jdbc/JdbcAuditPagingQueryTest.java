package com.englishflow.adminops.adapter.jdbc;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JdbcAuditPagingQueryTest {
    @Test
    void queriesOnlyTheTenantAndAtMostOneExtraRow() {
        CapturingJdbc jdbc = new CapturingJdbc();
        JdbcAdminOpsAdapters.Audit audit = new JdbcAdminOpsAdapters.Audit(jdbc, new ObjectMapper());

        audit.page("tenant-ref-a", null, 100);
        assertThat(jdbc.sql).contains("WHERE tenant_ref = ?").contains("ORDER BY sequence_id DESC LIMIT ?")
                .doesNotContain("FROM admin_audit_record ORDER BY sequence_id");
        assertThat(jdbc.arguments).containsExactly("tenant-ref-a", 101);

        audit.page("tenant-ref-b", 123L, 20);
        assertThat(jdbc.sql).contains("WHERE tenant_ref = ? AND sequence_id < ?")
                .contains("ORDER BY sequence_id DESC LIMIT ?");
        assertThat(jdbc.arguments).containsExactly("tenant-ref-b", 123L, 21);
    }

    @Test
    void nextCursorAnchorIsLastVisibleSequenceNotTheExtraRow() {
        CapturingJdbc jdbc = new CapturingJdbc();
        jdbc.sequences = List.of(10L, 9L, 8L);
        JdbcAdminOpsAdapters.Audit audit = new JdbcAdminOpsAdapters.Audit(jdbc, new ObjectMapper());

        var page = audit.page("tenant-ref-a", null, 2);
        assertThat(page.items()).extracting(item -> item.auditId()).containsExactly("audit-10", "audit-9");
        assertThat(page.hasMore()).isTrue();
        assertThat(page.nextSequence()).isEqualTo(9L);
        assertThat(jdbc.arguments).containsExactly("tenant-ref-a", 3);
    }

    private static final class CapturingJdbc extends JdbcTemplate {
        String sql;
        Object[] arguments;
        List<Long> sequences = List.of();

        @Override
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
            this.sql = sql;
            this.arguments = args;
            List<T> mapped = new ArrayList<>();
            for (int index = 0; index < sequences.size(); index++) {
                long sequence = sequences.get(index);
                try {
                    ResultSet result = mock(ResultSet.class);
                    when(result.getLong("sequence_id")).thenReturn(sequence);
                    when(result.getString(anyString())).thenAnswer(invocation -> switch ((String) invocation.getArgument(0)) {
                        case "audit_id" -> "audit-" + sequence;
                        case "tenant_ref" -> "tenant-ref-a";
                        case "safe_context" -> "{}";
                        default -> "ref-" + sequence;
                    });
                    when(result.getTimestamp("occurred_at"))
                            .thenReturn(Timestamp.from(Instant.parse("2026-09-23T00:00:00Z")));
                    mapped.add(rowMapper.mapRow(result, index));
                } catch (SQLException exception) {
                    throw new AssertionError(exception);
                }
            }
            return mapped;
        }
    }
}
