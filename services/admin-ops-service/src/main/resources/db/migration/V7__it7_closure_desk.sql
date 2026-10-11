-- V7: IT-7 closure desk snapshot owned by admin-ops.
-- One row holds the desk facts so a process restart reads them back.
-- Disposition writes stay frozen; this table does not execute a lock or a case decision.
CREATE TABLE IF NOT EXISTS it7_closure_desk (
    desk_id VARCHAR(64) NOT NULL,
    state_json JSON NOT NULL,
    state_version BIGINT NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (desk_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
