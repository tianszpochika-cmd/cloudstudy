"""Isolate known local analytics fixtures from the platform tenant.

Dry run by default. --apply requires exact current fingerprints, stores a full
four-table backup outside Git, and moves only those rows in one transaction.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
from datetime import date, datetime, timezone

import pymysql

if not __debug__:
    raise SystemExit("Refusing optimized Python: fixture safety assertions must remain enabled")


TABLE_KEYS = {
    "analytics_event_receipt": ("dedupe_key",),
    "analytics_event_journal": ("event_id",),
    "analytics_metric_projection": ("metric_id", "metric_version", "period_start", "dimension_key"),
    "analytics_recompute_job": ("job_id",),
}
EXPECTED = {
    "analytics_event_receipt": {"bulk": 89, "local10x": 10, "adminSeed": 1},
    "analytics_event_journal": {"bulk": 89, "local10x": 10, "adminSeed": 1},
    "analytics_metric_projection": {"bulk": 69, "local10x": 10, "adminSeed": 21},
    "analytics_recompute_job": {"bulk": 90, "local10x": 10, "adminSeed": 0},
}
SOURCE_TENANT = "platform"
FIXTURE_TENANT = "local-analytics-fixture"
ADMIN_METRICS = {
    "assessment_attempt": ("scoreBucket:FULL", "learning.v1", 3, 3, "analytics-assessment-watermark"),
    "learning_mastery_projection": ("projectionStatus:APPLIED", "learning.v1", 2, 0, "analytics-mastery-watermark"),
    "learning_review_queue": ("state:REVIEW_QUEUE", "learning.v1", 1, 0, "analytics-review-watermark"),
    "workflow.saga.started": ("currentStep:LEARNING_PROJECT", "workflow.v1", 1, 0, "analytics-workflow-watermark"),
    "growth_ledger": ("ledgerKind:SCORE", "growth.v1", 1, 45, "analytics-growth-watermark"),
    "leaderboard_projection": ("kind:FOCUS_MINUTES", "social.v1", 1, 20, "analytics-social-watermark"),
    "notification": ("channel:IN_APP", "notification.v1", 1, 0, "analytics-notification-watermark"),
}


def sha(value):
    return hashlib.sha256(value.encode()).hexdigest()


def local_index(value, prefix):
    match = re.fullmatch(re.escape(prefix) + r"(0[1-9]|10)", value)
    return int(match.group(1)) if match else None


def family(table, row):
    if table == "analytics_metric_projection":
        metric = row["metric_id"]
        bulk = re.fullmatch(r"bulk-100x-analytics_metric_p-metric-(\d{4})", metric)
        if bulk:
            index = int(bulk.group(1))
            suffix = bulk.group(1)
            assert 32 <= index <= 100
            assert row["projection_state"] == "READY"
            assert row["metric_version"] == f"bulk-100x-metric_v-{suffix}"
            assert row["dimension_key"] == f"bulk-100x-analytics_metric_p-dimension-{suffix}"
            assert row["error_code"] == f"bulk-100x-analytics_metric_p-error-{suffix}"
            assert row["source_watermark"] == f"bulk-100x-source_water-{suffix}"
            return "bulk"
        index = local_index(metric, "local-10x-metric-")
        if index:
            assert row["projection_state"] == "READY" and row["error_code"] is None
            assert row["metric_version"] == "metric-v1"
            assert row["dimension_key"] == f"local-dimension-{index}"
            assert row["source_watermark"] == sha(f"local-real-10x-v1:metric:{index}")
            assert str(row["period_start"]) == "2026-08-26"
            assert row["event_count"] == index and row["total_value"] == index * 10
            return "local10x"
        if metric in ADMIN_METRICS:
            dimension, version, count, total, watermark_seed = ADMIN_METRICS[metric]
            assert row["projection_state"] == "READY" and row["error_code"] is None
            assert row["dimension_key"] == dimension and row["metric_version"] == version
            assert row["event_count"] == count and row["total_value"] == total
            assert row["source_watermark"] == sha(watermark_seed)
            assert str(row["period_start"]) in {"2026-08-26", "2026-08-27", "2026-09-16"}
            return "adminSeed"
        raise AssertionError(f"unclassified platform projection: {metric}")

    id_column = "job_id" if table == "analytics_recompute_job" else "event_id"
    value = row[id_column]
    bulk_prefix = {
        "analytics_event_receipt": "bulk-100x-analytics_event_re-event-",
        "analytics_event_journal": "bulk-100x-analytics_event_jo-event-",
        "analytics_recompute_job": "bulk-100x-analytics_recomput-job-",
    }[table]
    match = re.fullmatch(re.escape(bulk_prefix) + r"(\d{4})", value)
    if match:
        index = int(match.group(1))
        assert (12 <= index <= 100) if table != "analytics_recompute_job" else (11 <= index <= 100)
        return "bulk"
    if table == "analytics_recompute_job":
        assert local_index(value, "local-10x-recompute-job-")
        return "local10x"
    if local_index(value, "local-10x-analytics-event-"):
        return "local10x"
    if value == "analytics-fixture-assessed-001":
        if table == "analytics_event_journal":
            payload = json.loads(row["sanitized_payload_json"])
            assert payload.get("tenantId") == row["tenant_id"]
        return "adminSeed"
    raise AssertionError(f"unclassified platform {table}: {value}")


def json_default(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.hex()
    raise TypeError(type(value).__name__)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    host = os.environ.get("MYSQL_HOST", "127.0.0.1")
    port = int(os.environ.get("MYSQL_PORT", "13306"))
    if host not in {"127.0.0.1", "localhost", "::1"} or port != 13306:
        raise SystemExit("Refusing nonlocal MySQL target")
    connection = pymysql.connect(
        host=host, port=port, user=os.environ.get("MYSQL_ADMIN_USER", "root"),
        password=os.environ.get("MYSQL_ROOT_PASSWORD", "root-local-only"),
        database="analytics_service", charset="utf8mb4", autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE")
            connection.begin()
            cursor.execute("""
                SELECT COUNT(*) AS n FROM information_schema.KEY_COLUMN_USAGE
                WHERE REFERENCED_TABLE_SCHEMA='analytics_service'
                  AND REFERENCED_TABLE_NAME IN
                    ('analytics_metric_projection','analytics_event_receipt',
                     'analytics_event_journal','analytics_recompute_job')
            """)
            assert cursor.fetchone()["n"] == 0, "unexpected foreign-key consumer"
            cursor.execute("SELECT COUNT(*) AS n FROM iam_service.iam_principal WHERE tenant_id=%s",
                           (FIXTURE_TENANT,))
            assert cursor.fetchone()["n"] == 0, "fixture tenant has a principal"
            rows_by_table = {}
            summary = {}
            quarantined_summary = {}
            for table, keys in TABLE_KEYS.items():
                cursor.execute(f"SELECT * FROM `{table}` WHERE tenant_id=%s FOR UPDATE", (SOURCE_TENANT,))
                rows = cursor.fetchall()
                counts = {name: 0 for name in EXPECTED[table]}
                for row in rows:
                    counts[family(table, row)] += 1
                cursor.execute(f"SELECT * FROM `{table}` WHERE tenant_id=%s FOR UPDATE", (FIXTURE_TENANT,))
                quarantined_rows = cursor.fetchall()
                quarantined_counts = {name: 0 for name in EXPECTED[table]}
                for row in quarantined_rows:
                    quarantined_counts[family(table, row)] += 1
                rows_by_table[table] = rows
                summary[table] = counts
                quarantined_summary[table] = quarantined_counts

            if all(summary[table] == {name: 0 for name in EXPECTED[table]}
                   and quarantined_summary[table] == EXPECTED[table] for table in TABLE_KEYS):
                connection.rollback()
                print(json.dumps({"mode": "ALREADY_APPLIED", "sourceTenant": SOURCE_TENANT,
                                  "fixtureTenant": FIXTURE_TENANT,
                                  "summary": quarantined_summary}, indent=2))
                return
            assert all(summary[table] == EXPECTED[table]
                       and quarantined_summary[table] == {name: 0 for name in EXPECTED[table]}
                       for table in TABLE_KEYS), "mixed, unknown or altered fixture state"

            if not args.apply:
                connection.rollback()
                print(json.dumps({"mode": "DRY_RUN", "sourceTenant": SOURCE_TENANT,
                                  "fixtureTenant": FIXTURE_TENANT, "summary": summary}, indent=2))
                return

            backup_dir = Path("C:/Temp")
            backup_dir.mkdir(exist_ok=True)
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            backup_path = backup_dir / f"cloudstudy-analytics-fixture-before-{timestamp}.json"
            backup = {"sourceTenant": SOURCE_TENANT, "fixtureTenant": FIXTURE_TENANT,
                      "createdAt": datetime.now(timezone.utc).isoformat(),
                      "tables": rows_by_table}
            backup_bytes = (json.dumps(backup, ensure_ascii=False, indent=2, default=json_default) + "\n").encode()
            with backup_path.open("xb") as handle:
                handle.write(backup_bytes)
            digest = hashlib.sha256(backup_bytes).hexdigest()

            for table, rows in rows_by_table.items():
                for row in rows:
                    keys = TABLE_KEYS[table]
                    predicates = " AND ".join(f"`{key}`=%s" for key in keys)
                    updates = "tenant_id=%s"
                    values = [FIXTURE_TENANT]
                    if table == "analytics_event_journal" and row["event_id"] == "analytics-fixture-assessed-001":
                        updates += ", sanitized_payload_json=JSON_SET(sanitized_payload_json, '$.tenantId', %s)"
                        values.append(FIXTURE_TENANT)
                    values.extend([SOURCE_TENANT, *(row[key] for key in keys)])
                    cursor.execute(f"UPDATE `{table}` SET {updates} WHERE tenant_id=%s AND {predicates}", values)
                    assert cursor.rowcount == 1, f"{table}: unexpected update count for {values[-1]}"

            for table in TABLE_KEYS:
                cursor.execute(f"SELECT tenant_id, COUNT(*) AS n FROM `{table}` GROUP BY tenant_id")
                tenants = {row["tenant_id"]: row["n"] for row in cursor.fetchall()}
                assert tenants.get(SOURCE_TENANT, 0) == 0, f"{table}: platform fixture remains"
                assert tenants.get(FIXTURE_TENANT, 0) == 100, f"{table}: quarantine count mismatch"
            connection.commit()
            print(json.dumps({"mode": "APPLIED", "summary": summary,
                              "backupPath": str(backup_path), "backupSha256": digest}, indent=2))
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()
