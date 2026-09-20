#!/bin/sh
# Runs only in the short-lived mysql-init container. The Compose environment
# supplies independent passwords; this script never logs a password or SQL.
set -eu

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"

provision_owner() {
  schema="$1"
  username="$2"
  password="$3"

  case "$schema:$username" in
    *[!a-z0-9_:]* | *::* | :*)
      echo "invalid owner identifier" >&2
      exit 2
      ;;
  esac

  mysql --host=mysql --user=root --password="$MYSQL_ROOT_PASSWORD" --execute="
    CREATE DATABASE IF NOT EXISTS \`$schema\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '$username'@'%' IDENTIFIED BY '$password';
    ALTER USER '$username'@'%' IDENTIFIED BY '$password';
    GRANT ALL PRIVILEGES ON \`$schema\`.* TO '$username'@'%';
  "
}

provision_owner iam_service svc_iam "$IAM_DB_PASSWORD"
provision_owner learner_service svc_learner "$LEARNER_DB_PASSWORD"
provision_owner content_service svc_content "$CONTENT_DB_PASSWORD"
provision_owner learning_service svc_learning "$LEARNING_DB_PASSWORD"
provision_owner assessment_service svc_assessment "$ASSESSMENT_DB_PASSWORD"
provision_owner media_service svc_media "$MEDIA_DB_PASSWORD"
provision_owner notification_service svc_notification "$NOTIFICATION_DB_PASSWORD"
provision_owner gamification_service svc_gamification "$GAMIFICATION_DB_PASSWORD"
provision_owner social_service svc_social "$SOCIAL_DB_PASSWORD"
provision_owner commerce_service svc_commerce "$COMMERCE_DB_PASSWORD"
provision_owner admin_ops_service svc_admin_ops "$ADMIN_OPS_DB_PASSWORD"
provision_owner analytics_service svc_analytics "$ANALYTICS_DB_PASSWORD"
provision_owner audit_service svc_audit "$AUDIT_DB_PASSWORD"
provision_owner workflow_service svc_workflow "$WORKFLOW_DB_PASSWORD"

mysql --host=mysql --user=root --password="$MYSQL_ROOT_PASSWORD" --execute='FLUSH PRIVILEGES;'
