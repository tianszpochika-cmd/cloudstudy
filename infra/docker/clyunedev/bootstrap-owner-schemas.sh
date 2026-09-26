#!/bin/sh
# Runs only in the short-lived mysql-init container. The Compose environment
# supplies independent passwords; this script never logs a password or SQL.
# External owners migrate in the separate short-lived mysql-migrate job.
set -eu

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"
[ "${P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED:-}" = true ] || {
  echo "external owner writers must be drained before provisioning" >&2
  exit 2
}
[ "${P1R_EXTERNAL_MIGRATION_BACKUP_READY:-}" = true ] || {
  echo "external owner backup must be ready before provisioning" >&2
  exit 2
}

newline='
'
carriage_return=$(printf '\r')

validate_password() {
  password="$1"
  [ -n "$password" ] || { echo "empty owner credential" >&2; exit 2; }
  case "$password" in
    replace-with-* | *"'"* | *"\\"* | *"$newline"* | *"$carriage_return"*)
      echo "owner credential contains characters unsafe for SQL provisioning" >&2
      exit 2
      ;;
  esac
}

# Validate every credential before the first CREATE/ALTER USER. A late invalid
# password must not leave a partially rotated set of runtime credentials.
for owner_password in "$IAM_DB_PASSWORD" "$LEARNER_DB_PASSWORD" "$CONTENT_DB_PASSWORD" \
  "$LEARNING_DB_PASSWORD" "$ASSESSMENT_DB_PASSWORD" "$MEDIA_DB_PASSWORD" \
  "$NOTIFICATION_DB_PASSWORD" "$GAMIFICATION_DB_PASSWORD" "$SOCIAL_DB_PASSWORD" \
  "$COMMERCE_DB_PASSWORD" "$ADMIN_OPS_DB_PASSWORD" "$ANALYTICS_DB_PASSWORD" \
  "$AUDIT_DB_PASSWORD" "$WORKFLOW_DB_PASSWORD"; do
  validate_password "$owner_password"
done

provision_owner() {
  schema="$1"
  username="$2"
  password="$3"
  migration_mode="$4"

  case "$schema:$username" in
    *[!a-z0-9_:]* | *::* | :*)
      echo "invalid owner identifier" >&2
      exit 2
      ;;
  esac

  case "$migration_mode" in
    self) grants='ALL PRIVILEGES' ;;
    external) grants='SELECT, INSERT, UPDATE, DELETE' ;;
    *) echo "invalid owner migration mode" >&2; exit 2 ;;
  esac

  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --host=mysql --user=root <<SQL
    CREATE DATABASE IF NOT EXISTS \`$schema\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '$username'@'%' IDENTIFIED BY '$password';
    ALTER USER '$username'@'%' IDENTIFIED BY '$password';
    REVOKE IF EXISTS ALL PRIVILEGES, GRANT OPTION FROM '$username'@'%';
    GRANT $grants ON \`$schema\`.* TO '$username'@'%';
SQL
}

provision_owner iam_service svc_iam "$IAM_DB_PASSWORD" self
provision_owner learner_service svc_learner "$LEARNER_DB_PASSWORD" external
provision_owner content_service svc_content "$CONTENT_DB_PASSWORD" external
provision_owner learning_service svc_learning "$LEARNING_DB_PASSWORD" external
provision_owner assessment_service svc_assessment "$ASSESSMENT_DB_PASSWORD" external
provision_owner media_service svc_media "$MEDIA_DB_PASSWORD" external
provision_owner notification_service svc_notification "$NOTIFICATION_DB_PASSWORD" external
provision_owner gamification_service svc_gamification "$GAMIFICATION_DB_PASSWORD" external
provision_owner social_service svc_social "$SOCIAL_DB_PASSWORD" external
provision_owner commerce_service svc_commerce "$COMMERCE_DB_PASSWORD" external
provision_owner admin_ops_service svc_admin_ops "$ADMIN_OPS_DB_PASSWORD" external
provision_owner analytics_service svc_analytics "$ANALYTICS_DB_PASSWORD" external
provision_owner audit_service svc_audit "$AUDIT_DB_PASSWORD" external
provision_owner workflow_service svc_workflow "$WORKFLOW_DB_PASSWORD" external

MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --host=mysql --user=root --execute='FLUSH PRIVILEGES;'
