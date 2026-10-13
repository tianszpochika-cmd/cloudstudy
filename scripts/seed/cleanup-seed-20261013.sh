#!/bin/sh
# Usage (on the clyunedev server, repo root): sh scripts/seed/cleanup-seed-20261013.sh [--dry-run]
# Takes a backup first, then runs cleanup-seed-20261013.sql. --dry-run runs it and rolls back.
set -eu
C=${SEED_MYSQL_CONTAINER:-cloudstudy-clyunedev-mysql-1}
DIR=$(dirname "$0")
TS=$(date +%Y%m%d%H%M%S)
B=/srv/cloudstudy/backups/seed-20261013-precleanup-$TS.sql.gz
SQL=$(cat "$DIR/cleanup-seed-20261013.sql")
if [ "${1:-}" = "--dry-run" ]; then SQL=$(printf '%s' "$SQL" | sed 's/^COMMIT;$/ROLLBACK;/'); fi
docker exec "$C" sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 --single-transaction --databases content_service assessment_service learning_service notification_service admin_ops_service commerce_service social_service gamification_service analytics_service workflow_service iam_service 2>/dev/null' | gzip > "$B"
chmod 600 "$B"; echo "backup: $B"
printf '%s\n' "$SQL" | docker exec -i "$C" sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4' 2>&1 | grep -v Warning || true
echo "cleanup done${1:+ ($1)}"
