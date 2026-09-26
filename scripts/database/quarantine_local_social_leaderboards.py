"""Backup and atomically isolate only the approved 381 synthetic social rankings.

The default work in this task is --dry-run. Do not use --apply until the
separate review of its full-row backup and one real-account-linked projection.
No IAM, room, learning, or other service row is changed by this script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from audit_local_social_leaderboard_fixtures import (
    EXPECTED_SOURCE_HASH,
    EXPECTED_TOTAL,
    TABLE,
    audit,
    candidate_rows,
    fixture_violations,
)
from audit_local_social_room_fixtures import canonical_value, row_fingerprint
from quarantine_local_social_rooms import (
    QUARANTINE_TENANT,
    SOURCE_TENANT,
    connect,
    decode_backup,
    encode_backup,
)


BACKUP_FORMAT = "local-social-leaderboard-quarantine-v1"
SQL_TABLE = f"social_service.{TABLE}"


def full_row_digest(rows, *, normalize_tenant=False):
    if normalize_tenant:
        rows = [dict(row, tenant_id=SOURCE_TENANT) for row in rows]
    return row_fingerprint(rows)


def exact_ids(rows):
    ids = [row["id"] for row in rows]
    if len(ids) != EXPECTED_TOTAL or len(set(ids)) != EXPECTED_TOTAL:
        raise RuntimeError("candidate ID count or uniqueness changed")
    return ids


def rows_by_ids(cursor, tenant, ids, *, lock=False):
    placeholders = ",".join(["%s"] * len(ids))
    cursor.execute(
        f"SELECT * FROM {SQL_TABLE} WHERE tenant_id=%s AND id IN ({placeholders}) "
        "ORDER BY id" + (" FOR UPDATE" if lock else ""),
        (tenant, *ids),
    )
    return list(cursor.fetchall())


def tenant_total(cursor, tenant):
    cursor.execute(f"SELECT COUNT(*) n FROM {SQL_TABLE} WHERE tenant_id=%s", (tenant,))
    return int(cursor.fetchone()["n"])


def assert_restore_unique_keys_clear(cursor, original_rows):
    """A legitimate platform projection created later must never be overwritten."""
    for row in original_rows:
        cursor.execute(
            f"SELECT COUNT(*) n FROM {SQL_TABLE} WHERE tenant_id=%s "
            "AND leaderboard_kind=%s AND period_type=%s AND period_start=%s AND subject_id=%s",
            (SOURCE_TENANT, row["leaderboard_kind"], row["period_type"],
             row["period_start"], row["subject_id"]),
        )
        if cursor.fetchone()["n"]:
            raise RuntimeError("platform has a competing leaderboard unique key")


def backup_first():
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
            cursor.execute("START TRANSACTION READ ONLY")
            preflight = audit(cursor)
            if preflight["blockers"]:
                raise RuntimeError("read-only preflight blockers: " + "; ".join(preflight["blockers"]))
            original_rows = candidate_rows(cursor, SOURCE_TENANT)
            exact_ids(original_rows)
            if full_row_digest(original_rows) != EXPECTED_SOURCE_HASH:
                raise RuntimeError("source full-row SHA differs from approved dry-run")
            cursor.execute("SELECT version,script,checksum FROM social_service.flyway_schema_history "
                           "WHERE success=1 ORDER BY installed_rank")
            migrations = list(cursor.fetchall())
            connection.rollback()
    finally:
        connection.close()
    backup = {
        "format": BACKUP_FORMAT,
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "sourceTenant": SOURCE_TENANT,
        "quarantineTenant": QUARANTINE_TENANT,
        "table": TABLE,
        "migrations": migrations,
        "audit": preflight,
        "fullRowSha256": full_row_digest(original_rows),
        "rows": original_rows,
    }
    raw = (json.dumps(backup, ensure_ascii=False, sort_keys=True,
                      indent=2, default=encode_backup) + "\n").encode("utf-8")
    directory = Path(os.environ.get("SOCIAL_FIXTURE_BACKUP_DIR", "C:/Temp")).resolve()
    repository = Path(__file__).resolve().parents[2]
    if not directory.is_dir() or directory == repository or repository in directory.parents:
        raise RuntimeError("backup directory must exist outside the repository")
    backup_path = directory / (
        "cloudstudy-social-leaderboards-before-" +
        datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".json"
    )
    with backup_path.open("xb") as handle:
        handle.write(raw)
        handle.flush()
        os.fsync(handle.fileno())
    backup_sha = hashlib.sha256(raw).hexdigest()
    if hashlib.sha256(backup_path.read_bytes()).hexdigest() != backup_sha:
        raise RuntimeError("offline backup readback SHA-256 mismatch")
    return backup_path, backup_sha, backup, original_rows


def apply_quarantine():
    backup_path, backup_sha, backup, original_rows = backup_first()
    ids = exact_ids(original_rows)
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            cursor.execute("START TRANSACTION")
            locked = candidate_rows(cursor, SOURCE_TENANT, lock=True)
            if fixture_violations(locked) or exact_ids(locked) != ids:
                raise RuntimeError("locked candidate scope differs from the approved snapshot")
            if full_row_digest(locked) != backup["fullRowSha256"]:
                raise RuntimeError("locked source rows differ from offline backup")
            current = audit(cursor)
            if current["blockers"] or current["candidateFullRowSha256"] != backup["fullRowSha256"]:
                raise RuntimeError("transactional preflight changed; refusing leaderboard move")
            if tenant_total(cursor, QUARANTINE_TENANT) != 0:
                raise RuntimeError("quarantine tenant gained leaderboard rows")
            other_platform_before = tenant_total(cursor, SOURCE_TENANT) - EXPECTED_TOTAL
            for row in locked:
                cursor.execute(
                    f"UPDATE {SQL_TABLE} SET tenant_id=%s "
                    "WHERE id=%s AND tenant_id=%s AND source_watermark=%s",
                    (QUARANTINE_TENANT, row["id"], SOURCE_TENANT, row["source_watermark"]),
                )
                if cursor.rowcount != 1:
                    raise RuntimeError("candidate changed during leaderboard move")
            if candidate_rows(cursor, SOURCE_TENANT):
                raise RuntimeError("platform still has approved synthetic leaderboard rows")
            moved = rows_by_ids(cursor, QUARANTINE_TENANT, ids)
            if len(moved) != EXPECTED_TOTAL or full_row_digest(moved, normalize_tenant=True) != backup["fullRowSha256"]:
                raise RuntimeError("quarantined rows differ from full-row backup")
            if tenant_total(cursor, SOURCE_TENANT) != other_platform_before:
                raise RuntimeError("non-candidate platform leaderboard count changed")
            if tenant_total(cursor, QUARANTINE_TENANT) != EXPECTED_TOTAL:
                raise RuntimeError("quarantine tenant leaderboard count changed")
            connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    print(json.dumps({
        "mode": "APPLIED", "rowsMoved": EXPECTED_TOTAL,
        "sourceTenant": SOURCE_TENANT, "quarantineTenant": QUARANTINE_TENANT,
        "backupPath": str(backup_path), "backupSha256": backup_sha,
        "sourceFullRowSha256": backup["fullRowSha256"],
    }, indent=2))


def restore(backup_path: Path, expected_sha: str):
    raw = backup_path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected_sha:
        raise RuntimeError("backup SHA-256 mismatch")
    backup = decode_backup(json.loads(raw))
    if (backup.get("format") != BACKUP_FORMAT or backup.get("table") != TABLE
            or backup.get("sourceTenant") != SOURCE_TENANT
            or backup.get("quarantineTenant") != QUARANTINE_TENANT):
        raise RuntimeError("backup format or scope mismatch")
    original_rows = backup["rows"]
    ids = exact_ids(original_rows)
    if fixture_violations(original_rows) or full_row_digest(original_rows) != backup["fullRowSha256"]:
        raise RuntimeError("backup rows differ from approved fixture snapshot")
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("START TRANSACTION")
            archived = rows_by_ids(cursor, QUARANTINE_TENANT, ids, lock=True)
            if {row["id"] for row in archived} != set(ids):
                raise RuntimeError("quarantined leaderboard ID set changed")
            if rows_by_ids(cursor, SOURCE_TENANT, ids, lock=True):
                raise RuntimeError("platform already has a backed-up leaderboard ID")
            assert_restore_unique_keys_clear(cursor, original_rows)
            for row in original_rows:
                columns = [column for column in row if column != "id"]
                assignments = ",".join(f"`{column}`=%s" for column in columns)
                cursor.execute(
                    f"UPDATE {SQL_TABLE} SET {assignments} WHERE id=%s AND tenant_id=%s",
                    (*[row[column] for column in columns], row["id"], QUARANTINE_TENANT),
                )
                if cursor.rowcount != 1:
                    raise RuntimeError("restore row changed during update")
            restored = rows_by_ids(cursor, SOURCE_TENANT, ids)
            if len(restored) != EXPECTED_TOTAL or full_row_digest(restored) != backup["fullRowSha256"]:
                raise RuntimeError("restored rows differ from full-row backup")
            if rows_by_ids(cursor, QUARANTINE_TENANT, ids):
                raise RuntimeError("quarantine tenant still has backed-up rows")
            connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    print(json.dumps({"mode": "RESTORED", "rowsRestored": EXPECTED_TOTAL,
                      "sourceFullRowSha256": backup["fullRowSha256"]}, indent=2))


def dry_run():
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
            cursor.execute("START TRANSACTION READ ONLY")
            result = audit(cursor)
            connection.rollback()
    finally:
        connection.close()
    print(json.dumps(result, ensure_ascii=False, indent=2, default=canonical_value))
    if result["blockers"]:
        raise SystemExit(2)


def main():
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--dry-run", action="store_true")
    action.add_argument("--apply", action="store_true")
    action.add_argument("--restore", type=Path)
    parser.add_argument("--backup-sha256")
    args = parser.parse_args()
    if args.dry_run:
        dry_run()
    elif args.apply:
        apply_quarantine()
    else:
        if not args.backup_sha256 or len(args.backup_sha256) != 64:
            raise SystemExit("--restore requires --backup-sha256")
        restore(args.restore, args.backup_sha256)


if __name__ == "__main__":
    main()
