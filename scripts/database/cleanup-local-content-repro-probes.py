"""Precisely remove three unreferenced local content repro probes.

Dry-run by default. --apply requires a current 14-schema reference scan,
row-level guards, and a SQL backup. This is a local UAT data repair, not a
general content deletion facility.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

import pymysql


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "artifacts" / "uat-2026-09-23" / "admin-content-data"
CODES = (
    "REPRO-PACK-MUBA8O9Q",
    "REPRO-PACK-MUBBRQQR",
    "T14-PACK-MUBIT0T8",
)
LEXEME_IDS = (
    "lx_497c3d9da4b2", "lx_855d74f87dcc", "lx_91e9808b9165",
    "lx_93f31fca779e", "lx_d2341a691bfd", "lx_08c6310113bc",
    "lx_0ce1fc15c3e4", "lx_3b1a5d7d1dd7", "lx_67d7cbf77da5",
    "lx_855fc18a54b2", "lx_f489a97447eb",
)
ITEM_ID = "qi_3da8de5c1be0"
ACTOR = "fae4ed5e-f1de-4adf-8423-a2c91a457f83"
SCOPES = (f"platform:{ACTOR}:lexeme.upsert", f"platform:{ACTOR}:item.upsert")
EXPECTED_IDEMPOTENCY = 14
BACKUP_PATH = OUTPUT / "backup-repro-t14-3-probes.sql"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def placeholders(values: tuple[str, ...]) -> str:
    return ",".join("%s" for _ in values)


def quoted(values: tuple[str, ...]) -> str:
    for value in values:
        require(bool(re.fullmatch(r"[A-Za-z0-9:_.-]+", value)), "unsafe backup selector")
    return ",".join(f"'{value}'" for value in values)


def count(cursor: pymysql.cursors.Cursor, sql: str, params: tuple = ()) -> int:
    cursor.execute(sql, params)
    return int(cursor.fetchone()[0])


def scan_all_owner_refs() -> dict:
    script = OUTPUT / "audit-probes.mjs"
    result = subprocess.run(["node", str(script)], cwd=ROOT, capture_output=True, text=True, check=True)
    finding = json.loads((OUTPUT / "reference-scan.json").read_text(encoding="utf-8"))
    require(finding["scannedTables"] == 173, "owner table inventory changed")
    missing = set(finding.get("missingCodes", []))
    require(
        (len(finding["candidates"]) == 11 and not missing)
        or (len(finding["candidates"]) == 8 and missing == set(CODES)),
        "reference scan candidates changed",
    )
    keys = set(CODES + LEXEME_IDS + (ITEM_ID,))
    allowed = {"content_service.lexeme", "content_service.content_item", "content_service.content_idempotency_record"}
    unexpected = [hit for hit in finding["hits"] if hit["code"] in keys and hit["source"] not in allowed]
    require(not unexpected, f"external reference found: {unexpected}")
    return {"scannedTables": finding["scannedTables"], "candidateKeys": len(keys), "allowedChildAndReceiptHits": sum(1 for hit in finding["hits"] if hit["code"] in keys)}


def guarded_rows(cursor: pymysql.cursors.Cursor) -> dict:
    cursor.execute(
        f"SELECT content_code,content_id,tenant_id,kind,title,created_by,created_at,"
        f"current_published_version_id,content_epoch,projection_version "
        f"FROM content_service.content_definition WHERE content_code IN ({placeholders(CODES)}) FOR UPDATE",
        CODES,
    )
    definitions = cursor.fetchall()
    require(len(definitions) == 3, "definition count changed")
    by_code = {row[0]: row for row in definitions}
    for code in CODES:
        row = by_code[code]
        require(row[1] == code and row[2] == "platform" and row[3] == "VOCABULARY", f"definition identity changed: {code}")
        require(row[4] == code and row[5] == ACTOR, f"definition provenance changed: {code}")
        require(str(row[6]).startswith("2026-09-21") and row[7] is None and row[8] == 0 and row[9] == 0, f"definition lifecycle changed: {code}")
    require(count(cursor, f"SELECT COUNT(*) FROM content_service.content_version WHERE content_id IN ({placeholders(CODES)})", CODES) == 0, "version appeared")

    cursor.execute(
        f"SELECT lexeme_id,pack_code,tenant_id,headword,availability,created_by,first_reviewer,final_reviewer,publisher,published_fields_json "
        f"FROM content_service.lexeme WHERE pack_code IN ({placeholders(CODES)}) FOR UPDATE",
        CODES,
    )
    lexemes = cursor.fetchall()
    require(len(lexemes) == 11 and {row[0] for row in lexemes} == set(LEXEME_IDS), "lexeme identities changed")
    for row in lexemes:
        require(row[1] in CODES and row[2] == "platform" and row[4] == "DRAFT" and row[5] == ACTOR, "lexeme identity/status changed")
        require(all(value is None for value in row[6:10]), "lexeme review/publication appeared")
        require(row[3].startswith("repro-") or row[3] == "batch-one", "lexeme is not an identified probe")

    cursor.execute(
        f"SELECT item_id,pack_code,tenant_id,stem,availability,created_by,first_reviewer,final_reviewer,publisher "
        f"FROM content_service.content_item WHERE pack_code IN ({placeholders(CODES)}) FOR UPDATE",
        CODES,
    )
    items = cursor.fetchall()
    require(len(items) == 1 and items[0][:6] == (ITEM_ID, CODES[2], "platform", "batch stem", "DRAFT", ACTOR), "item identity/status changed")
    require(all(value is None for value in items[0][6:9]), "item review/publication appeared")

    cursor.execute(
        f"SELECT scope,idempotency_key,status,response_json,recorded_at "
        f"FROM content_service.content_idempotency_record WHERE scope IN ({placeholders(SCOPES)}) "
        f"AND (JSON_UNQUOTE(JSON_EXTRACT(response_json,'$.lexemeId')) IN ({placeholders(LEXEME_IDS)}) "
        f"OR JSON_UNQUOTE(JSON_EXTRACT(response_json,'$.itemId'))=%s) FOR UPDATE",
        SCOPES + LEXEME_IDS + (ITEM_ID,),
    )
    receipts = cursor.fetchall()
    require(len(receipts) == EXPECTED_IDEMPOTENCY, "idempotency receipt count changed")
    receipt_keys = []
    for scope, key, status, body, recorded_at in receipts:
        require(scope in SCOPES and status == "COMPLETED" and str(recorded_at).startswith("2026-09-21"), "receipt provenance changed")
        require(key.startswith("reproadm-") or key.startswith("t14-"), "receipt key is not a test probe")
        obj = json.loads(body) if isinstance(body, str) else body
        require(obj.get("lexemeId") in LEXEME_IDS or obj.get("itemId") == ITEM_ID, "receipt points elsewhere")
        receipt_keys.append(key)
    require(len(set(receipt_keys)) == EXPECTED_IDEMPOTENCY, "duplicate receipt keys")

    direct_refs = {
        "publicProjection": count(cursor, f"SELECT COUNT(*) FROM content_service.content_public_projection WHERE content_id IN ({placeholders(CODES)})", CODES),
        "cacheInvalidation": count(cursor, f"SELECT COUNT(*) FROM content_service.content_cache_invalidation WHERE content_id IN ({placeholders(CODES)})", CODES),
        "schedule": count(cursor, f"SELECT COUNT(*) FROM content_service.scheduled_publish_task WHERE pack_code IN ({placeholders(CODES)})", CODES),
        "outbox": count(cursor, f"SELECT COUNT(*) FROM content_service.content_outbox_event WHERE aggregate_id IN ({placeholders(CODES)}) OR CAST(payload_json AS CHAR) REGEXP %s", CODES + ("REPRO-PACK-MUBA8O9Q|REPRO-PACK-MUBBRQQR|T14-PACK-MUBIT0T8",)),
        "pronunciation": count(cursor, f"SELECT COUNT(*) FROM content_service.lexeme_pronunciation WHERE lexeme_id IN ({placeholders(LEXEME_IDS)})", LEXEME_IDS),
        "legacyCourse": count(cursor, f"SELECT COUNT(*) FROM content_service.b25_content_course WHERE content_code IN ({placeholders(CODES)})", CODES),
        "legacyItem": count(cursor, f"SELECT COUNT(*) FROM content_service.b25_content_item WHERE content_code IN ({placeholders(CODES)})", CODES),
        "assessmentSession": count(cursor, f"SELECT COUNT(*) FROM assessment_service.b10_assessment_session WHERE content_code IN ({placeholders(CODES)}) OR alternative_content_code IN ({placeholders(CODES)})", CODES + CODES),
        "assessmentB25Session": count(cursor, f"SELECT COUNT(*) FROM assessment_service.b25_assessment_session WHERE content_code IN ({placeholders(CODES)})", CODES),
        "assessmentItemRule": count(cursor, f"SELECT COUNT(*) FROM assessment_service.b25_assessment_item_rule WHERE content_code IN ({placeholders(CODES)})", CODES),
        "learnerTask": count(cursor, f"SELECT COUNT(*) FROM learner_service.b25_learner_daily_task WHERE content_code IN ({placeholders(CODES)})", CODES),
        "learningTask": count(cursor, f"SELECT COUNT(*) FROM learning_service.learning_task WHERE content_id IN ({placeholders(CODES)})", CODES),
        "learningInteraction": count(cursor, f"SELECT COUNT(*) FROM learning_service.b3_learning_interaction WHERE resource_key IN ({placeholders(CODES)})", CODES),
        "learningMastery": count(cursor, f"SELECT COUNT(*) FROM learning_service.learning_runtime_mastery_projection WHERE item_id IN ({placeholders(LEXEME_IDS + (ITEM_ID,))})", LEXEME_IDS + (ITEM_ID,)),
        "learningReview": count(cursor, f"SELECT COUNT(*) FROM learning_service.learning_runtime_review_event WHERE item_id IN ({placeholders(LEXEME_IDS + (ITEM_ID,))})", LEXEME_IDS + (ITEM_ID,)),
    }
    require(all(value == 0 for value in direct_refs.values()), f"direct references appeared: {direct_refs}")
    return {"definitions": 3, "lexemes": len(lexemes), "items": len(items), "receipts": len(receipts), "directReferences": direct_refs, "receiptKeys": tuple(receipt_keys)}


def dump_table(table: str, where: str, password: str) -> bytes:
    command = [
        "docker", "exec", "-i", "-e", f"MYSQL_PWD={password}", "yuxuexing-local-mysql-1",
        "mysqldump", "-uroot", "--default-character-set=utf8mb4", "--set-gtid-purged=OFF",
        "--no-create-info", "--compact", "--skip-extended-insert", "--skip-add-locks",
        "--skip-disable-keys", "--skip-lock-tables", "--no-tablespaces", f"--where={where}",
        "content_service", table,
    ]
    return subprocess.run(command, capture_output=True, check=True).stdout


def write_backup(receipt_keys: tuple[str, ...], password: str) -> dict:
    require(not BACKUP_PATH.exists(), "backup already exists; refusing overwrite")
    specs = (
        ("content_definition", f"content_code IN ({quoted(CODES)}) AND created_by='{ACTOR}'"),
        ("lexeme", f"lexeme_id IN ({quoted(LEXEME_IDS)}) AND created_by='{ACTOR}'"),
        ("content_item", f"item_id='{ITEM_ID}' AND created_by='{ACTOR}'"),
        ("content_idempotency_record", f"scope IN ({quoted(SCOPES)}) AND idempotency_key IN ({quoted(receipt_keys)})"),
    )
    parts = [b"-- Exact local REPRO/T14 probe backup. Restore only to the same local schema.\nUSE content_service;\nSTART TRANSACTION;\n"]
    for table, where in specs:
        data = dump_table(table, where, password)
        require(data.count(b"INSERT INTO ") == {"content_definition": 3, "lexeme": 11, "content_item": 1, "content_idempotency_record": 14}[table], f"backup count mismatch: {table}")
        parts.append(f"-- {table}\n".encode())
        parts.append(data)
        parts.append(b"\n")
    parts.append(b"COMMIT;\n")
    backup = b"".join(parts)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    BACKUP_PATH.write_bytes(backup)
    return {"path": str(BACKUP_PATH.relative_to(ROOT)), "bytes": len(backup), "sha256": hashlib.sha256(backup).hexdigest()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    host = os.environ.get("MYSQL_HOST", "127.0.0.1")
    port = int(os.environ.get("MYSQL_PORT", "13306"))
    require(host == "127.0.0.1" and port == 13306, "local MySQL only")
    password = os.environ.get("MYSQL_ROOT_PASSWORD", "root-local-only")
    scan = scan_all_owner_refs()
    conn = pymysql.connect(host=host, port=port, user="root", password=password, charset="utf8mb4", autocommit=False)
    try:
        conn.begin()
        with conn.cursor() as cursor:
            present = count(cursor, f"SELECT COUNT(*) FROM content_service.content_definition WHERE content_code IN ({placeholders(CODES)})", CODES)
            if present == 0:
                require(BACKUP_PATH.exists(), "rows are absent but rollback backup is missing")
                remaining = {
                    "lexemes": count(cursor, f"SELECT COUNT(*) FROM content_service.lexeme WHERE lexeme_id IN ({placeholders(LEXEME_IDS)})", LEXEME_IDS),
                    "items": count(cursor, "SELECT COUNT(*) FROM content_service.content_item WHERE item_id=%s", (ITEM_ID,)),
                    "receipts": count(cursor,
                        f"SELECT COUNT(*) FROM content_service.content_idempotency_record WHERE scope IN ({placeholders(SCOPES)}) "
                        f"AND (JSON_UNQUOTE(JSON_EXTRACT(response_json,'$.lexemeId')) IN ({placeholders(LEXEME_IDS)}) "
                        f"OR JSON_UNQUOTE(JSON_EXTRACT(response_json,'$.itemId'))=%s)",
                        SCOPES + LEXEME_IDS + (ITEM_ID,)),
                }
                require(all(value == 0 for value in remaining.values()), f"partial cleanup detected: {remaining}")
                conn.rollback()
                print(json.dumps({"mode": "already-clean", "codes": CODES, "referenceScan": scan, "remaining": remaining}, ensure_ascii=False, indent=2))
                return
            require(present == 3, "partial definition set; refusing cleanup")
            before = guarded_rows(cursor)
            evidence = {"mode": "apply" if args.apply else "dry-run", "codes": CODES, "referenceScan": scan, "before": {key: value for key, value in before.items() if key != "receiptKeys"}}
            if not args.apply:
                conn.rollback()
                print(json.dumps(evidence, ensure_ascii=False, indent=2))
                return
            evidence["backup"] = write_backup(before["receiptKeys"], password)
            cursor.execute(
                f"DELETE FROM content_service.content_idempotency_record WHERE scope IN ({placeholders(SCOPES)}) AND idempotency_key IN ({placeholders(before['receiptKeys'])})",
                SCOPES + before["receiptKeys"],
            )
            receipt_deleted = cursor.rowcount
            cursor.execute(f"DELETE FROM content_service.content_item WHERE item_id=%s AND pack_code=%s AND created_by=%s", (ITEM_ID, CODES[2], ACTOR))
            item_deleted = cursor.rowcount
            cursor.execute(f"DELETE FROM content_service.lexeme WHERE lexeme_id IN ({placeholders(LEXEME_IDS)}) AND pack_code IN ({placeholders(CODES)}) AND created_by=%s", LEXEME_IDS + CODES + (ACTOR,))
            lexeme_deleted = cursor.rowcount
            cursor.execute(f"DELETE FROM content_service.content_definition WHERE content_code IN ({placeholders(CODES)}) AND created_by=%s AND current_published_version_id IS NULL", CODES + (ACTOR,))
            definition_deleted = cursor.rowcount
            deleted = {"receipts": receipt_deleted, "items": item_deleted, "lexemes": lexeme_deleted, "definitions": definition_deleted}
            require(deleted == {"receipts": 14, "items": 1, "lexemes": 11, "definitions": 3}, f"delete count mismatch: {deleted}")
            require(count(cursor, f"SELECT COUNT(*) FROM content_service.content_definition WHERE content_code IN ({placeholders(CODES)})", CODES) == 0, "definition remains")
            require(count(cursor, f"SELECT COUNT(*) FROM content_service.lexeme WHERE lexeme_id IN ({placeholders(LEXEME_IDS)})", LEXEME_IDS) == 0, "lexeme remains")
            require(count(cursor, "SELECT COUNT(*) FROM content_service.content_item WHERE item_id=%s", (ITEM_ID,)) == 0, "item remains")
            evidence["deleted"] = deleted
            conn.commit()
            evidence["committed"] = True
            (OUTPUT / "cleanup-evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(evidence, ensure_ascii=False, indent=2))
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
