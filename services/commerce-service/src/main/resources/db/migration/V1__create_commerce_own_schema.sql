-- Commerce owns these tables. Root database manifests are intentionally updated in a later integration task.
-- Every table is tenant-scoped; cross-service joins and writes are forbidden.

CREATE TABLE commerce_sku (
    tenant_id VARCHAR(128) NOT NULL,
    sku_id VARCHAR(128) NOT NULL,
    version INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    entitlement_code VARCHAR(128) NOT NULL,
    currency CHAR(3) NOT NULL,
    amount_minor BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    effective_from TIMESTAMP(6) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    -- Price changes append an immutable version; used rows are never rewritten.
    PRIMARY KEY (tenant_id, sku_id, version),
    CONSTRAINT ck_commerce_sku_amount CHECK (amount_minor >= 0)
);

CREATE TABLE commerce_price_snapshot (
    tenant_id VARCHAR(128) NOT NULL,
    sku_id VARCHAR(128) NOT NULL,
    sku_version INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    entitlement_code VARCHAR(128) NOT NULL,
    currency CHAR(3) NOT NULL,
    amount_minor BIGINT NOT NULL,
    captured_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (tenant_id, sku_id, sku_version),
    CONSTRAINT ck_commerce_price_snapshot_amount CHECK (amount_minor >= 0)
);

CREATE TABLE commerce_order (
    tenant_id VARCHAR(128) NOT NULL,
    order_id VARCHAR(128) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    sku_id VARCHAR(128) NOT NULL,
    sku_version INT NOT NULL,
    sku_title VARCHAR(255) NOT NULL,
    entitlement_code VARCHAR(128) NOT NULL,
    provider VARCHAR(32) NULL,
    currency CHAR(3) NOT NULL,
    amount_minor BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    paid_at TIMESTAMP(6) NULL,
    PRIMARY KEY (tenant_id, order_id),
    CONSTRAINT ck_commerce_order_amount CHECK (amount_minor >= 0)
);

CREATE TABLE commerce_payment_attempt (
    tenant_id VARCHAR(128) NOT NULL,
    attempt_id VARCHAR(128) NOT NULL,
    order_id VARCHAR(128) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_reference VARCHAR(255) NULL,
    status VARCHAR(32) NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (tenant_id, attempt_id),
    UNIQUE (tenant_id, provider, provider_reference),
    CONSTRAINT ck_commerce_payment_attempt_amount CHECK (amount_minor >= 0)
);

CREATE TABLE commerce_payment_callback (
    tenant_id VARCHAR(128) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(128) NOT NULL,
    provider_reference VARCHAR(255) NULL,
    payload_hash CHAR(64) NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    verification_state VARCHAR(64) NOT NULL,
    received_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (tenant_id, provider, provider_event_id),
    CONSTRAINT ck_commerce_payment_callback_amount CHECK (amount_minor >= 0)
);

CREATE TABLE commerce_entitlement (
    tenant_id VARCHAR(128) NOT NULL,
    entitlement_id VARCHAR(128) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    sku_id VARCHAR(128) NOT NULL,
    sku_version INT NOT NULL,
    sku_title VARCHAR(255) NOT NULL,
    entitlement_code VARCHAR(128) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_ref VARCHAR(255) NOT NULL,
    currency CHAR(3) NOT NULL,
    amount_minor BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    active_from TIMESTAMP(6) NOT NULL,
    expires_at TIMESTAMP(6) NULL,
    reason_code VARCHAR(64) NOT NULL DEFAULT '',
    PRIMARY KEY (tenant_id, entitlement_id),
    UNIQUE (tenant_id, subject_id, source_type, source_ref),
    CONSTRAINT ck_commerce_entitlement_amount CHECK (amount_minor >= 0)
);

CREATE TABLE commerce_activation_code (
    tenant_id VARCHAR(128) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    sku_id VARCHAR(128) NOT NULL,
    sku_version INT NOT NULL,
    sku_title VARCHAR(255) NOT NULL,
    entitlement_code VARCHAR(128) NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    status VARCHAR(32) NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    redeemed_by VARCHAR(128) NULL,
    redeemed_at TIMESTAMP(6) NULL,
    PRIMARY KEY (tenant_id, code_hash),
    CONSTRAINT ck_commerce_activation_amount CHECK (amount_minor >= 0)
);

CREATE TABLE commerce_refund (
    tenant_id VARCHAR(128) NOT NULL,
    refund_id VARCHAR(128) NOT NULL,
    order_id VARCHAR(128) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    status VARCHAR(32) NOT NULL,
    reason_code VARCHAR(64) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    completed_at TIMESTAMP(6) NULL,
    PRIMARY KEY (tenant_id, refund_id),
    CONSTRAINT ck_commerce_refund_amount CHECK (amount_minor >= 0)
);

CREATE TABLE commerce_refund_callback (
    tenant_id VARCHAR(128) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    refund_id VARCHAR(128) NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    verification_state VARCHAR(64) NOT NULL,
    received_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (tenant_id, provider, provider_event_id),
    CONSTRAINT ck_commerce_refund_callback_amount CHECK (amount_minor >= 0)
);

-- Production adapters claim this key atomically before executing a side effect.
CREATE TABLE commerce_idempotency_record (
    tenant_id VARCHAR(128) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    operation VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(200) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL,
    response_json JSON NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (tenant_id, subject_id, operation, idempotency_key)
);

CREATE TABLE commerce_audit_record (
    audit_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    actor_ref VARCHAR(128) NOT NULL,
    action VARCHAR(128) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    outcome VARCHAR(64) NOT NULL,
    attributes_json JSON NULL,
    occurred_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (audit_id),
    KEY ix_commerce_audit_aggregate (tenant_id, aggregate_type, aggregate_id, occurred_at)
);

CREATE TABLE commerce_reconciliation_record (
    tenant_id VARCHAR(128) NOT NULL,
    reconciliation_id VARCHAR(128) NOT NULL,
    order_id VARCHAR(128) NOT NULL,
    state VARCHAR(32) NOT NULL,
    expected_amount_minor BIGINT NOT NULL,
    paid_amount_minor BIGINT NOT NULL,
    refunded_amount_minor BIGINT NOT NULL,
    entitlement_state VARCHAR(32) NOT NULL,
    repair_required BOOLEAN NOT NULL,
    checked_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (tenant_id, reconciliation_id),
    KEY ix_commerce_reconciliation_order (tenant_id, order_id, checked_at),
    CONSTRAINT ck_commerce_reconciliation_amounts CHECK (
        expected_amount_minor >= 0 AND paid_amount_minor >= 0 AND refunded_amount_minor >= 0
    )
);

CREATE TABLE commerce_outbox_event (
    event_id VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(128) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    schema_version INT NOT NULL,
    payload_json JSON NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (event_id),
    KEY ix_commerce_outbox_pending (state, created_at)
);
