#!/usr/bin/env bash
# Keep at most the newest two locally-built clyunedev image versions per repository.
#
# This command is deliberately limited to the cloudstudy-clyunedev/* namespace.
# It never invokes `docker system prune`, never removes volumes, and defaults to
# dry-run mode. Use --apply only after a successful deployment has recorded its
# current image set and rollback target.

set -Eeuo pipefail

apply=false
if [[ "${1:-}" == "--apply" ]]; then
  apply=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--apply]" >&2
  exit 2
fi

mapfile -t repositories < <(
  docker image ls --format '{{.Repository}}' \
    | awk '$1 ~ /^cloudstudy-clyunedev\\// { print }' \
    | sort -u
)

if [[ ${#repositories[@]} -eq 0 ]]; then
  echo 'No cloudstudy-clyunedev images found; nothing to prune.'
  exit 0
fi

declare -A referenced
while IFS= read -r image_id; do
  [[ -n "$image_id" ]] && referenced["$image_id"]=1
done < <(docker ps -aq | xargs -r docker inspect --format '{{.Image}}')

for repository in "${repositories[@]}"; do
  echo "Repository: $repository"
  mapfile -t image_ids < <(
    docker image ls "$repository" --format '{{.ID}}' | awk '!seen[$0]++'
  )

  if [[ ${#image_ids[@]} -le 2 ]]; then
    echo '  retain: all images (two or fewer versions present)'
    continue
  fi

  for index in "${!image_ids[@]}"; do
    image_id="${image_ids[$index]}"
    if (( index < 2 )); then
      echo "  retain: $image_id"
      continue
    fi

    if [[ -n "${referenced[$image_id]:-}" ]]; then
      echo "  retain: $image_id (referenced by an existing container)"
      continue
    fi

    if [[ "$apply" == true ]]; then
      echo "  remove: $image_id"
      docker image rm "$image_id"
    else
      echo "  would remove: $image_id (run with --apply after review)"
    fi
  done
done
