"""Reversibly withdraw only the audited local synthetic offline packages.

Dry-run is the default. Apply makes a full-column backup outside Git, checks
the same rows under locks, then atomically withdraws packages and isolates
their synthetic downloads. Restore requires the backup file's SHA-256.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import pymysql

from audit_local_offline_package_fixtures import ROOT, digest


SOURCE_TENANT = "platform"
QUARANTINE_TENANT = "local-offline-fixture"
BACKUP_FORMAT = "local-offline-package-quarantine-v1"
PACKAGE_TABLE = "notification_service.notification_offline_package"
DOWNLOAD_TABLE = "notification_service.notification_offline_download"
EXPECTED_IDS = tuple(
    [f"bulk-100x-notification_offli-package-{index:04d}" for index in range(12, 101)]
    + [f"local-10x-offline-package-{index:02d}" for index in range(1, 11)]
)
EXPECTED_ID_SET = set(EXPECTED_IDS)
AUDIT_SCRIPT = ROOT / "scripts" / "database" / "audit_local_offline_package_fixtures.py"
AUDIT_OUTPUT = ROOT / "artifacts" / "audit-2026-09-23" / "offline-package-fixtures" / "dry-run.json"
APPLIED_OUTPUT = ROOT / "artifacts" / "audit-2026-09-23" / "offline-package-fixtures" / "applied.json"


def connect():
    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    port = int(os.getenv("MYSQL_PORT", "13306"))
    if (host, port) != ("127.0.0.1", 13306):
        raise RuntimeError("Only the fixed local MySQL 127.0.0.1:13306 is allowed")
    return pymysql.connect(
        host=host, port=port, user=os.getenv("MYSQL_ADMIN_USER", "root"),
        password=os.getenv("MYSQL_ROOT_PASSWORD", "root-local-only"),
        charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor, autocommit=False,
    )


def encode(value):
    if isinstance(value, datetime):
        return {"$type": "datetime", "value": value.isoformat(sep=" ")}
    if isinstance(value, date):
        return {"$type": "date", "value": value.isoformat()}
    if isinstance(value, bytes):
        return {"$type": "bytes", "value": value.hex()}
    if isinstance(value, Decimal):
        return {"$type": "decimal", "value": str(value)}
    raise TypeError(type(value).__name__)


def decode(value):
    if isinstance(value, list):
        return [decode(child) for child in value]
    if isinstance(value, dict):
        if value.get("$type") == "datetime":
            return datetime.fromisoformat(value["value"])
        if value.get("$type") == "date":
            return date.fromisoformat(value["value"])
        if value.get("$type") == "bytes":
            return bytes.fromhex(value["value"])
        if value.get("$type") == "decimal":
            return Decimal(value["value"])
        return {key: decode(child) for key, child in value.items()}
    return value


def run_inventory():
    # The separate read-only inventory scans other schemas and MinIO as well.
    subprocess.run([sys.executable, str(AUDIT_SCRIPT)], cwd=ROOT, check=True,
                   capture_output=True, text=True)
    return json.loads(AUDIT_OUTPUT.read_text(encoding="utf-8"))


def run_independent_audit():
    result = run_inventory()
    if not all(result["quarantinePreconditions"].values()):
        raise RuntimeError("read-only cross-schema/object audit has blockers")
    if set(result["packageCounts"]["candidateIds"]) != EXPECTED_ID_SET:
        raise RuntimeError("audited package ID set differs from the frozen exact scope")
    if result["downloadReferences"]["candidateRows"] != 99:
        raise RuntimeError("expected 99 synthetic download facts")
    if result["downloadReferences"]["outsideCandidateRows"] != 1:
        raise RuntimeError("unexpected offline downloads outside exact fixture scope")
    return result


def rows_for_ids(cursor, *, lock=False):
    placeholders = ",".join(["%s"] * len(EXPECTED_IDS))
    suffix = " FOR UPDATE" if lock else ""
    cursor.execute(f"SELECT * FROM {PACKAGE_TABLE} WHERE package_id IN ({placeholders}) "
                   f"ORDER BY package_id{suffix}", EXPECTED_IDS)
    packages = list(cursor.fetchall())
    cursor.execute(f"SELECT * FROM {DOWNLOAD_TABLE} WHERE package_id IN ({placeholders}) "
                   f"ORDER BY download_id{suffix}", EXPECTED_IDS)
    downloads = list(cursor.fetchall())
    if len(packages) != 99 or {row["package_id"] for row in packages} != EXPECTED_ID_SET:
        raise RuntimeError("exact package rows changed")
    if len(downloads) != 99 or {row["package_id"] for row in downloads} != EXPECTED_ID_SET:
        raise RuntimeError("exact download rows changed")
    return {"packages": packages, "downloads": downloads}


def assert_no_quarantine_principal(cursor):
    cursor.execute("SELECT COUNT(*) n FROM iam_service.iam_principal WHERE tenant_id=%s",
                   (QUARANTINE_TENANT,))
    if cursor.fetchone()["n"]:
        raise RuntimeError("offline fixture quarantine tenant has IAM principals")


def assert_source(rows, audit):
    if any(row["state"] != "PUBLISHED" for row in rows["packages"]):
        raise RuntimeError("a source package is no longer PUBLISHED")
    if any(row["tenant_id"] != SOURCE_TENANT for row in rows["downloads"]):
        raise RuntimeError("a source download is not in platform tenant")
    if digest(rows["packages"]) != audit["packageCounts"]["candidateFullRowsSha256"]:
        raise RuntimeError("package full-row hash differs from independent audit")


def assert_same_rows(original, current, *, quarantined=False):
    expected_packages = [dict(row, state="DELETED") for row in original["packages"]] if quarantined else original["packages"]
    expected_downloads = [dict(row, tenant_id=QUARANTINE_TENANT) for row in original["downloads"]] if quarantined else original["downloads"]
    if digest(expected_packages) != digest(current["packages"]):
        raise RuntimeError("package full-row hash differs from backup")
    if digest(expected_downloads) != digest(current["downloads"]):
        raise RuntimeError("download full-row hash differs from backup")


def assert_global_published(cursor, expected):
    cursor.execute(f"SELECT COUNT(*) n FROM {PACKAGE_TABLE} WHERE state='PUBLISHED'")
    if cursor.fetchone()["n"] != expected:
        raise RuntimeError("published package total changed")


def capture_backup(audit):
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("START TRANSACTION READ ONLY")
            assert_no_quarantine_principal(cursor)
            rows = rows_for_ids(cursor)
            assert_source(rows, audit)
            assert_global_published(cursor, 99)
            connection.rollback()
    finally:
        connection.close()
    backup = {
        "format": BACKUP_FORMAT,
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "sourceTenant": SOURCE_TENANT,
        "quarantineTenant": QUARANTINE_TENANT,
        "candidateIdsSha256": audit["packageCounts"]["candidateIdsSha256"],
        "tableSha256": {name: digest(items) for name, items in rows.items()},
        "rows": rows,
    }
    raw = (json.dumps(backup, ensure_ascii=False, sort_keys=True, indent=2, default=encode) + "\n").encode("utf-8")
    directory = Path(os.getenv("OFFLINE_FIXTURE_BACKUP_DIR", "C:/Temp")).resolve()
    if not directory.is_dir() or directory.is_relative_to(ROOT):
        raise RuntimeError("offline backup directory must already exist outside the repository")
    path = directory / ("cloudstudy-offline-packages-before-" +
                        datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json")
    with path.open("xb") as handle:
        handle.write(raw)
        handle.flush()
        os.fsync(handle.fileno())
    return path, hashlib.sha256(raw).hexdigest(), rows, backup


def apply():
    audit = run_independent_audit()
    path, backup_sha, original, backup = capture_backup(audit)
    # Repeat the external inventory after backup; the locked transaction below
    # independently checks all targeted full rows before any update.
    current_audit = run_independent_audit()
    if current_audit["packageCounts"]["candidateFullRowsSha256"] != audit["packageCounts"]["candidateFullRowsSha256"]:
        raise RuntimeError("package inventory changed after backup")
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("START TRANSACTION")
            assert_no_quarantine_principal(cursor)
            current = rows_for_ids(cursor, lock=True)
            assert_same_rows(original, current)
            assert_source(current, audit)
            assert_global_published(cursor, 99)
            cursor.execute(f"UPDATE {PACKAGE_TABLE} SET state='DELETED' "
                           "WHERE state='PUBLISHED' AND package_id IN (" +
                           ",".join(["%s"] * len(EXPECTED_IDS)) + ")", EXPECTED_IDS)
            if cursor.rowcount != 99:
                raise RuntimeError("package withdrawal did not affect exactly 99 rows")
            cursor.execute(f"UPDATE {DOWNLOAD_TABLE} SET tenant_id=%s "
                           "WHERE tenant_id=%s AND package_id IN (" +
                           ",".join(["%s"] * len(EXPECTED_IDS)) + ")",
                           (QUARANTINE_TENANT, SOURCE_TENANT, *EXPECTED_IDS))
            if cursor.rowcount != 99:
                raise RuntimeError("download isolation did not affect exactly 99 rows")
            assert_same_rows(original, rows_for_ids(cursor), quarantined=True)
            assert_global_published(cursor, 0)
            connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    evidence = {
        "mode": "APPLIED", "packagesWithdrawn": 99, "downloadsIsolated": 99,
        "remainingPublished": 0, "remainingRealPublished": 0,
        "backupPath": str(path), "backupSha256": backup_sha,
        "tableSha256Before": backup["tableSha256"],
        "candidateIdsSha256": backup["candidateIdsSha256"],
        "otherStructuredReferences": 0, "offlineObjectBytes": 0,
    }
    APPLIED_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    APPLIED_OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence, ensure_ascii=False, indent=2))


def load_backup(path: Path, expected_sha: str):
    raw = path.resolve().read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected_sha:
        raise RuntimeError("backup SHA-256 mismatch")
    backup = decode(json.loads(raw))
    if backup.get("format") != BACKUP_FORMAT:
        raise RuntimeError("unrecognized offline backup format")
    if (backup.get("sourceTenant"), backup.get("quarantineTenant")) != (SOURCE_TENANT, QUARANTINE_TENANT):
        raise RuntimeError("backup tenant mismatch")
    original = backup["rows"]
    if {row["package_id"] for row in original["packages"]} != EXPECTED_ID_SET:
        raise RuntimeError("backup package ID set mismatch")
    if len(original["downloads"]) != 99 or {row["package_id"] for row in original["downloads"]} != EXPECTED_ID_SET:
        raise RuntimeError("backup download ID set mismatch")
    for name, rows in original.items():
        if digest(rows) != backup["tableSha256"][name]:
            raise RuntimeError(f"backup {name} full-row hash mismatch")
    return original


def verify(path: Path, expected_sha: str):
    original = load_backup(path, expected_sha)
    inventory = run_inventory()
    if inventory["packageCounts"]["published"] != 0:
        raise RuntimeError("inventory found a published offline package")
    if (inventory["otherReferences"]["matches"]
            or inventory["media"]["offlineNamedMinioObjects"]
            or inventory["media"]["offlineNamedAssets"]
            or inventory["media"]["offlineNamedRenditions"]):
        raise RuntimeError("inventory found an offline reference or object")
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("START TRANSACTION READ ONLY")
            assert_no_quarantine_principal(cursor)
            assert_same_rows(original, rows_for_ids(cursor), quarantined=True)
            assert_global_published(cursor, 0)
            connection.rollback()
    finally:
        connection.close()
    result = {"mode": "VERIFIED", "packagesWithdrawn": 99, "downloadsIsolated": 99,
              "remainingPublished": 0, "remainingRealPublished": 0,
              "backupSha256": expected_sha,
              "otherStructuredReferences": len(inventory["otherReferences"]["matches"]),
              "offlineNamedMinioObjects": inventory["media"]["offlineNamedMinioObjects"]}
    print(json.dumps(result, indent=2))


def restore(path: Path, expected_sha: str):
    original = load_backup(path, expected_sha)
    connection = connect()
    try:
        with connection.cursor() as cursor:
            cursor.execute("START TRANSACTION")
            assert_no_quarantine_principal(cursor)
            current = rows_for_ids(cursor, lock=True)
            assert_same_rows(original, current, quarantined=True)
            assert_global_published(cursor, 0)
            for table, key, rows in (
                (PACKAGE_TABLE, "package_id", original["packages"]),
                (DOWNLOAD_TABLE, "download_id", original["downloads"]),
            ):
                for row in rows:
                    columns = [column for column in row if column != key]
                    assignments = ",".join(f"`{column}`=%s" for column in columns)
                    cursor.execute(f"UPDATE {table} SET {assignments} WHERE `{key}`=%s",
                                   (*[row[column] for column in columns], row[key]))
                    if cursor.rowcount != 1:
                        raise RuntimeError(f"{table}: restore count changed")
            assert_same_rows(original, rows_for_ids(cursor))
            assert_global_published(cursor, 99)
            connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    print(json.dumps({"mode": "RESTORED", "packages": 99, "downloads": 99}, indent=2))


def main():
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--apply", action="store_true")
    action.add_argument("--verify", type=Path)
    action.add_argument("--restore", type=Path)
    parser.add_argument("--backup-sha256")
    args = parser.parse_args()
    if args.restore or args.verify:
        if not args.backup_sha256 or len(args.backup_sha256) != 64:
            raise RuntimeError("verify/restore requires the recorded --backup-sha256")
        if args.restore:
            restore(args.restore, args.backup_sha256)
        else:
            verify(args.verify, args.backup_sha256)
    elif args.apply:
        apply()
    else:
        audit = run_independent_audit()
        print(json.dumps({
            "mode": "DRY_RUN", "packages": 99, "downloads": 99,
            "candidateIdsSha256": audit["packageCounts"]["candidateIdsSha256"],
            "candidateFullRowsSha256": audit["packageCounts"]["candidateFullRowsSha256"],
            "otherStructuredReferences": len(audit["otherReferences"]["matches"]),
            "offlineObjectBytes": audit["media"]["offlineNamedMinioObjects"],
        }, indent=2))


if __name__ == "__main__":
    main()
