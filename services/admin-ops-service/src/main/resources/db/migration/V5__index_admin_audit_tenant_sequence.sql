ALTER TABLE admin_audit_record
    ADD INDEX idx_admin_audit_tenant_sequence (tenant_ref, sequence_id);
