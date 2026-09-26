"""Read-only, identifier-free preflight for 381 synthetic social rankings."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime, timezone

from audit_local_social_room_fixtures import canonical_value, row_fingerprint
from quarantine_local_social_rooms import QUARANTINE_TENANT, SOURCE_TENANT, connect


TABLE = "soc_leaderboard_projection"
CANDIDATE_PREDICATE = "(source_watermark='local-fixture' OR source_watermark LIKE 'local-10x-%%')"
EXPECTED_TOTAL = 381
EXPECTED_FOUNDATION = 371
EXPECTED_LOCAL10X = 10
EXPECTED_SOURCE_HASH = "3e965184bafbffe83fc93ae3bd6764946c33ed730e864cc89ed7a08ae83e4b4e"
LOCAL10X_DATE = date(2026, 8, 26)


def scalar(cursor, statement, values=()):
    cursor.execute(statement, values)
    return int(next(iter(cursor.fetchone().values())))


def candidate_rows(cursor, tenant, *, lock=False):
    cursor.execute(
        f"SELECT * FROM social_service.{TABLE} WHERE tenant_id=%s AND {CANDIDATE_PREDICATE} "
        "ORDER BY id" + (" FOR UPDATE" if lock else ""),
        (tenant,),
    )
    return list(cursor.fetchall())


def expected_subject(index):
    digest = hashlib.sha256(f"local-real-10x-v1:principal:{index}".encode()).hexdigest()[:32]
    return f"{digest[:8]}-{digest[8:12]}-4{digest[13:16]}-8{digest[17:20]}-{digest[20:]}"


def fixture_violations(rows, *, require_snapshot_hash=True):
    """Check the seed formulas, not only the watermarks or account domains."""
    errors = []
    foundation = [row for row in rows if row["source_watermark"] == "local-fixture"]
    local10x = [row for row in rows if row["source_watermark"] != "local-fixture"]
    if len(rows) != EXPECTED_TOTAL or len(foundation) != EXPECTED_FOUNDATION or len(local10x) != EXPECTED_LOCAL10X:
        errors.append("candidate 381/371/10 count changed")
    if any((row["leaderboard_kind"], row["period_type"], row["score"],
            row["qualified_units"], row["projection_state"], row["snapshot_version"])
           != ("FOCUS_MINUTES", "DAY", 20, 20, "PUBLISHED", 1)
           for row in foundation):
        errors.append("local-fixture fixed-score seed fingerprint changed")
    expected_markers = {f"local-10x-leaderboard-watermark-{index:02d}" for index in range(1, 11)}
    if {row["source_watermark"] for row in local10x} != expected_markers:
        errors.append("local-10x watermark coverage changed")
    for row in local10x:
        match = re.fullmatch(r"local-10x-leaderboard-watermark-(0[1-9]|10)",
                             row["source_watermark"])
        if match is None:
            errors.append("local-10x watermark shape changed")
            continue
        index = int(match.group(1))
        if (row["id"], row["leaderboard_kind"], row["period_type"],
                row["period_start"], row["subject_id"], row["score"],
                row["qualified_units"], row["projection_state"],
                row["snapshot_version"]) != (
                    915000 + index, "DAILY_FOCUS", "DAY", LOCAL10X_DATE,
                    expected_subject(index), 100 - index, 60 + index, "PUBLISHED", 1):
            errors.append("local-10x row differs from seed formula")
            break
    if require_snapshot_hash and row_fingerprint(rows) != EXPECTED_SOURCE_HASH:
        errors.append("381-row full snapshot hash changed")
    return errors


def audit(cursor):
    rows = candidate_rows(cursor, SOURCE_TENANT)
    foundation = [row for row in rows if row["source_watermark"] == "local-fixture"]
    local10x = [row for row in rows if row["source_watermark"] != "local-fixture"]
    blockers = fixture_violations(rows)
    all_platform = scalar(cursor, f"SELECT COUNT(*) FROM social_service.{TABLE} WHERE tenant_id=%s",
                          (SOURCE_TENANT,))
    target_existing = scalar(cursor, f"SELECT COUNT(*) FROM social_service.{TABLE} WHERE tenant_id=%s",
                             (QUARANTINE_TENANT,))
    quarantine_principals = scalar(cursor, "SELECT COUNT(*) FROM iam_service.iam_principal "
                                   "WHERE tenant_id=%s", (QUARANTINE_TENANT,))
    if all_platform != EXPECTED_TOTAL:
        blockers.append("platform leaderboard total changed; review non-candidate rows")
    if target_existing:
        blockers.append("quarantine tenant already has leaderboard rows")
    if quarantine_principals:
        blockers.append("quarantine tenant has an IAM principal")
    unique_key_collisions = scalar(cursor, f"""
        SELECT COUNT(*) FROM social_service.{TABLE} target
        JOIN social_service.{TABLE} source
          ON target.leaderboard_kind=source.leaderboard_kind
         AND target.period_type=source.period_type
         AND target.period_start=source.period_start
         AND target.subject_id=source.subject_id
        WHERE source.tenant_id=%s AND target.tenant_id=%s
          AND (source.source_watermark='local-fixture'
               OR source.source_watermark LIKE 'local-10x-%%')
    """, (SOURCE_TENANT, QUARANTINE_TENANT))
    if unique_key_collisions:
        blockers.append("target unique key collision")
    cursor.execute(f"""
        SELECT CASE WHEN source_watermark='local-fixture' THEN 'foundation'
                    ELSE 'local10x' END family,
               COUNT(*) n,
               SUM(EXISTS(SELECT 1 FROM iam_service.iam_account account
                          WHERE account.principal_id=lb.subject_id
                            AND account.identifier NOT LIKE '%%.invalid')) non_invalid_account_rows,
               SUM(EXISTS(SELECT 1 FROM iam_service.iam_account account
                          WHERE account.principal_id=lb.subject_id
                            AND account.identifier LIKE '%%.invalid')) invalid_account_rows,
               SUM(NOT EXISTS(SELECT 1 FROM iam_service.iam_account account
                              WHERE account.principal_id=lb.subject_id)) no_account_rows,
               SUM(EXISTS(SELECT 1 FROM iam_service.iam_principal principal
                          WHERE principal.principal_id=lb.subject_id
                            AND principal.tenant_id<>%s)) other_tenant_principal_rows,
               MIN(period_start) earliest_period,
               MAX(period_start) latest_period,
               MIN(last_projected_at) earliest_projection,
               MAX(last_projected_at) latest_projection,
               MIN(snapshot_version) min_snapshot_version,
               MAX(snapshot_version) max_snapshot_version
        FROM social_service.{TABLE} lb
        WHERE tenant_id=%s AND {CANDIDATE_PREDICATE}
        GROUP BY family ORDER BY family
    """, (SOURCE_TENANT, SOURCE_TENANT))
    identity_groups = list(cursor.fetchall())
    identity_by_family = {row["family"]: row for row in identity_groups}
    for family, expected in (("foundation", (1, 100, 270, 0)),
                             ("local10x", (0, 10, 0, 0))):
        row = identity_by_family.get(family)
        actual = tuple(int(row[key]) for key in (
            "non_invalid_account_rows", "invalid_account_rows",
            "no_account_rows", "other_tenant_principal_rows")) if row else None
        if actual != expected:
            blockers.append(f"{family} identity association census changed")
    foreign_key_consumers = scalar(cursor, """
        SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
        WHERE REFERENCED_TABLE_SCHEMA='social_service'
          AND REFERENCED_TABLE_NAME='soc_leaderboard_projection'
    """)
    if foreign_key_consumers:
        blockers.append("leaderboard gained foreign-key consumers")
    cursor.execute("""
        SELECT TABLE_SCHEMA schema_name,TABLE_NAME table_name,COLUMN_NAME column_name
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys')
          AND NOT (TABLE_SCHEMA='social_service' AND TABLE_NAME='soc_leaderboard_projection')
          AND COLUMN_NAME IN ('leaderboard_id','leaderboard_ref','leaderboard_projection_id',
                              'social_projection_id')
        ORDER BY TABLE_SCHEMA,TABLE_NAME,COLUMN_NAME
    """)
    reference_columns = list(cursor.fetchall())
    structured_references = []
    ids = [row["id"] for row in rows]
    for column in reference_columns:
        schema, table, name = (column[key] for key in ("schema_name", "table_name", "column_name"))
        if not all(re.fullmatch(r"[A-Za-z0-9_]+", part) for part in (schema, table, name)):
            raise RuntimeError("unexpected SQL identifier")
        placeholders = ",".join(["%s"] * len(ids))
        count = scalar(cursor, f"SELECT COUNT(*) FROM `{schema}`.`{table}` "
                               f"WHERE `{name}` IN ({placeholders})", ids)
        if count:
            structured_references.append({"schema": schema, "table": table,
                                          "column": name, "count": count})
    if structured_references:
        blockers.append("structured downstream leaderboard references exist")
    cursor.execute("""
        SELECT TABLE_SCHEMA schema_name,TABLE_NAME table_name,COLUMN_NAME column_name
        FROM information_schema.COLUMNS
        WHERE DATA_TYPE='json' AND TABLE_SCHEMA NOT IN
          ('mysql','information_schema','performance_schema','sys')
        ORDER BY TABLE_SCHEMA,TABLE_NAME,COLUMN_NAME
    """)
    json_columns = list(cursor.fetchall())
    json_references = []
    for column in json_columns:
        schema, table, name = (column[key] for key in ("schema_name", "table_name", "column_name"))
        if not all(re.fullmatch(r"[A-Za-z0-9_]+", part) for part in (schema, table, name)):
            raise RuntimeError("unexpected JSON column identifier")
        count = scalar(cursor, f"""
            SELECT COUNT(*) FROM `{schema}`.`{table}`
            WHERE CAST(`{name}` AS CHAR) LIKE %s
               OR (CAST(`{name}` AS CHAR) LIKE %s AND CAST(`{name}` AS CHAR) LIKE %s)
               OR (CAST(`{name}` AS CHAR) LIKE %s AND CAST(`{name}` AS CHAR) LIKE %s)
        """, ('%local-10x-leaderboard-watermark-%', '%"source_watermark"%',
              '%"local-fixture"%', '%"sourceWatermark"%', '%"local-fixture"%'))
        if count:
            json_references.append({"schema": schema, "table": table,
                                    "column": name, "count": count})
    if json_references:
        blockers.append("JSON downstream leaderboard references exist")
    return {
        "mode": "LEADERBOARD_DRY_RUN_READ_ONLY",
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "candidateCounts": {"foundation": len(foundation), "local10x": len(local10x),
                            "total": len(rows)},
        "allPlatformLeaderboardRows": all_platform,
        "candidateFullRowSha256": row_fingerprint(rows),
        "seedFingerprintValid": not fixture_violations(rows, require_snapshot_hash=False),
        "snapshotHashMatchesApprovedDryRun": row_fingerprint(rows) == EXPECTED_SOURCE_HASH,
        "quarantineTenantExistingLeaderboardRows": target_existing,
        "quarantineTenantIamPrincipalCount": quarantine_principals,
        "uniqueKeyCollisions": unique_key_collisions,
        "identityGroups": identity_groups,
        "foreignKeyConsumers": foreign_key_consumers,
        "structuredReferenceColumnsScanned": len(reference_columns),
        "structuredReferences": structured_references,
        "jsonColumnsScanned": len(json_columns),
        "jsonReferences": json_references,
        "blockers": blockers,
        "reviewRequired": [
            "One fixed-score fixture projection belongs to a non-.invalid account; move only the projection after independent review.",
            "The old seed could have overwritten a score; no earlier snapshot exists to reconstruct an earlier value.",
        ],
    }


def main():
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


if __name__ == "__main__":
    main()
