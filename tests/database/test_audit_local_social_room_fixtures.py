"""Pure safety checks for the read-only social fixture auditor."""

import importlib.util
from pathlib import Path
import unittest


SOURCE = Path(__file__).resolve().parents[2] / "scripts/database/audit_local_social_room_fixtures.py"
SPEC = importlib.util.spec_from_file_location("social_room_fixture_audit", SOURCE)
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


class SocialFixtureScopeTest(unittest.TestCase):
    def test_only_exact_bulk_family_and_expected_index_range_is_accepted(self):
        self.assertEqual(12, audit.fixture_index(
            "soc_study_room", "bulk-100x-soc_study_room-room-0012"))
        self.assertEqual(100, audit.fixture_index(
            "soc_study_room", "bulk-100x-soc_study_room-room-0100"))
        self.assertIsNone(audit.fixture_index(
            "soc_study_room", "bulk-100x-soc_study_room-room-0011"))
        self.assertIsNone(audit.fixture_index(
            "soc_study_room", "bulk-100x-soc_room_member-room-0068"))
        self.assertIsNone(audit.fixture_index("soc_study_room", "local-10x-room-01"))
        self.assertIsNone(audit.fixture_index(
            "soc_room_member", "bulk-100x-soc_room_member-room-0067"))
        self.assertEqual(68, audit.fixture_index(
            "soc_room_member", "bulk-100x-soc_room_member-room-0068"))
        self.assertEqual("local10x", audit.visible_family("soc_study_room", "local-10x-room-01"))
        self.assertEqual("foundation", audit.visible_family("soc_room_member", "room-local-foundations"))
        self.assertIsNone(audit.visible_family("soc_study_room", "local-10x-room-00"))
        with self.assertRaises(ValueError):
            audit.fixture_index("iam_account", "bulk-100x-soc_study_room-room-0012")

    def test_fingerprint_covers_full_rows_without_depending_on_fetch_order(self):
        original = [{"id": 2, "room_id": "b", "state": "OPEN"},
                    {"id": 1, "room_id": "a", "state": "OPEN"}]
        reordered = list(reversed(original))
        changed = [{**original[0], "state": "CLOSED"}, original[1]]
        self.assertEqual(audit.row_fingerprint(original), audit.row_fingerprint(reordered))
        self.assertNotEqual(audit.row_fingerprint(original), audit.row_fingerprint(changed))


if __name__ == "__main__":
    unittest.main()
