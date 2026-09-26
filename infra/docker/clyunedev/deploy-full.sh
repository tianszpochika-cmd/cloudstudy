#!/bin/sh
# Planned full overlay only. Requires a server-only env file, drained writers,
# and a verified restorable backup. Failed migration leaves writers stopped.
set -eu

[ "$#" -ge 1 ] && [ "$#" -le 2 ] || {
  echo 'usage: deploy-full.sh /absolute/path/to/clyunedev.env [--start-existing]' >&2
  exit 2
}
mode=${2:---deploy}
case "$mode" in --deploy | --start-existing) ;; *) echo 'invalid mode' >&2; exit 2 ;; esac
case "$1" in
  /*) env_file="$1" ;;
  *) echo 'server env path must be absolute' >&2; exit 2 ;;
esac
[ -f "$env_file" ] || { echo 'server env file does not exist' >&2; exit 2; }

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir/../../.."

compose() {
  docker compose --env-file "$env_file" \
    -f infra/docker/clyunedev/docker-compose.core.yml \
    -f infra/docker/clyunedev/docker-compose.full.yml "$@"
}

compose config --quiet

start_apps() {
  compose up -d --wait mysql redis minio kafka
  compose up -d --no-deps minio-init
  # --no-deps is deliberate: completed one-shot jobs must not be restarted.
  compose up -d --no-deps iam-service audit-service workflow-service \
    learner-service content-service learning-service assessment-service \
    media-service notification-service gamification-service social-service \
    commerce-service admin-ops-service analytics-service
  compose up -d --no-deps api-gateway official-site learner-web admin-web mobile-h5
}

if [ "$mode" = --start-existing ]; then
  # Day-2 restart: only the image for this release may verify its already
  # applied history. Any pending version or changed grant blocks startup.
  compose up -d --wait mysql
  compose run --rm --no-deps mysql-migrate --verify
  start_apps
  exit 0
fi

# Read the resolved flags without echoing the resolved Compose config/secrets.
compose config --format json | node -e '
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const env = JSON.parse(input).services["mysql-init"].environment;
  if (env.P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED !== "true"
    || env.P1R_EXTERNAL_MIGRATION_BACKUP_READY !== "true") {
    console.error("writers-drained and backup-ready gates must both be true");
    process.exitCode = 2;
  }
});'

# Build once before stopping the old release. The one-shot image contains the
# exact manifest and SQL from this release; credentials are injected at run time.
compose build
compose up -d --wait mysql
# Read-only scan happens before password rotation or privilege revocation.
compose run --rm --no-deps mysql-migrate --preflight

compose stop api-gateway iam-service \
  learner-service content-service learning-service assessment-service \
  media-service notification-service gamification-service social-service \
  commerce-service admin-ops-service analytics-service audit-service workflow-service

# Recheck after stopping every writer, before mysql-init changes any account.
compose run --rm --no-deps mysql-migrate --preflight
compose up -d --force-recreate mysql-init mysql-migrate
migrator_id=$(compose ps --all --quiet mysql-migrate)
[ -n "$migrator_id" ] || { echo 'migration container was not created' >&2; exit 2; }
migrator_exit=$(docker wait "$migrator_id")
[ "$migrator_exit" = 0 ] || {
  echo "owner migration failed (exit $migrator_exit); external writers remain stopped" >&2
  exit 2
}

start_apps
