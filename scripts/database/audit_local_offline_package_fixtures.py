"""Read-only local inventory for offline package fixture quarantine planning.

The script never changes database rows. It records only synthetic package IDs,
aggregate reference counts, and checksums; account identifiers stay out of the
artifact. A future quarantine must make its own full-row backup and preflight.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from datetime import date, datetime

import pymysql


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "artifacts" / "audit-2026-09-23" / "offline-package-fixtures" / "dry-run.json"
SCHEMAS = (
    "notification_service", "media_service", "learning_service", "content_service",
    "commerce_service", "workflow_service", "audit_service", "social_service", "analytics_service",
)
BULK = re.compile(r"^bulk-100x-notification_offli-package-(\d{4})$")
LOCAL = re.compile(r"^local-10x-offline-package-(\d{2})$")
IDENTIFIER = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")


def normalized(value: object) -> object:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, dict):
        return {str(k): normalized(v) for k, v in sorted(value.items())}
    if isinstance(value, (list, tuple)):
        return [normalized(v) for v in value]
    return value


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(normalized(value), ensure_ascii=False, sort_keys=True,
                                      separators=(",", ":")).encode("utf-8")).hexdigest()


def classify(row: dict) -> tuple[str, bool, str]:
    package_id = row["package_id"]
    urls = json.loads(row["signed_part_urls_json"])
    bulk = BULK.fullmatch(package_id)
    if bulk:
        index = bulk.group(1)
        safe = (row["state"] == "PUBLISHED"
                and row["package_code"] == package_id
                and row["sha256"] == f"bulk-100x-sha256-{index}"
                and row["signature"] == f"bulk-100x-signature-{index}"
                and isinstance(urls, dict)
                and urls.get("fixtureId") == "bulk-100x-v1"
                and urls.get("table") == "notification_offline_package"
                and urls.get("index") == int(index))
        return "bulk100x", safe, "metadata object, not signed part URLs"
    local = LOCAL.fullmatch(package_id)
    if local:
        index = int(local.group(1))
        safe = (row["state"] == "PUBLISHED"
                and row["package_code"] == "ENGLISH_PHASE1"
                and row["version_code"] == f"10x-{index}"
                and row["signature"] == f"local-signature-{index}"
                and isinstance(urls, list)
                and urls == [f"local-10x-offline-part-1-{index:02d}",
                             f"local-10x-offline-part-2-{index:02d}"])
        return "local10x", safe, "fixture part labels, not URLs or object keys"
    return "other", False, "outside exact fixture scope"


def main() -> None:
    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    port = int(os.getenv("MYSQL_PORT", "13306"))
    if (host, port) != ("127.0.0.1", 13306):
        raise SystemExit("Only the fixed local MySQL is allowed")
    connection = pymysql.connect(host=host, port=port, user="root",
                                 password=os.getenv("MYSQL_ROOT_PASSWORD", "root-local-only"),
                                 charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor,
                                 autocommit=True, read_timeout=20)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM notification_service.notification_offline_package ORDER BY package_id")
            packages = cursor.fetchall()
            candidates = []
            groups = {"bulk100x": 0, "local10x": 0, "other": 0}
            malformed = []
            for row in packages:
                group, safe, problem = classify(row)
                groups[group] += 1
                if safe:
                    candidates.append(row)
                elif row["state"] == "PUBLISHED":
                    malformed.append({"packageId": row["package_id"], "reason": problem})
            candidate_ids = [row["package_id"] for row in candidates]
            cursor.execute("""
                SELECT d.package_id, d.state, a.identifier
                FROM notification_service.notification_offline_download d
                LEFT JOIN iam_service.iam_account a ON a.principal_id=d.principal_id
                ORDER BY d.package_id
            """)
            downloads = cursor.fetchall()
            candidate_set = set(candidate_ids)
            candidate_downloads = [row for row in downloads if row["package_id"] in candidate_set]
            account_links = {
                "invalid": sum(bool(row["identifier"] and row["identifier"].endswith(".invalid"))
                               for row in candidate_downloads),
                "missing": sum(row["identifier"] is None for row in candidate_downloads),
                "other": sum(bool(row["identifier"] and not row["identifier"].endswith(".invalid"))
                             for row in candidate_downloads),
            }
            cursor.execute("""
                SELECT COUNT(*) AS n FROM media_service.media_asset
                WHERE asset_id LIKE '%offline%' OR asset_key LIKE '%offline%'
                   OR object_key LIKE '%offline%' OR authorization_evidence_ref LIKE '%offline%'
            """)
            media_assets = cursor.fetchone()["n"]
            cursor.execute("""
                SELECT COUNT(*) AS n FROM media_service.media_rendition
                WHERE object_reference LIKE '%offline%'
            """)
            media_renditions = cursor.fetchone()["n"]
            cursor.execute("""
                SELECT table_schema AS schema_name, table_name AS table_name,
                       column_name AS column_name FROM information_schema.columns
                WHERE table_schema IN (""" + ",".join(["%s"] * len(SCHEMAS)) + """)
                  AND data_type IN ('char','varchar','text','tinytext','mediumtext','longtext','json')
                  AND (column_name REGEXP '(^|_)(id|ref|key|payload|json|attributes|object|manifest|package)($|_)'
                       OR data_type='json')
                ORDER BY table_schema, table_name, column_name
            """, SCHEMAS)
            columns = cursor.fetchall()
            references = []
            examined = 0
            for column in columns:
                schema, table, name = (column["schema_name"], column["table_name"], column["column_name"])
                if (schema, table) in {("notification_service", "notification_offline_package"),
                                       ("notification_service", "notification_offline_download")}:
                    continue
                if not all(IDENTIFIER.fullmatch(part) for part in (schema, table, name)):
                    raise RuntimeError("Unexpected information_schema identifier")
                cursor.execute(f"SELECT COUNT(*) AS n FROM `{schema}`.`{table}` "
                               f"WHERE CAST(`{name}` AS CHAR) LIKE %s "
                               f"OR CAST(`{name}` AS CHAR) LIKE %s",
                               ("%bulk-100x-notification_offli-package-%",
                                "%local-10x-offline-package-%"))
                count = cursor.fetchone()["n"]
                examined += 1
                if count:
                    references.append({"schema": schema, "table": table, "column": name, "rows": count})
    finally:
        connection.close()
    listing = subprocess.run(["docker", "exec", "yuxuexing-local-minio-1", "mc", "ls", "--recursive",
                              "local/yuxuexing-local"], capture_output=True, text=True, check=True)
    object_lines = [line for line in listing.stdout.splitlines() if "STANDARD " in line]
    offline_objects = [line for line in object_lines if any(marker in line for marker in
                       ("offline", "bulk-100x", "local-10x"))]
    evidence = {
        "capturedAt": datetime.now().astimezone().isoformat(),
        "mode": "read-only",
        "scope": "local 127.0.0.1:13306; notification offline packages and references; local MinIO bucket",
        "packageCounts": {
            "all": len(packages), "published": sum(row["state"] == "PUBLISHED" for row in packages),
            "deleted": sum(row["state"] == "DELETED" for row in packages),
            "groups": groups, "exactFixtureCandidates": len(candidates),
            "publishedOutsideExactFixtureScope": malformed,
            "candidateIds": candidate_ids, "candidateIdsSha256": digest(candidate_ids),
            "candidateFullRowsSha256": digest(candidates),
        },
        "downloadReferences": {
            "all": len(downloads), "candidateRows": len(candidate_downloads),
            "candidateDistinctPackages": len({row["package_id"] for row in candidate_downloads}),
            "states": {state: sum(row["state"] == state for row in candidate_downloads)
                       for state in sorted({row["state"] for row in candidate_downloads})},
            "accountLinks": account_links,
            "outsideCandidateRows": len(downloads) - len(candidate_downloads),
        },
        "otherReferences": {"examinedColumns": examined, "matches": references},
        "media": {"offlineNamedAssets": media_assets, "offlineNamedRenditions": media_renditions,
                  "minioObjectCount": len(object_lines), "offlineNamedMinioObjects": len(offline_objects)},
        "quarantinePreconditions": {
            "exact99": len(candidates) == 99,
            "allPublishedAreExactCandidates": len(candidates) == sum(row["state"] == "PUBLISHED" for row in packages),
            "noNonTestDownloadAccounts": account_links["other"] == 0,
            "noOtherStructuredReferences": not references,
            "noOfflineObjectBytes": not offline_objects and media_assets == 0 and media_renditions == 0,
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "packageCounts": evidence["packageCounts"]["all"],
                      "exactFixtureCandidates": len(candidates),
                      "remainingPublished": len(malformed),
                      "downloadReferences": len(candidate_downloads),
                      "referenceMatches": references,
                      "minioObjectCount": len(object_lines),
                      "offlineNamedMinioObjects": len(offline_objects),
                      "quarantinePreconditions": evidence["quarantinePreconditions"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
