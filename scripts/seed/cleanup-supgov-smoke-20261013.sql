-- SMOKE-SUPGOV-20261013 cleanup (run after backup). admin_audit_record is hash-chained/append-only: kept on purpose.
USE workflow_service;
SET @T='SMOKE-SUPGOV-20261013';
SELECT 'verify-audit', operation, COUNT(*) FROM admin_ops_service.admin_audit_record WHERE resource_ref IN (SELECT ticket_id FROM admin_ops_service.support_ticket WHERE resource_ref=@T) GROUP BY operation;
SELECT 'verify-effect', outcome, COUNT(*) FROM workflow_service.recovery_side_effect_log WHERE recovery_id IN (SELECT recovery_id FROM workflow_service.manual_recovery_request WHERE reason=@T) GROUP BY outcome;
SELECT 'verify-recovery', action, status FROM workflow_service.manual_recovery_request WHERE reason=@T;
CREATE TEMPORARY TABLE tmp_t AS SELECT ticket_id FROM admin_ops_service.support_ticket WHERE resource_ref=@T;
CREATE TEMPORARY TABLE tmp_r AS SELECT recovery_id FROM workflow_service.manual_recovery_request WHERE reason=@T;
DELETE FROM admin_ops_service.admin_ops_outbox_event WHERE aggregate_id IN (SELECT ticket_id FROM tmp_t);
DELETE FROM admin_ops_service.support_ticket WHERE ticket_id IN (SELECT ticket_id FROM tmp_t);
DELETE FROM admin_ops_service.admin_media_authorization WHERE object_ref LIKE 'obj:SMOKE-SUPGOV-20261013%';
DELETE FROM workflow_service.recovery_side_effect_log WHERE recovery_id IN (SELECT recovery_id FROM tmp_r);
DELETE FROM workflow_service.workflow_receipt WHERE subject_id IN (SELECT recovery_id FROM tmp_r);
DELETE FROM workflow_service.workflow_outbox_event WHERE aggregate_id IN (SELECT recovery_id FROM tmp_r);
DELETE FROM workflow_service.manual_recovery_request WHERE recovery_id IN (SELECT recovery_id FROM tmp_r);
DELETE FROM workflow_service.workflow_request_idempotency WHERE idempotency_key LIKE 'SMOKE-SUPGOV-20261013%';
UPDATE iam_service.iam_account SET permissions = REPLACE(permissions, ',admin.recovery.read,admin.recovery.command', '') WHERE identifier='e2e-20261013-reviewer';
SELECT 'left', (SELECT COUNT(*) FROM admin_ops_service.support_ticket WHERE resource_ref=@T),
  (SELECT COUNT(*) FROM workflow_service.manual_recovery_request WHERE reason=@T),
  (SELECT COUNT(*) FROM admin_ops_service.admin_media_authorization WHERE object_ref LIKE 'obj:SMOKE-SUPGOV%'),
  (SELECT permissions LIKE '%admin.recovery.command%' FROM iam_service.iam_account WHERE identifier='e2e-20261013-reviewer');
