# Private IAM V17 promotion

This helper is limited to the private Compose project `cloudstudy-uat-isolated-3c94b27160` and IAM candidate `cloudstudy-clyunedev/iam-service:583ab627-uat-batch17-202609250206`. It does not edit the shared Compose helper or Batch16 state. The helper has not been run against Docker or a database; promotion requires an operator review and approval.

## Operator sequence

Run from the repository root in PowerShell, with `$state` set to the existing private Batch17 `state.json` under its project-specific `%TEMP%` directory:

```powershell
$state = '<existing private Batch17 state.json>'
node scripts/runtime/iam-v17-private-promotion.mjs dry-run $state
node scripts/runtime/iam-v17-private-promotion.mjs preflight $state
node scripts/runtime/iam-v17-private-promotion.mjs drain-backup $state
node scripts/runtime/iam-v17-private-promotion.mjs promote $state
node scripts/runtime/iam-v17-private-promotion.mjs verify $state
node scripts/runtime/iam-v17-private-promotion.mjs restore $state
node scripts/runtime/iam-v17-private-promotion.mjs status $state
```

`dry-run` performs the read-only Docker/database checks and writes no files. Run it before `preflight`. `preflight` repeats those checks and writes only a private local receipt; it makes no Docker or database changes. Both check the private Compose boundary, current V16 / absent V17 state, applied Content V22 checksum, candidate image identity, container/shared-service fingerprints, and learner permission baseline. `drain-backup` stops only the 14 private service writers plus the private Gateway, then creates a fresh all-database dump at `iam-v17-before-migration.sql` in that same private temp directory. The dump is streamed directly to a new file, hashed in chunks, and recorded in the separate V17 receipt. It never reuses or overwrites `batch16-before-owner-migration.sql`.

`promote` recreates only `iam-service` with `--no-deps`, `--no-build`, and `--pull never`; its startup Flyway applies V17. The helper probes IAM readiness alone while the other writers and Gateway are down. `verify` checks the exact successful V17 record, unchanged Content V22 history, the 14 learner scopes and exclusions, account eligibility/preservation, candidate container identity, and private/shared fingerprints. `restore` resumes only the original stopped container IDs; once all original writers and Gateway are back, it probes the full 19-endpoint set and repeats the permission checks.

## Interrupted run and recovery

- Before IAM promotion, rerun `drain-backup` only when the receipt is at `writers-stopped` or `backup-verified`. If it is at `backup-started` and the new dump file exists without a receipt hash, do not overwrite or adopt it; leave writers stopped and ask the operator to inspect the private dump and receipt state.
- If interruption leaves the receipt at `preflighted` while any recorded writer/Gateway status changed, `drain-backup` fails closed. Do not reset the receipt. Inspect the original container IDs/images and database history privately, then have the operator decide whether to finish stopping the exact recorded containers or restore their original running state before restarting the reviewed sequence.
- At `promotion-started`, the helper will not blindly re-run Flyway. `promote` resumes only when the database records the exact successful V17 migration and the exact candidate IAM container is running. Otherwise keep Gateway and all drained writers stopped and inspect the database/container state before choosing recovery.
- At `restore-started`, `restore` accepts only the original recorded IDs and images, with each drained container either running or stopped. It starts only the stopped originals. An identity/image mismatch is fail-closed and requires private operator inspection.
- The helper does not automatically roll back. Do not use the Batch16 dump, run Flyway repair, delete migration history, or restart a different stack. A full database restore from `iam-v17-before-migration.sql` is destructive and must be a separately reviewed operator action: keep Gateway and all writers stopped, stop IAM, confirm no post-backup writes need preservation, restore the fresh V17 dump using the approved private DBA procedure, return Compose to the recorded pre-V17 IAM image, then start the exact recorded containers and verify health/fingerprints. If any of those conditions cannot be confirmed, preserve the dump and receipt and leave the private writers stopped pending review.

The CLI suppresses command output on errors to avoid leaking secrets or row data. Inspect detailed Docker/SQL evidence only inside the approved private environment.
