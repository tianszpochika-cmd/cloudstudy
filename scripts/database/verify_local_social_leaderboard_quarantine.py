"""Read-only post-check for the separately quarantined social leaderboard rows."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from audit_local_social_leaderboard_fixtures import EXPECTED_SOURCE_HASH, EXPECTED_TOTAL, TABLE, candidate_rows
from quarantine_local_social_leaderboards import (
    BACKUP_FORMAT, exact_ids, full_row_digest, rows_by_ids, tenant_total,
)
from quarantine_local_social_rooms import (
    QUARANTINE_TENANT, SOURCE_TENANT, TABLES as ROOM_TABLES,
    connect, decode_backup, fetch_rows,
)


EXPECTED_ROOM_COUNTS = {
    "soc_study_room": 100, "soc_room_member": 101, "soc_seat_lease": 100,
    "soc_focus_state": 100, "soc_interaction": 100, "soc_report": 100,
}


def scalar(cursor, statement, values=()):
    cursor.execute(statement, values)
    return int(next(iter(cursor.fetchone().values())))


def verify(backup_path: Path, expected_sha: str):
    raw = backup_path.read_bytes()
    actual_sha = hashlib.sha256(raw).hexdigest()
    if actual_sha != expected_sha:
        raise RuntimeError("offline backup SHA-256 mismatch")
    backup = decode_backup(json.loads(raw))
    if (backup.get("format") != BACKUP_FORMAT or backup.get("table") != TABLE
            or backup.get("sourceTenant") != SOURCE_TENANT
            or backup.get("quarantineTenant") != QUARANTINE_TENANT):
        raise RuntimeError("backup format or tenant mismatch")
    original_rows = backup["rows"]
    ids = exact_ids(original_rows)
    if full_row_digest(original_rows) != EXPECTED_SOURCE_HASH:
        raise RuntimeError("backup full-row hash differs from approved source")
    failures = []
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
            cursor.execute("START TRANSACTION READ ONLY")
            platform_candidates = candidate_rows(cursor, SOURCE_TENANT)
            platform_by_id = rows_by_ids(cursor, SOURCE_TENANT, ids)
            target_by_id = rows_by_ids(cursor, QUARANTINE_TENANT, ids)
            platform_total = tenant_total(cursor, SOURCE_TENANT)
            target_total = tenant_total(cursor, QUARANTINE_TENANT)
            normalized_hash = full_row_digest(target_by_id, normalize_tenant=True)
            room_counts = {}
            for table in ROOM_TABLES:
                source_count = len(fetch_rows(cursor, table, SOURCE_TENANT))
                target_count = len(fetch_rows(cursor, table, QUARANTINE_TENANT))
                room_counts[table] = {"platform": source_count,
                                      "quarantine": target_count}
                if source_count or target_count != EXPECTED_ROOM_COUNTS[table]:
                    failures.append(f"{table}: room fixture counts changed")
            auxiliary_counts = {
                "bulkIdempotencyRecords": scalar(cursor, """
                    SELECT COUNT(*) FROM social_service.soc_idempotency_record
                    WHERE tenant_id='platform' AND idempotency_key LIKE 'bulk-100x-%%'
                      AND JSON_UNQUOTE(JSON_EXTRACT(response_json,'$.fixtureId'))='bulk-100x-v1'
                """),
                "bulkTrustedEventDedupes": scalar(cursor, """
                    SELECT COUNT(*) FROM social_service.soc_trusted_event_dedupe
                    WHERE event_id LIKE 'bulk-100x-%%'
                """),
                "quarantineIamPrincipals": scalar(cursor, """
                    SELECT COUNT(*) FROM iam_service.iam_principal WHERE tenant_id=%s
                """, (QUARANTINE_TENANT,)),
            }
            connection.rollback()
    finally:
        connection.close()
    if platform_candidates or platform_by_id or platform_total:
        failures.append("platform still has approved or other leaderboard rows")
    if len(target_by_id) != EXPECTED_TOTAL or target_total != EXPECTED_TOTAL:
        failures.append("quarantine leaderboard count or ID set changed")
    if normalized_hash != backup["fullRowSha256"]:
        failures.append("quarantine full-row hash differs from backup")
    if auxiliary_counts != {
        "bulkIdempotencyRecords": 100, "bulkTrustedEventDedupes": 100,
        "quarantineIamPrincipals": 0,
    }:
        failures.append("auxiliary fixture counts changed")
    return {
        "mode": "LEADERBOARD_POST_QUARANTINE_READ_ONLY",
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "backupSha256": actual_sha,
        "backupSourceFullRowSha256": backup["fullRowSha256"],
        "normalizedTargetFullRowSha256": normalized_hash,
        "platformLeaderboardCandidateCount": len(platform_candidates),
        "platformLeaderboardTotalCount": platform_total,
        "quarantineLeaderboardCount": target_total,
        "quarantineBackedUpIdCount": len(target_by_id),
        "roomFixtureCounts": room_counts,
        "auxiliaryFixtureCounts": auxiliary_counts,
        "failures": failures,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backup", type=Path, required=True)
    parser.add_argument("--backup-sha256", required=True)
    args = parser.parse_args()
    result = verify(args.backup, args.backup_sha256)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result["failures"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
