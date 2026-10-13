-- Removes every SEED-20261013 row (see seed-20261013.mjs). Safe to re-run.
-- Keeps: the e2e-20261013-* IAM accounts (see the optional block at the end) and append-only
-- audit chains (admin_audit_record, audit_service.audit_fact): deleting them would break the hash chain.
SET NAMES utf8mb4;
SET @learner := (SELECT principal_id FROM iam_service.iam_account WHERE identifier = 'e2e-20261013-learner');
SET @admin := (SELECT principal_id FROM iam_service.iam_account WHERE identifier = 'e2e-20261013-admin');
START TRANSACTION;
-- content (SQL seed)

-- SMOKE-CONTENTOPS-20261013 leftovers from content-ops Luna close-out (phonetics E2E / dry-run probes).
DELETE FROM content_service.content_outbox_event
 WHERE payload_json LIKE '%SMOKE-CONTENTOPS-20261013%'
    OR aggregate_id IN ('qi_da5aa156d90c','ew_dfd558db981b','ew_e17f16ed0217');
DELETE FROM content_service.content_idempotency_record
 WHERE idempotency_key LIKE '%SMOKE-CONTENTOPS-20261013%';
DELETE FROM content_service.content_item
 WHERE fields_json LIKE '%SMOKE-CONTENTOPS-20261013%'
    OR stem LIKE '%SMOKE-CONTENTOPS-20261013%'
    OR item_id IN ('qi_da5aa156d90c','ew_dfd558db981b','ew_e17f16ed0217');

-- E2E reviewer pair created for dual-review phonetics publish (tagged SEED-20261013).
-- Keep accounts by default; uncomment to remove:
-- DELETE FROM iam_service.iam_account WHERE identifier IN ('e2e-20261013-reviewer','e2e-20261013-reviewer-l2');

DELETE FROM content_service.b25_content_item WHERE item_id LIKE 'seed-20261013-%';
DELETE FROM content_service.b25_content_unit WHERE unit_id LIKE 'seed-20261013-%';
DELETE FROM content_service.b25_content_course WHERE content_code LIKE 'SEED-20261013-%';
DELETE FROM content_service.content_version WHERE content_id LIKE 'seed-20261013-%';
DELETE FROM content_service.content_definition WHERE content_id LIKE 'seed-20261013-%';
DELETE FROM content_service.b25_content_vocabulary WHERE vocabulary_id LIKE 'seed-20261013-%';
DELETE FROM content_service.content_b3_item_binding WHERE b3_experience_id LIKE 'seed-20261013-%';
DELETE FROM content_service.b3_content_experience WHERE experience_id LIKE 'seed-20261013-%';
-- content (admin API seed: lexemes and items authored by the e2e admin in VOCAB-PHASE1)
DELETE FROM content_service.lexeme_pronunciation WHERE lexeme_id IN (SELECT lexeme_id FROM content_service.lexeme WHERE created_by = @admin);
DELETE FROM content_service.lexeme WHERE created_by = @admin;
DELETE FROM content_service.content_item WHERE created_by = @admin;
-- learner-owned data
DELETE FROM assessment_service.assessment_mistake WHERE subject_id = @learner OR mistake_id BETWEEN 2610130000 AND 2610139999;
DELETE FROM learning_service.b25_learning_srs_state WHERE principal_id = @learner;
DELETE FROM learning_service.b25_learning_review WHERE principal_id = @learner;
DELETE FROM learning_service.b25_learning_library_entry WHERE principal_id = @learner;
DELETE FROM learning_service.b2_learner_expression WHERE principal_id = @learner;
DELETE FROM learning_service.b3_learning_interaction WHERE principal_id = @learner;
DELETE FROM learning_service.b25_learning_report_share WHERE principal_id = @learner;
DELETE FROM notification_service.notification_message WHERE notification_id LIKE 'seed-20261013-%' OR subject_id = @learner;
DELETE FROM notification_service.b25_notification_message WHERE template_code LIKE 'seed-20261013.%' OR principal_id = @learner;
DELETE FROM admin_ops_service.support_ticket WHERE resource_ref = 'SEED-20261013' OR requester_subject = @learner;
DELETE FROM gamification_service.xp_ledger WHERE subject_id = @learner;
DELETE FROM gamification_service.coin_ledger WHERE subject_id = @learner;
DELETE FROM gamification_service.reward_grant WHERE idempotency_key LIKE 'seed-20261013-%' OR subject_id = @learner;
DELETE FROM gamification_service.gamification_season_fact WHERE event_id LIKE 'seed-20261013-%';
-- social
DELETE FROM social_service.soc_room_member WHERE room_id LIKE 'seed20261013-%' OR membership_id LIKE 'seed-20261013-%';
DELETE FROM social_service.soc_report WHERE report_id LIKE 'seed-20261013-%';
DELETE FROM social_service.soc_study_room WHERE room_id LIKE 'seed20261013-%';
DELETE FROM social_service.soc_leaderboard_projection WHERE source_watermark = 'SEED-20261013';
-- commerce
DELETE FROM admin_ops_service.admin_projection WHERE domain_name = 'COMMERCE' AND JSON_UNQUOTE(JSON_EXTRACT(redacted_payload, '$.seedTag')) = 'SEED-20261013';
DELETE FROM commerce_service.commerce_entitlement WHERE entitlement_id LIKE 'seed-20261013-%' OR sku_id LIKE 'seed-20261013-%';
DELETE FROM commerce_service.commerce_payment_attempt WHERE order_id IN (SELECT order_id FROM commerce_service.commerce_order WHERE sku_id LIKE 'seed-20261013-%');
DELETE FROM commerce_service.commerce_order WHERE sku_id LIKE 'seed-20261013-%';
DELETE FROM commerce_service.commerce_price_snapshot WHERE sku_id LIKE 'seed-20261013-%';
DELETE FROM commerce_service.commerce_sku WHERE sku_id LIKE 'seed-20261013-%';
-- admin / ops
DELETE FROM analytics_service.analytics_metric_projection WHERE source_watermark = 'SEED-20261013' AND projection_version = 20261013;
DELETE FROM admin_ops_service.risk_case WHERE JSON_CONTAINS(evidence_refs_json, '"SEED-20261013"');
DELETE FROM workflow_service.manual_recovery_request WHERE subject_id LIKE 'seed-20261013-%';
DELETE FROM iam_service.iam_policy_control_contributor WHERE policy_version_id IN (SELECT policy_version_id FROM iam_service.iam_policy_control_version WHERE JSON_UNQUOTE(JSON_EXTRACT(document_json, '$.name')) LIKE 'SEED-20261013%');
DELETE FROM iam_service.iam_policy_control_audit WHERE policy_version_id IN (SELECT policy_version_id FROM iam_service.iam_policy_control_version WHERE JSON_UNQUOTE(JSON_EXTRACT(document_json, '$.name')) LIKE 'SEED-20261013%');
DELETE FROM iam_service.iam_policy_control_version WHERE JSON_UNQUOTE(JSON_EXTRACT(document_json, '$.name')) LIKE 'SEED-20261013%';
COMMIT;
-- Optional, not run by default: remove the test accounts themselves.
-- UPDATE iam_service.iam_account SET status='DISABLED' WHERE identifier IN ('e2e-20261013-learner','e2e-20261013-admin');
