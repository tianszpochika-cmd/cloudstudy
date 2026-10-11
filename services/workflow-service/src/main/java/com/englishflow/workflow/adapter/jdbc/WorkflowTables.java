package com.englishflow.workflow.adapter.jdbc;

/**
 * Qualifies workflow SQL with this service's owner schema.
 *
 * <p>The production default stays {@code workflow_service}. A test may set
 * {@code WORKFLOW_SCHEMA} to an isolated {@code r8_}, {@code rv2_} or {@code rv3_} schema. Any other name is rejected
 * so a mis-set variable cannot point these statements at a shared owner schema.
 */
public final class WorkflowTables {
    private static final String SCHEMA = resolve();

    private WorkflowTables() {
    }

    public static String schema() {
        return SCHEMA;
    }

    public static String sql(String statement) {
        return statement.replace("workflow_service.", SCHEMA + ".");
    }

    private static String resolve() {
        String configured = System.getenv("WORKFLOW_SCHEMA");
        if (configured == null || configured.isBlank() || "workflow_service".equals(configured)) {
            return "workflow_service";
        }
        if (!configured.matches("(?:r8_|rv2_|rv3_)[a-z0-9_]{1,48}")) {
            throw new IllegalStateException("WORKFLOW_SCHEMA must stay workflow_service or an r8_/rv2_/rv3_ schema");
        }
        return configured;
    }
}
