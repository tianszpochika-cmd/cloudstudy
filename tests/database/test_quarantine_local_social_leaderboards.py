"""Safety tests for the separate 381-row social leaderboard quarantine."""

from __future__ import annotations

import json
import sys
from datetime import date, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/database"))
import audit_local_social_leaderboard_fixtures as audit  # noqa: E402
import quarantine_local_social_leaderboards as quarantine  # noqa: E402
from quarantine_local_social_rooms import decode_backup, encode_backup  # noqa: E402


def seed_formula_rows():
    foundation = [{
        "id": index,
        "tenant_id": "platform",
        "source_watermark": "local-fixture",
        "leaderboard_kind": "FOCUS_MINUTES",
        "period_type": "DAY",
        "period_start": date(2026, 8, 25),
        "subject_id": f"synthetic-{index}",
        "score": 20,
        "qualified_units": 20,
        "projection_state": "PUBLISHED",
        "snapshot_version": 1,
        "last_projected_at": datetime(2026, 8, 25, 10, 0, 0),
    } for index in range(1, 372)]
    local = [{
        "id": 915000 + index,
        "tenant_id": "platform",
        "source_watermark": f"local-10x-leaderboard-watermark-{index:02d}",
        "leaderboard_kind": "DAILY_FOCUS",
        "period_type": "DAY",
        "period_start": date(2026, 8, 26),
        "subject_id": audit.expected_subject(index),
        "score": 100 - index,
        "qualified_units": 60 + index,
        "projection_state": "PUBLISHED",
        "snapshot_version": 1,
        "last_projected_at": datetime(2026, 9, 18, 0, 0, 0),
    } for index in range(1, 11)]
    return foundation + local


class FakeCursor:
    def __init__(self, next_count=0):
        self.statements = []
        self.next_count = next_count
        self.rowcount = 1

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, statement, *_):
        self.statements.append(statement)

    def fetchone(self):
        return {"n": self.next_count}


class FakeConnection:
    def __init__(self, cursor):
        self.fake_cursor = cursor
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return self.fake_cursor

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        pass


class LeaderboardQuarantineSafetyTest(TestCase):
    def test_seed_formula_requires_fixed_scores_and_exact_ten_row_ids(self):
        rows = seed_formula_rows()
        self.assertEqual([], audit.fixture_violations(rows, require_snapshot_hash=False))
        rows[0] = {**rows[0], "score": 21}
        self.assertIn("local-fixture fixed-score seed fingerprint changed",
                      audit.fixture_violations(rows, require_snapshot_hash=False))
        rows = seed_formula_rows()
        rows[-1] = {**rows[-1], "subject_id": "unrelated-account"}
        self.assertIn("local-10x row differs from seed formula",
                      audit.fixture_violations(rows, require_snapshot_hash=False))

    def test_backup_round_trip_preserves_all_columns_and_times(self):
        row = seed_formula_rows()[0]
        raw = json.dumps({"rows": [row]}, default=encode_backup)
        restored = decode_backup(json.loads(raw))["rows"][0]
        self.assertEqual(row, restored)
        self.assertEqual(quarantine.full_row_digest([row]),
                         quarantine.full_row_digest([restored]))

    def test_apply_rolls_back_before_updates_if_transactional_audit_changes(self):
        rows = seed_formula_rows()
        fake_cursor = FakeCursor()
        connection = FakeConnection(fake_cursor)
        backup = {"fullRowSha256": quarantine.full_row_digest(rows)}
        with patch.object(quarantine, "backup_first", return_value=(Path("unused"), "a" * 64, backup, rows)), \
             patch.object(quarantine, "connect", return_value=connection), \
             patch.object(quarantine, "candidate_rows", return_value=rows), \
             patch.object(quarantine, "fixture_violations", return_value=[]), \
             patch.object(quarantine, "audit", return_value={"blockers": ["new reference"]}):
            with self.assertRaisesRegex(RuntimeError, "transactional preflight changed"):
                quarantine.apply_quarantine()
        self.assertEqual(1, connection.rollbacks)
        self.assertEqual(0, connection.commits)
        self.assertFalse(any(statement.startswith("UPDATE ") for statement in fake_cursor.statements))

    def test_apply_updates_only_backed_up_ids_and_checks_target_hash_before_commit(self):
        rows = seed_formula_rows()
        moved = [{**row, "tenant_id": "local-social-fixture"} for row in rows]
        fake_cursor = FakeCursor()
        connection = FakeConnection(fake_cursor)
        backup = {"fullRowSha256": quarantine.full_row_digest(rows)}
        with patch.object(quarantine, "backup_first", return_value=(Path("unused"), "a" * 64, backup, rows)), \
             patch.object(quarantine, "connect", return_value=connection), \
             patch.object(quarantine, "candidate_rows", side_effect=[rows, []]), \
             patch.object(quarantine, "rows_by_ids", return_value=moved), \
             patch.object(quarantine, "tenant_total", side_effect=[0, 381, 0, 381]), \
             patch.object(quarantine, "fixture_violations", return_value=[]), \
             patch.object(quarantine, "audit", return_value={
                 "blockers": [], "candidateFullRowSha256": backup["fullRowSha256"]
             }), \
             patch("builtins.print"):
            quarantine.apply_quarantine()
        updates = [statement for statement in fake_cursor.statements if statement.startswith("UPDATE ")]
        self.assertEqual(381, len(updates))
        self.assertTrue(all("soc_leaderboard_projection" in statement
                            and "WHERE id=%s AND tenant_id=%s AND source_watermark=%s" in statement
                            for statement in updates))
        self.assertEqual(1, connection.commits)
        self.assertEqual(0, connection.rollbacks)

    def test_restore_refuses_competing_platform_unique_key(self):
        cursor = FakeCursor(next_count=1)
        with self.assertRaisesRegex(RuntimeError, "competing leaderboard unique key"):
            quarantine.assert_restore_unique_keys_clear(cursor, [seed_formula_rows()[0]])
        self.assertFalse(any(statement.startswith("UPDATE ") for statement in cursor.statements))

    def test_wrong_backup_sha_refuses_restore_before_connecting(self):
        with TemporaryDirectory() as directory:
            backup = Path(directory) / "backup.json"
            backup.write_text("{}", encoding="utf-8")
            with patch.object(quarantine, "connect", side_effect=AssertionError("must not connect")):
                with self.assertRaisesRegex(RuntimeError, "backup SHA-256 mismatch"):
                    quarantine.restore(backup, "0" * 64)


if __name__ == "__main__":
    main()
