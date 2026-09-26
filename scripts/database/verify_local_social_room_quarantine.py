"""Read-only verification of a social fixture room quarantine against its offline backup.

Outputs only counts and hashes. The backup contains full rows and must stay out
of Git; no subject or account identifiers are emitted here.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from quarantine_local_social_rooms import (
    QUARANTINE_TENANT,
    SOURCE_TENANT,
    TABLES,
    connect,
    decode_backup,
    fetch_rows,
    row_fingerprint,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backup", required=True, type=Path)
    parser.add_argument("--backup-sha256", required=True)
    args = parser.parse_args()
    raw = args.backup.read_bytes()
    backup_sha = hashlib.sha256(raw).hexdigest()
    if backup_sha != args.backup_sha256:
        raise SystemExit("backup SHA-256 mismatch")
    backup = decode_backup(json.loads(raw))
    if backup.get("format") != "local-social-room-quarantine-v1":
        raise SystemExit("unexpected backup format")
    original = backup["rows"]
    failures = []
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
            cursor.execute("START TRANSACTION READ ONLY")
            source_counts = {}
            target_counts = {}
            normalized_hash_matches = {}
            for table in TABLES:
                source = fetch_rows(cursor, table, SOURCE_TENANT)
                target = fetch_rows(cursor, table, QUARANTINE_TENANT)
                source_counts[table] = len(source)
                target_counts[table] = len(target)
                normalized = [dict(row, tenant_id=SOURCE_TENANT) for row in target]
                normalized_hash_matches[table] = (
                    row_fingerprint(normalized) == row_fingerprint(original[table])
                )
                if source or len(target) != len(original[table]) or not normalized_hash_matches[table]:
                    failures.append(f"{table}: source/target count or full-row hash mismatch")
            cursor.execute("SELECT COUNT(*) n FROM social_service.soc_study_room "
                           "WHERE tenant_id=%s", (SOURCE_TENANT,))
            platform_room_count = int(cursor.fetchone()["n"])
            cursor.execute("SELECT COUNT(*) n FROM iam_service.iam_principal "
                           "WHERE tenant_id=%s", (QUARANTINE_TENANT,))
            quarantine_principal_count = int(cursor.fetchone()["n"])
            cursor.execute("""
                SELECT COUNT(*) n,
                  SUM(CASE WHEN EXISTS (
                    SELECT 1 FROM iam_service.iam_account account
                    WHERE account.principal_id=lb.subject_id
                      AND account.identifier NOT LIKE '%%.invalid'
                  ) THEN 1 ELSE 0 END) non_invalid_account_rows,
                  MIN(period_start) earliest_period,
                  MAX(period_start) latest_period,
                  MIN(last_projected_at) earliest_projection,
                  MAX(last_projected_at) latest_projection,
                  MIN(snapshot_version) min_snapshot_version,
                  MAX(snapshot_version) max_snapshot_version
                FROM social_service.soc_leaderboard_projection lb
                WHERE tenant_id=%s AND source_watermark='local-fixture'
            """, (SOURCE_TENANT,))
            foundation_board = cursor.fetchone()
            cursor.execute("""
                SELECT COUNT(*) n FROM social_service.soc_leaderboard_projection
                WHERE tenant_id=%s AND source_watermark LIKE 'local-10x-%%'
            """, (SOURCE_TENANT,))
            local_board_count = int(cursor.fetchone()["n"])
            connection.rollback()
    finally:
        connection.close()
    if platform_room_count:
        failures.append("platform still has visible rooms")
    if quarantine_principal_count:
        failures.append("quarantine tenant has IAM principals")
    if foundation_board["n"] != 371 or local_board_count != 10:
        failures.append("leaderboard fixture counts changed")
    result = {
        "mode": "POST_QUARANTINE_READ_ONLY",
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "backupSha256": backup_sha,
        "sourceCounts": source_counts,
        "quarantineCounts": target_counts,
        "normalizedFullRowHashesMatchBackup": normalized_hash_matches,
        "platformVisibleRoomCount": platform_room_count,
        "quarantineIamPrincipalCount": quarantine_principal_count,
        "untouchedLeaderboard": {
            "foundationWatermarkRows": int(foundation_board["n"]),
            "local10xWatermarkRows": local_board_count,
            "foundationRowsWithNonInvalidAccount": int(foundation_board["non_invalid_account_rows"]),
            "earliestPeriod": str(foundation_board["earliest_period"]),
            "latestPeriod": str(foundation_board["latest_period"]),
            "earliestProjection": str(foundation_board["earliest_projection"]),
            "latestProjection": str(foundation_board["latest_projection"]),
            "minSnapshotVersion": int(foundation_board["min_snapshot_version"]),
            "maxSnapshotVersion": int(foundation_board["max_snapshot_version"]),
        },
        "failures": failures,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
