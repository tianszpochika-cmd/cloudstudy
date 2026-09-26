# Assessment owner: legacy local rows and V7 migration

## Current local owner schema

- `p1r_schema_history` is authoritative for externally migrated assessment schema. Before this pass it recorded V1–V6 with checksums matching the source files. The old `flyway_schema_history` stopped at V4 because the shared runner intentionally disables assessment Flyway.
- V5 outbox columns/index and V6 alternative pin columns were already present. A scoped read-only plan showed V7 as the sole pending version and no checksum drift.
- `node scripts/database/reconcile-owner-schemas.mjs --service assessment-service --migrations-only --apply` applied only V7. This path skipped database user recreation, grants, and every other owner schema. A second plan showed V1–V7 recorded, no pending version, and no checksum drift.
- Before V7, 96 `SKIPPED` B25 reports had a chosen starting CEFR level and zero score stored as if assessed. After V7, all 96 have `result_kind=SKIPPED`, `cefr_level=NULL`, `score=NULL`, `session.score=NULL`, and a non-null `requested_starting_level`. The 321 non-skipped reports remain `ASSESSED` with non-null score and CEFR level. No service was restarted for this schema migration.

## Legacy persisted state risk

- The local compatibility tables contain 100 synthetic legacy sessions, all `PRACTICE/CLOSED`; neither value is a valid current session enum. Their 100 exercise snapshots contain only fixture metadata, not frozen scoring rules. `assessment_report` has 100 synthetic JSON evidence objects, while the current domain requires arrays of maps. `assessment_mistake` has 69 `bulk-100x-v1`, 10 `local-real-10x-v1`, 15 manual demo, and 6 course demo rows; the first two groups include invalid `OPEN/WEAK` states or non-list reason traces.
- The earlier local boot log reported 504 per-row skips. After the grouped restart at 2026-09-23 10:37 CST, the current assessment process emits one aggregate warning for 489 invalid persisted rows: 100 sessions, 100 reports, 100 checkpoints, 100 exercises, 10 attempts, and 79 mistakes. These rows remain stored and excluded from live assessment state. The difference between the earlier and current counts must not be interpreted as a data deletion; the loader now aggregates the categories it actually rejects. No confirmed real-user row was found in the identified synthetic provenance groups. A production deployment with an invalid real row remains fail closed unless local compatibility mode is explicitly enabled.
- Changing these values to current enum names would turn invented scores into live assessment facts. The 10x fixture generator now stops seeding the ten legacy compatibility tables and checks 108 current owner features instead of 118. Existing database rows are preserved for audit and are still excluded by the compatibility loader. The loader now gives one aggregate warning at startup instead of 504 per-row warnings. A strictly empty `{}` reason trace restores as an empty list; non-empty objects remain rejected. The manual demo generator now writes `[]`.

## Verification

- `node --test tests/database/local-real-10x.test.mjs`: 8/8 pass, including checks that invented legacy assessment scores are not seeded and synthetic content/site cards stay unpublished.
- `node scripts/database/check-local-real-10x.mjs`: 108/108 current fixture checks pass against local MySQL.
- Assessment isolated `mvn test package`: 70 tests, 0 failures, 0 errors, 2 skipped. Boot JAR: `C:\Temp\cloudstudy-uat-assessment-20260923-src\target\assessment-service-0.1.0-SNAPSHOT.jar`. The identical JAR was swapped into the local shared runner during the 2026-09-23 10:37 CST grouped restart; its health check passed and its aggregate 489-row warning was verified. This proves startup compatibility only, not canonical placement or trustworthy legacy scores. Docker application images are still pending a grouped rebuild.

## Remaining decision boundary

The legacy synthetic rows stay in MySQL. Removing or transforming those rows should use an explicit owner-scoped archival policy with provenance checks. This pass neither deletes them nor presents their scores as real results.
