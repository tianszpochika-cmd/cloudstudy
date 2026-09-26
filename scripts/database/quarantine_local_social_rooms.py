"""Backup, then atomically move the audited local social rooms to a closed tenant.

Only six room-scoped social tables are in scope. Leaderboards, IAM and other
auxiliary data are intentionally untouched. The full-row backup is outside Git
and is the restore source because the local lease sweeper scans all tenants.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import pymysql

from audit_local_social_room_fixtures import audit, canonical_value, row_fingerprint


SOURCE_TENANT = "platform"
QUARANTINE_TENANT = "local-social-fixture"
TABLES = (
    "soc_room_member", "soc_focus_state", "soc_seat_lease",
    "soc_interaction", "soc_report", "soc_study_room",
)
EXPECTED_TOTALS = {
    "soc_study_room": 100,
    "soc_room_member": 101,
    "soc_seat_lease": 100,
    "soc_focus_state": 100,
    "soc_interaction": 100,
    "soc_report": 100,
}
ROOM_PREDICATE = "(room_id LIKE 'bulk-100x-%%' OR room_id LIKE 'local-10x-%%' OR room_id='room-local-foundations')"


def connect():
    host = os.environ.get("MYSQL_HOST", "127.0.0.1")
    port = int(os.environ.get("MYSQL_PORT", "13306"))
    if host not in {"127.0.0.1", "localhost", "::1"} or port != 13306:
        raise SystemExit("Refusing nonlocal MySQL target")
    return pymysql.connect(
        host=host, port=port, user=os.environ.get("MYSQL_ADMIN_USER", "root"),
        password=os.environ.get("MYSQL_ROOT_PASSWORD", "root-local-only"),
        database="social_service", charset="utf8mb4", autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )


def fetch_rows(cursor, table, tenant, *, lock=False):
    cursor.execute(
        f"SELECT * FROM social_service.`{table}` "
        f"WHERE tenant_id=%s AND {ROOM_PREDICATE} ORDER BY id" + (" FOR UPDATE" if lock else ""),
        (tenant,),
    )
    return list(cursor.fetchall())


def encode_backup(value):
    if isinstance(value, Decimal):
        return canonical_value(value)
    if isinstance(value, datetime):
        return {"$type": "datetime", "value": value.isoformat(sep=" ")}
    if isinstance(value, date):
        return {"$type": "date", "value": value.isoformat()}
    if isinstance(value, bytes):
        return {"$type": "bytes", "value": value.hex()}
    raise TypeError(type(value).__name__)


def decode_backup(value):
    if isinstance(value, list):
        return [decode_backup(child) for child in value]
    if isinstance(value, dict):
        if value.get("$type") == "datetime":
            return datetime.fromisoformat(value["value"])
        if value.get("$type") == "date":
            return date.fromisoformat(value["value"])
        if value.get("$type") == "bytes":
            return bytes.fromhex(value["value"])
        return {key: decode_backup(child) for key, child in value.items()}
    return value


def expected_rows(cursor, tenant, *, lock=False):
    rows = {table: fetch_rows(cursor, table, tenant, lock=lock) for table in TABLES}
    for table, expected in EXPECTED_TOTALS.items():
        if len(rows[table]) != expected:
            raise RuntimeError(f"{table}: expected {expected} fixture rows, found {len(rows[table])}")
    return rows


def assert_closed_tenant(cursor):
    cursor.execute("SELECT COUNT(*) n FROM iam_service.iam_principal WHERE tenant_id=%s",
                   (QUARANTINE_TENANT,))
    if cursor.fetchone()["n"]:
        raise RuntimeError("quarantine tenant has an IAM principal")


def assert_rows_match(left, right, *, normalize_tenant=False):
    for table in TABLES:
        normalized = [dict(row, tenant_id=SOURCE_TENANT) for row in right[table]] if normalize_tenant else right[table]
        if row_fingerprint(left[table]) != row_fingerprint(normalized):
            raise RuntimeError(f"{table}: full-row hash differs from backup")


def backup_first():
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
            cursor.execute("START TRANSACTION READ ONLY")
            preflight = audit(cursor)
            if preflight["blockers"]:
                raise RuntimeError("read-only audit blockers: " + "; ".join(preflight["blockers"]))
            assert_closed_tenant(cursor)
            for table in TABLES:
                if fetch_rows(cursor, table, QUARANTINE_TENANT):
                    raise RuntimeError(f"{table}: quarantine tenant already has fixture IDs")
            rows = expected_rows(cursor, SOURCE_TENANT)
            for table in TABLES:
                actual_digest = row_fingerprint(rows[table])
                family_digests = preflight["tables"][table]
                if not all(family_digests[family]["count"] >= 0 for family in family_digests):
                    raise RuntimeError(f"{table}: invalid family audit")
                if not actual_digest:
                    raise RuntimeError(f"{table}: missing row fingerprint")
            cursor.execute("SELECT version,script,checksum FROM social_service.flyway_schema_history "
                           "WHERE success=1 ORDER BY installed_rank")
            migrations = list(cursor.fetchall())
            connection.rollback()
    finally:
        connection.close()

    backup = {
        "format": "local-social-room-quarantine-v1",
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "sourceTenant": SOURCE_TENANT,
        "quarantineTenant": QUARANTINE_TENANT,
        "migrations": migrations,
        "audit": preflight,
        "tableFingerprints": {table: row_fingerprint(rows[table]) for table in TABLES},
        "rows": rows,
    }
    backup_bytes = (json.dumps(backup, ensure_ascii=False, sort_keys=True,
                               indent=2, default=encode_backup) + "\n").encode("utf-8")
    directory = Path(os.environ.get("SOCIAL_FIXTURE_BACKUP_DIR", "C:/Temp")).resolve()
    if not directory.is_dir():
        raise RuntimeError("backup directory does not exist")
    name = "cloudstudy-social-rooms-before-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".json"
    backup_path = directory / name
    with backup_path.open("xb") as handle:
        handle.write(backup_bytes)
        handle.flush()
        os.fsync(handle.fileno())
    return backup_path, hashlib.sha256(backup_bytes).hexdigest(), backup, rows


def apply_quarantine():
    backup_path, backup_sha, backup, original_rows = backup_first()
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            cursor.execute("START TRANSACTION")
            assert_closed_tenant(cursor)
            locked_rows = expected_rows(cursor, SOURCE_TENANT, lock=True)
            assert_rows_match(original_rows, locked_rows)
            for table in TABLES:
                if fetch_rows(cursor, table, QUARANTINE_TENANT, lock=True):
                    raise RuntimeError(f"{table}: quarantine tenant gained fixture rows")
            preflight = audit(cursor)
            if preflight["blockers"]:
                raise RuntimeError("pre-commit audit blockers: " + "; ".join(preflight["blockers"]))
            for table in TABLES:
                for row in locked_rows[table]:
                    if table == "soc_study_room":
                        cursor.execute(
                            f"UPDATE social_service.`{table}` SET tenant_id=%s,updated_at=%s "
                            "WHERE id=%s AND tenant_id=%s AND room_id=%s",
                            (QUARANTINE_TENANT, row["updated_at"], row["id"],
                             SOURCE_TENANT, row["room_id"]),
                        )
                    else:
                        cursor.execute(
                            f"UPDATE social_service.`{table}` SET tenant_id=%s "
                            "WHERE id=%s AND tenant_id=%s AND room_id=%s",
                            (QUARANTINE_TENANT, row["id"], SOURCE_TENANT, row["room_id"]),
                        )
                    if cursor.rowcount != 1:
                        raise RuntimeError(f"{table}: candidate changed during quarantine")
            for table in TABLES:
                if fetch_rows(cursor, table, SOURCE_TENANT):
                    raise RuntimeError(f"{table}: platform fixture rows remain")
            quarantined_rows = expected_rows(cursor, QUARANTINE_TENANT)
            assert_rows_match(original_rows, quarantined_rows, normalize_tenant=True)
            connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    print(json.dumps({
        "mode": "APPLIED", "sourceTenant": SOURCE_TENANT,
        "quarantineTenant": QUARANTINE_TENANT,
        "rowsMoved": {table: len(rows) for table, rows in original_rows.items()},
        "backupPath": str(backup_path), "backupSha256": backup_sha,
        "tableFingerprints": backup["tableFingerprints"],
        "sweeperNote": "backup is the restore source; lease sweeper can mutate quarantined rows",
    }, indent=2))


def restore(backup_path: Path, expected_sha: str):
    raw = backup_path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected_sha:
        raise RuntimeError("backup SHA-256 does not match")
    backup = decode_backup(json.loads(raw))
    if backup.get("format") != "local-social-room-quarantine-v1":
        raise RuntimeError("unrecognized backup format")
    if backup.get("sourceTenant") != SOURCE_TENANT or backup.get("quarantineTenant") != QUARANTINE_TENANT:
        raise RuntimeError("backup tenant mismatch")
    original_rows = backup["rows"]
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("START TRANSACTION")
            for table in TABLES:
                if fetch_rows(cursor, table, SOURCE_TENANT, lock=True):
                    raise RuntimeError(f"{table}: platform already has fixture IDs")
            current = expected_rows(cursor, QUARANTINE_TENANT, lock=True)
            for table in TABLES:
                if {row["id"] for row in current[table]} != {row["id"] for row in original_rows[table]}:
                    raise RuntimeError(f"{table}: quarantined ID set changed")
            for table in reversed(TABLES):
                for row in original_rows[table]:
                    columns = tuple(row)
                    assignments = ",".join(f"`{column}`=%s" for column in columns if column != "id")
                    values = [row[column] for column in columns if column != "id"]
                    cursor.execute(
                        f"UPDATE social_service.`{table}` SET {assignments} "
                        "WHERE id=%s AND tenant_id=%s",
                        (*values, row["id"], QUARANTINE_TENANT),
                    )
                    if cursor.rowcount != 1:
                        raise RuntimeError(f"{table}: restore update count changed")
            restored = expected_rows(cursor, SOURCE_TENANT)
            assert_rows_match(original_rows, restored)
            for table in TABLES:
                if fetch_rows(cursor, table, QUARANTINE_TENANT):
                    raise RuntimeError(f"{table}: quarantine rows remain after restore")
            connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    print(json.dumps({"mode": "RESTORED", "rowsRestored":
                      {table: len(rows) for table, rows in original_rows.items()}}, indent=2))


def main():
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--apply", action="store_true")
    action.add_argument("--restore", type=Path)
    parser.add_argument("--backup-sha256")
    args = parser.parse_args()
    if args.apply:
        apply_quarantine()
    else:
        if not args.backup_sha256 or len(args.backup_sha256) != 64:
            raise SystemExit("--restore requires the recorded --backup-sha256")
        restore(args.restore, args.backup_sha256)


if __name__ == "__main__":
    main()
