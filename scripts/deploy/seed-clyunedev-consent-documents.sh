#!/bin/sh
# clyunedev pre-release only: publish placeholder consent documents so IAM
# registration/login can run on a freshly wiped database. Runtime status stays
# NOT_RUNTIME_VERIFIED; these are not legal sign-off. Idempotent (INSERT IGNORE).
# Usage (on the server, repo root): sh scripts/deploy/seed-clyunedev-consent-documents.sh
set -eu
container=${MYSQL_CONTAINER:-cloudstudy-clyunedev-mysql-1}
V=clyunedev-prerelease-v1
P=clyunedev-prerelease-policy-v1
row() { # type requirement capabilities effect revoke
  printf "INSERT IGNORE INTO iam_consent_document_version (consent_document_id, tenant_id, consent_type, document_version, document_digest, published_at, policy_version, policy_digest, requirement, capabilities, withdrawal_effect, revoke_sessions, policy_ref, runtime_status, lifecycle_status, revoked_at, created_at) VALUES (UUID(), 'platform', '%s', '%s', SHA2('%s:%s', 256), UTC_TIMESTAMP(6) - INTERVAL 1 MINUTE, '%s', SHA2('%s', 256), '%s', '%s', '%s', %s, 'iam://consent/%s', 'NOT_RUNTIME_VERIFIED', 'ACTIVE', NULL, UTC_TIMESTAMP(6));\n" \
    "$1" "$V" "$1" "$V" "$P" "$P" "$2" "$3" "$4" "$5" "$1"
}
{
  row TERMS_OF_SERVICE BASE_REQUIRED '["ACCOUNT","LEARNING"]' RESTRICT_ALL_LEARNING_ACCESS 1
  row PRIVACY_NOTICE BASE_REQUIRED '["ACCOUNT","LEARNING"]' RESTRICT_ALL_LEARNING_ACCESS 1
  row ADULT_LEARNING LEARNING_REQUIRED '["LEARNING"]' RESTRICT_ALL_LEARNING_ACCESS 1
  row PRODUCT_ANALYTICS OPTIONAL '["ANALYTICS"]' RESTRICT_PROTECTED_CAPABILITY 0
  row VOICE_RECORDING CAPABILITY_REQUIRED '["VOICE_REMOTE_RECORD","VOICE_REMOTE_UPLOAD","VOICE_REMOTE_PROCESS","VOICE_REMOTE_REPLAY"]' RESTRICT_PROTECTED_CAPABILITY 0
  echo "SELECT consent_type, lifecycle_status FROM iam_consent_document_version WHERE tenant_id='platform' ORDER BY consent_type;"
} | docker exec -i "$container" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N iam_service'
