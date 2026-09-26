"""Move only 74 proven local support fixtures out of the platform tenant.

Dry run by default. --apply takes a full owner-table backup outside Git, locks
and rechecks exact IDs/facts, then performs a single guarded transaction.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
from datetime import date, datetime, timezone

import pymysql


SOURCE = "platform"
FIXTURE = "local-support-fixture"
FIXTURE_ID = "local-real-10x-v1"
DEMO_CATEGORIES = ["TECHNICAL", "CONTENT_CORRECTION", "BILLING", "ACCOUNT_ACCESS"]
DEMO_STATES = ["OPEN", "OPEN", "ACKNOWLEDGED", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]
DEMO_PREFIX = "æ¼”ç¤ºå·¥å• "
DEMO_MIDDLE = "ï¼šäººå·¥æµ‹è¯•ç”¨ï¼Œ"
BULK_SUMMARY = "这是第{index}条本地拟真数据，用于英语学习闭环验证，覆盖听说读写与复习场景，内容安全无敏感信息。"
EXPECTED = {"bulk": 55, "local10x": 10, "adminseed": 1, "demo": 8}


def sha(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def stable_uuid(namespace, index):
    value = sha(f"{FIXTURE_ID}:{namespace}:{index}")[:32]
    return f"{value[:8]}-{value[8:12]}-4{value[13:16]}-8{value[17:20]}-{value[20:]}"


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def attachment_array(row):
    payload = row["attachments_json"]
    return isinstance(json.loads(payload), list)


def classify(row, demo_subject):
    require(row["tenant_id"] == SOURCE, "candidate source tenant changed")
    ticket_id = row["ticket_id"]
    resource = row["resource_ref"]
    summary = row["redacted_summary"]
    fingerprint = row["description_fingerprint"]
    require(re.fullmatch(r"[a-f0-9]{64}", fingerprint) is not None,
            "candidate fingerprint is not SHA-256")
    require(attachment_array(row), "candidate attachment shape changed")

    bulk = re.fullmatch(r"bulk-100x-support_ticket-resource-(\d{4})", resource)
    if bulk:
        index = int(bulk.group(1))
        require(46 <= index <= 100, "bulk fixture index outside proven range")
        require(ticket_id != "" and re.fullmatch(r"[a-f0-9-]{36}", ticket_id) is not None,
                "bulk ticket ID shape changed")
        require(summary == BULK_SUMMARY.format(index=index), "bulk summary changed")
        require(row["last_audit_id"] == f"bulk-100x-support_ticket-last_audit-{index:04d}",
                "bulk last-audit marker changed")
        require(row["ticket_version"] == index, "bulk ticket version changed")
        return "bulk", index

    local = re.fullmatch(r"本地测试工单摘要 (\d{1,2})", summary)
    if local:
        index = int(local.group(1))
        require(1 <= index <= 10, "local-10x fixture index outside range")
        require(ticket_id == stable_uuid("support-ticket", index), "local-10x ticket ID changed")
        require(row["requester_subject"] == stable_uuid("principal", index),
                "local-10x requester changed")
        require(resource == f"local-10x-ticket-resource-{index:02d}",
                "local-10x resource changed")
        require(fingerprint == sha(f"{FIXTURE_ID}:ticket:{index}"),
                "local-10x fingerprint changed")
        require(row["last_audit_id"] == f"local-10x-admin-audit-{index:02d}",
                "local-10x audit link changed")
        require(row["category"] == "TECHNICAL" and row["ticket_version"] == 1,
                "local-10x category or version changed")
        return "local10x", index

    if ticket_id == "ticket-local-001":
        require(row["requester_subject"] == "local-fixture", "admin seed requester changed")
        require(summary == "Local fixture support ticket metadata", "admin seed summary changed")
        require(resource == "learner-local-profile", "admin seed resource changed")
        require(fingerprint == sha("local-support-ticket-001"), "admin seed fingerprint changed")
        require(row["last_audit_id"] is None and row["ticket_version"] == 1,
                "admin seed link or version changed")
        return "adminseed", 1

    demo = re.fullmatch(re.escape(DEMO_PREFIX) + r"([1-8])" + re.escape(DEMO_MIDDLE)
                        + r"([A-Z_]+)", summary)
    if demo and row["requester_subject"] == demo_subject:
        index = int(demo.group(1))
        category = DEMO_CATEGORIES[(index - 1) % 4]
        require(demo.group(2) == category and row["category"] == category,
                "demo category changed")
        require(row["priority"] == ("HIGH" if (index - 1) % 2 else "NORMAL"),
                "demo priority changed")
        require(row["ticket_status"] == DEMO_STATES[(index - 1) % 6],
                "demo status changed")
        require(resource == "local-fixture" and row["last_audit_id"] is None,
                "demo resource or audit link changed")
        require(row["ticket_version"] == 1 and str(row["created_at"]).startswith("2026-09-17"),
                "demo version or seed date changed")
        require(re.fullmatch(r"[a-f0-9-]{36}", ticket_id) is not None,
                "demo ticket ID shape changed")
        return "demo", index

    return None


def json_default(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return {"hex": value.hex()}
    raise TypeError(type(value).__name__)


def backup(rows, counts):
    folder = Path("C:/Temp/cloudstudy-support-quarantine")
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = folder / f"support-ticket-before-{stamp}.json"
    payload = json.dumps({"capturedAtUtc": stamp, "sourceTenant": SOURCE,
                          "targetTenant": FIXTURE, "counts": counts, "allPlatformRows": rows},
                         ensure_ascii=False, indent=2, default=json_default).encode("utf-8")
    with output.open("xb") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    digest = hashlib.sha256(payload).hexdigest()
    return str(output), digest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    host = os.environ.get("MYSQL_HOST", "127.0.0.1")
    port = int(os.environ.get("MYSQL_PORT", "13306"))
    require(host in {"127.0.0.1", "localhost", "::1"} and port == 13306,
            "refusing nonlocal MySQL target")
    connection = pymysql.connect(
        host=host, port=port, user=os.environ.get("MYSQL_ADMIN_USER", "root"),
        password=os.environ.get("MYSQL_ROOT_PASSWORD", "root-local-only"),
        database="admin_ops_service", charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor, autocommit=False)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT principal_id FROM iam_service.iam_account "
                           "WHERE identifier='demo@local.invalid' AND status='ACTIVE'")
            demo = cursor.fetchall()
            require(len(demo) == 1, "demo account provenance is not unique")
            demo_subject = demo[0]["principal_id"]
            cursor.execute("SELECT * FROM support_ticket WHERE tenant_id=%s "
                           "ORDER BY ticket_id FOR UPDATE", (SOURCE,))
            rows = cursor.fetchall()
            require(len(rows) == 101, "platform ticket count changed from audited snapshot")
            families = {name: {} for name in EXPECTED}
            candidates = []
            unknown = []
            for row in rows:
                result = classify(row, demo_subject)
                if result is None:
                    unknown.append(row)
                    continue
                family, index = result
                require(index not in families[family], "duplicate fixture family index")
                families[family][index] = row
                candidates.append(row)
            counts = {name: len(entries) for name, entries in families.items()}
            require(counts == EXPECTED and len(candidates) == 74 and len(unknown) == 27,
                    "fixture/unknown distribution changed")
            require(set(families["bulk"]) == set(range(46, 101)), "bulk index coverage changed")
            require(set(families["local10x"]) == set(range(1, 11)), "local index coverage changed")
            require(set(families["demo"]) == set(range(1, 9)), "demo index coverage changed")
            ids = {row["ticket_id"] for row in candidates}
            require(len(ids) == 74, "candidate IDs are not unique")
            cursor.execute("SELECT COUNT(*) AS n FROM support_ticket WHERE tenant_id=%s", (FIXTURE,))
            require(cursor.fetchone()["n"] == 0, "target fixture tenant is already populated")
            cursor.execute("SELECT result_json FROM admin_idempotency")
            require(not any(any(ticket_id in str(row["result_json"]) for ticket_id in ids)
                            for row in cursor.fetchall()), "candidate has idempotency result link")
            cursor.execute("SELECT payload_json FROM admin_ops_outbox_event")
            require(not any(any(ticket_id in str(row["payload_json"]) for ticket_id in ids)
                            for row in cursor.fetchall()), "candidate has outbox link")
            cursor.execute("SELECT audit_id FROM admin_audit_record "
                           "WHERE audit_id LIKE 'local-10x-admin-audit-%'")
            require(len(cursor.fetchall()) == 10, "local fixture audit chain changed")

            if not args.apply:
                connection.rollback()
                print(json.dumps({"dryRun": True, "sourceCount": len(rows),
                                  "candidateCounts": counts, "preservedUnknown": len(unknown),
                                  "writesDatabase": False}, ensure_ascii=False))
                return

            backup_path, backup_sha = backup(rows, counts)
            for row in candidates:
                changed = cursor.execute("UPDATE support_ticket SET tenant_id=%s, last_audit_id=NULL "
                                         "WHERE ticket_id=%s AND tenant_id=%s "
                                         "AND description_fingerprint=%s AND resource_ref=%s "
                                         "AND ticket_version=%s",
                                         (FIXTURE, row["ticket_id"], SOURCE,
                                          row["description_fingerprint"], row["resource_ref"],
                                          row["ticket_version"]))
                require(changed == 1, "exact ticket update guard failed")
            cursor.execute("SELECT tenant_id, COUNT(*) AS n FROM support_ticket GROUP BY tenant_id")
            post = {row["tenant_id"]: row["n"] for row in cursor.fetchall()}
            require(post.get(SOURCE) == 27 and post.get(FIXTURE) == 74,
                    "post-update tenant counts are wrong")
            connection.commit()
            print(json.dumps({"applied": True, "moved": 74, "preservedUnknown": 27,
                              "postCounts": post, "backup": backup_path,
                              "backupSha256": backup_sha}, ensure_ascii=False))
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()
