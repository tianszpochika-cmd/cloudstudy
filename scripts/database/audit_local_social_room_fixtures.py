"""Read-only dry run for all 100 visible local social fixture rooms.

The script has no apply mode. It never prints account identifiers or row values;
it reports counts and SHA-256 fingerprints for later backup/revalidation.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import date, datetime, timezone
from decimal import Decimal

import pymysql


SOURCE_TENANT = "platform"
TABLE_START = {
    "soc_study_room": 12,
    "soc_room_member": 68,
    "soc_seat_lease": 36,
    "soc_focus_state": 70,
    "soc_interaction": 17,
    "soc_report": 30,
}
CHILD_TABLES = tuple(table for table in TABLE_START if table != "soc_study_room")
LOCAL_EXPECTED = {
    "soc_study_room": 10,
    "soc_room_member": 31,
    "soc_seat_lease": 10,
    "soc_focus_state": 34,
    "soc_interaction": 10,
    "soc_report": 10,
}
FOUNDATION_EXPECTED = {
    "soc_study_room": 1,
    "soc_room_member": 37,
    "soc_seat_lease": 25,
    "soc_focus_state": 35,
    "soc_interaction": 6,
    "soc_report": 19,
}
def fixture_index(table: str, room_id: str) -> int | None:
    if table not in TABLE_START:
        raise ValueError(f"unrecognized social table: {table}")
    match = re.fullmatch(rf"bulk-100x-{table}-room-(\d{{4}})", room_id)
    if not match:
        return None
    index = int(match.group(1))
    return index if TABLE_START[table] <= index <= 100 else None


def visible_family(table: str, room_id: str) -> str | None:
    if fixture_index(table, room_id) is not None:
        return "bulk100x"
    if re.fullmatch(r"local-10x-room-(0[1-9]|10)", room_id):
        return "local10x"
    if room_id == "room-local-foundations":
        return "foundation"
    return None


def canonical_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else str(value)
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, dict):
        return {str(key): canonical_value(child) for key, child in value.items()}
    if isinstance(value, (list, tuple)):
        return [canonical_value(child) for child in value]
    return value


def row_fingerprint(rows: list[dict]) -> str:
    canonical = [canonical_value(row) for row in sorted(rows, key=lambda row: row["id"])]
    payload = json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def scalar(cursor, sql: str, parameters=()) -> int:
    if parameters:
        cursor.execute(sql, parameters)
    else:
        cursor.execute(sql)
    return int(next(iter(cursor.fetchone().values())))


def audit(cursor) -> dict:
    blockers = []
    tables = {}
    visible_room_rows = []
    for table, start in TABLE_START.items():
        cursor.execute(
            f"SELECT * FROM social_service.`{table}` "
            "WHERE tenant_id=%s AND room_id LIKE 'bulk-100x-%%' ORDER BY id",
            (SOURCE_TENANT,),
        )
        rows = cursor.fetchall()
        actual = {fixture_index(table, row["room_id"]) for row in rows}
        expected = set(range(start, 101))
        invalid = sum(fixture_index(table, row["room_id"]) is None for row in rows)
        if invalid or actual != expected or len(rows) != len(expected):
            blockers.append(f"{table}: unexpected bulk room ID family or index coverage")
        wrong_tenant = scalar(
            cursor,
            f"SELECT COUNT(*) FROM social_service.`{table}` "
            "WHERE tenant_id<>%s AND room_id LIKE 'bulk-100x-%%'",
            (SOURCE_TENANT,),
        )
        if wrong_tenant:
            blockers.append(f"{table}: bulk room IDs already exist outside platform")
        tables[table] = {
            "bulk100x": {
                "count": len(rows), "firstIndex": start, "lastIndex": 100,
                "wrongTenantCount": wrong_tenant, "fullRowSha256": row_fingerprint(rows),
            },
        }
        cursor.execute(
            f"SELECT * FROM social_service.`{table}` "
            "WHERE tenant_id=%s AND room_id LIKE 'local-10x-%%' ORDER BY id",
            (SOURCE_TENANT,),
        )
        local_rows = cursor.fetchall()
        if len(local_rows) != LOCAL_EXPECTED[table] or any(
            visible_family(table, row["room_id"]) != "local10x"
            for row in local_rows
        ):
            blockers.append(f"{table}: local-10x count or room ID shape changed")
        if table == "soc_study_room" and {
            row["room_id"] for row in local_rows
        } != {f"local-10x-room-{index:02d}" for index in range(1, 11)}:
            blockers.append("local-10x room ID coverage changed")
        cursor.execute(
            f"SELECT * FROM social_service.`{table}` "
            "WHERE tenant_id=%s AND room_id='room-local-foundations' ORDER BY id",
            (SOURCE_TENANT,),
        )
        foundation_rows = cursor.fetchall()
        if len(foundation_rows) != FOUNDATION_EXPECTED[table] or any(
            visible_family(table, row["room_id"]) != "foundation"
            for row in foundation_rows
        ):
            blockers.append(f"{table}: foundation row count changed")
        for family, family_rows, predicate in (
            ("local10x", local_rows, "room_id LIKE 'local-10x-%%'"),
            ("foundation", foundation_rows, "room_id='room-local-foundations'"),
        ):
            outside = scalar(
                cursor,
                f"SELECT COUNT(*) FROM social_service.`{table}` "
                f"WHERE tenant_id<>%s AND {predicate}",
                (SOURCE_TENANT,),
            )
            if outside:
                blockers.append(f"{table}: {family} IDs already exist outside platform")
            tables[table][family] = {
                "count": len(family_rows), "wrongTenantCount": outside,
                "fullRowSha256": row_fingerprint(family_rows),
            }
        if table == "soc_study_room":
            visible_room_rows = rows + local_rows + foundation_rows
    if len(visible_room_rows) != 100:
        blockers.append("visible fixture room set is not exactly 100 rows")

    cursor.execute("""
        SELECT COUNT(*) AS n FROM information_schema.KEY_COLUMN_USAGE
        WHERE REFERENCED_TABLE_SCHEMA='social_service'
          AND REFERENCED_TABLE_NAME IN
            ('soc_study_room','soc_room_member','soc_seat_lease',
             'soc_focus_state','soc_interaction','soc_report')
    """)
    foreign_keys = cursor.fetchone()["n"]
    if foreign_keys:
        blockers.append("new foreign-key consumers require a new dependency audit")

    direct_children = {}
    synthetic_orphans = {}
    for table in CHILD_TABLES:
        direct_children[table] = {}
        direct_children[table]["bulk100x"] = scalar(cursor, f"""
            SELECT COUNT(*) FROM social_service.`{table}` child
            JOIN social_service.soc_study_room room
              ON room.tenant_id=child.tenant_id AND room.room_id=child.room_id
            WHERE room.tenant_id=%s
              AND room.room_id REGEXP '^bulk-100x-soc_study_room-room-[0-9]{{4}}$'
        """, (SOURCE_TENANT,))
        synthetic_orphans[table] = scalar(cursor, f"""
            SELECT COUNT(*) FROM social_service.`{table}` child
            LEFT JOIN social_service.soc_study_room room
              ON room.tenant_id=child.tenant_id AND room.room_id=child.room_id
            WHERE child.tenant_id=%s
              AND child.room_id LIKE 'bulk-100x-%%' AND room.room_id IS NULL
        """, (SOURCE_TENANT,))
        for family, predicate in (
            ("local10x", "room.room_id REGEXP '^local-10x-room-(0[1-9]|10)$'"),
            ("foundation", "room.room_id='room-local-foundations'"),
        ):
            direct_children[table][family] = scalar(cursor, f"""
                SELECT COUNT(*) FROM social_service.`{table}` child
                JOIN social_service.soc_study_room room
                  ON room.tenant_id=child.tenant_id AND room.room_id=child.room_id
                WHERE room.tenant_id=%s AND {predicate}
            """, (SOURCE_TENANT,))
            if direct_children[table][family] != tables[table][family]["count"]:
                blockers.append(f"{table}: {family} has orphan or cross-tenant children")
        if direct_children[table]["bulk100x"]:
            blockers.append(f"{table}: a real bulk room acquired child rows")
        if synthetic_orphans[table] != tables[table]["bulk100x"]["count"]:
            blockers.append(f"{table}: bulk child rows are not all independent orphans")

    role_sources = (
        ("soc_study_room", "owner_subject", "room_owner"),
        ("soc_room_member", "subject_id", "member"),
        ("soc_seat_lease", "subject_id", "seat"),
        ("soc_focus_state", "subject_id", "focus"),
        ("soc_interaction", "sender_subject_id", "interaction_sender"),
        ("soc_interaction", "target_subject_id", "interaction_target"),
        ("soc_report", "reporter_subject_id", "report_reporter"),
        ("soc_report", "target_subject_id", "report_target"),
    )
    family_sql = """CASE WHEN room_id LIKE 'bulk-100x-%' THEN 'bulk100x'
          WHEN room_id LIKE 'local-10x-%' THEN 'local10x'
          ELSE 'foundation' END"""
    refs_sql = " UNION ALL ".join(
        f"SELECT '{role}' role_name,{family_sql} family,`{column}` subject_id "
        f"FROM social_service.`{table}` WHERE tenant_id='platform' "
        "AND (room_id LIKE 'bulk-100x-%' OR room_id LIKE 'local-10x-%' "
        f"OR room_id='room-local-foundations') AND `{column}` IS NOT NULL"
        for table, column, role in role_sources
    )
    cursor.execute("WITH refs AS (" + refs_sql + """
        ) SELECT family,role_name,COUNT(*) references_count,
          COUNT(DISTINCT refs.subject_id) unique_subjects,
          SUM(account.principal_id IS NOT NULL AND account.identifier LIKE '%.invalid') invalid_accounts,
          SUM(account.principal_id IS NOT NULL AND account.identifier NOT LIKE '%.invalid') other_accounts,
          SUM(account.principal_id IS NULL) missing_accounts,
          SUM(principal.principal_id IS NOT NULL) principals,
          SUM(principal.principal_id IS NOT NULL AND principal.tenant_id<>'platform') other_tenant_principals
        FROM refs
        LEFT JOIN iam_service.iam_account account ON account.principal_id=refs.subject_id
        LEFT JOIN iam_service.iam_principal principal ON principal.principal_id=refs.subject_id
        GROUP BY family,role_name ORDER BY family,role_name
    """)
    subject_refs = list(cursor.fetchall())
    if any(row["other_accounts"] or row["other_tenant_principals"] for row in subject_refs):
        blockers.append("fixture rows reference a non-.invalid account or another tenant's principal")
    room_owners_without_account = {
        row["family"]: int(row["missing_accounts"])
        for row in subject_refs if row["role_name"] == "room_owner"
    }

    cursor.execute("""
        SELECT TABLE_SCHEMA table_schema,TABLE_NAME table_name,COLUMN_NAME column_name
        FROM information_schema.COLUMNS
        WHERE COLUMN_NAME IN ('room_id','room_ref')
          AND TABLE_SCHEMA NOT IN
            ('mysql','information_schema','performance_schema','sys','social_service')
        ORDER BY TABLE_SCHEMA,TABLE_NAME,COLUMN_NAME
    """)
    cross_schema_refs = []
    for column in cursor.fetchall():
        schema, table, name = (column[key] for key in ("table_schema", "table_name", "column_name"))
        if not all(re.fullmatch(r"[A-Za-z0-9_]+", part) for part in (schema, table, name)):
            raise ValueError("unsafe schema identifier from information_schema")
        room_ids = [row["room_id"] for row in visible_room_rows]
        placeholders = ",".join(["%s"] * len(room_ids))
        count = scalar(cursor, f"""
            SELECT COUNT(*) FROM `{schema}`.`{table}`
            WHERE `{name}` IN ({placeholders})
        """, room_ids)
        if count:
            cross_schema_refs.append({"schema": schema, "table": table, "column": name, "count": count})
    if cross_schema_refs:
        blockers.append("another schema directly references one of the 100 visible fixture room IDs")

    cursor.execute("""
        SELECT TABLE_SCHEMA table_schema,TABLE_NAME table_name,COLUMN_NAME column_name
        FROM information_schema.COLUMNS
        WHERE DATA_TYPE='json'
          AND TABLE_SCHEMA NOT IN
            ('mysql','information_schema','performance_schema','sys')
        ORDER BY TABLE_SCHEMA,TABLE_NAME,COLUMN_NAME
    """)
    json_room_refs = []
    json_columns = list(cursor.fetchall())
    for column in json_columns:
        schema, table, name = (column[key] for key in ("table_schema", "table_name", "column_name"))
        if not all(re.fullmatch(r"[A-Za-z0-9_]+", part) for part in (schema, table, name)):
            raise ValueError("unsafe JSON column identifier from information_schema")
        count = scalar(cursor, f"""
            SELECT COUNT(*) FROM `{schema}`.`{table}`
            WHERE CAST(`{name}` AS CHAR) LIKE %s
               OR CAST(`{name}` AS CHAR) LIKE %s
               OR CAST(`{name}` AS CHAR) LIKE %s
        """, ("%bulk-100x-soc_study_room-room-%", "%local-10x-room-%",
              "%room-local-foundations%"))
        if count:
            json_room_refs.append({"schema": schema, "table": table, "column": name, "count": count})
    if json_room_refs:
        blockers.append("a JSON column names a visible fixture room")

    auxiliary = {
        "bulkIdempotencyRecords": scalar(cursor, """
            SELECT COUNT(*) FROM social_service.soc_idempotency_record
            WHERE tenant_id='platform' AND idempotency_key LIKE 'bulk-100x-%'
              AND JSON_UNQUOTE(JSON_EXTRACT(response_json,'$.fixtureId'))='bulk-100x-v1'
        """),
        "bulkTrustedEventDedupes": scalar(cursor, """
            SELECT COUNT(*) FROM social_service.soc_trusted_event_dedupe
            WHERE event_id LIKE 'bulk-100x-%'
        """),
        "local10xIdempotencyRecords": scalar(cursor, """
            SELECT COUNT(*) FROM social_service.soc_idempotency_record
            WHERE tenant_id='platform' AND idempotency_key LIKE 'local-10x-%'
        """),
        "local10xTrustedEventDedupes": scalar(cursor, """
            SELECT COUNT(*) FROM social_service.soc_trusted_event_dedupe
            WHERE event_id LIKE 'local-10x-%'
        """),
        "idempotencyResponsesNamingActualRooms": scalar(cursor, """
            SELECT COUNT(*) FROM social_service.soc_idempotency_record
            WHERE CAST(response_json AS CHAR) LIKE '%%bulk-100x-soc_study_room-room-%%'
               OR CAST(response_json AS CHAR) LIKE '%%local-10x-room-%%'
               OR CAST(response_json AS CHAR) LIKE '%%room-local-foundations%%'
        """),
        "local10xLeaderboardRows": scalar(cursor, """
            SELECT COUNT(*) FROM social_service.soc_leaderboard_projection
            WHERE tenant_id='platform' AND source_watermark LIKE 'local-10x-%'
        """),
        "foundationLeaderboardRows": scalar(cursor, """
            SELECT COUNT(*) FROM social_service.soc_leaderboard_projection
            WHERE tenant_id='platform' AND source_watermark='local-fixture'
        """),
    }
    cursor.execute("""
        SELECT CASE WHEN room_id REGEXP '^bulk-100x-soc_study_room-room-[0-9]{4}$' THEN 'bulk100x'
                    WHEN room_id REGEXP '^local-10x-room-(0[1-9]|10)$' THEN 'local10x'
                    WHEN room_id='room-local-foundations' THEN 'foundation'
                    ELSE 'other' END room_family,COUNT(*) n
        FROM social_service.soc_study_room WHERE tenant_id='platform'
        GROUP BY room_family
    """)
    room_families = {row["room_family"]: row["n"] for row in cursor.fetchall()}
    if room_families != {"bulk100x": 89, "local10x": 10, "foundation": 1}:
        blockers.append("platform room families differ from the 100-room fixture snapshot")

    return {
        "mode": "DRY_RUN_READ_ONLY",
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "scope": "local MySQL social_service; 100 visible platform fixture rooms and room-scoped rows",
        "roomFamilies": room_families,
        "tables": tables,
        "directChildrenOfVisibleRooms": direct_children,
        "orphanedBulkChildRows": synthetic_orphans,
        "subjectReferences": subject_refs,
        "roomOwnersWithoutIamAccount": room_owners_without_account,
        "crossSchemaStructuredRoomReferences": cross_schema_refs,
        "jsonColumnsScanned": len(json_columns),
        "jsonRoomReferences": json_room_refs,
        "foreignKeyConsumers": foreign_keys,
        "auxiliaryFixtureRows": auxiliary,
        "reviewNeeded": [
            f"{room_owners_without_account.get('bulk100x', 0)} bulk room owners have no IAM account; verify provenance before applying",
            "foundation has additional UAT member/focus/interaction/report facts; preserve every row in rollback backup",
            "bulk-100x writer was not found in the repository; check external seed jobs before migration",
            "local-10x and foundation seed commands still upsert platform rooms; guard them before applying",
        ],
        "blockers": blockers,
    }


def main() -> None:
    if len(sys.argv) != 1:
        raise SystemExit("This auditor has no apply mode or arguments")
    host = os.environ.get("MYSQL_HOST", "127.0.0.1")
    port = int(os.environ.get("MYSQL_PORT", "13306"))
    if host not in {"127.0.0.1", "localhost", "::1"} or port != 13306:
        raise SystemExit("Refusing nonlocal MySQL target")
    connection = pymysql.connect(
        host=host, port=port, user=os.environ.get("MYSQL_ADMIN_USER", "root"),
        password=os.environ.get("MYSQL_ROOT_PASSWORD", "root-local-only"),
        database="social_service", charset="utf8mb4", autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION TRANSACTION READ ONLY")
            cursor.execute("START TRANSACTION READ ONLY")
            result = audit(cursor)
            connection.rollback()
        print(json.dumps(result, ensure_ascii=False, indent=2, default=canonical_value))
        if result["blockers"]:
            raise SystemExit(2)
    finally:
        connection.close()


if __name__ == "__main__":
    main()
