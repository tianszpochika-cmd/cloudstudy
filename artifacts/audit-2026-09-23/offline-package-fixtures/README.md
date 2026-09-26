# Offline package read boundary and local fixture quarantine

## Scope and cause

Mobile H5 calls `GET /api/v1/sync/offline-packages?limit=20`. The running Gateway's broad `/api/v1/sync` rule names `learning-service`, while its execution policy withholds the route because the implemented JDBC controller lives in `notification-service`. The resulting Gateway 404 also makes the mobile browser preflight fail. V2 INF design names `notification-service` with `media-service` and `workflow-service` as the offline sync boundary. The B4 OpenAPI already declares the public GET.

A precise GET-only rule and projection now target `/internal/v1/sync/offline-packages` in `NotificationLocalOfflineController`. The broad sync rule and all offline write paths remain withheld. Notification owner checks a verified token, device claim, and `notification.read`; targeted tests cover anonymous 401, missing device 401, missing permission 403, and mobile Origin credential CORS headers in Gateway. The tenth local Gateway batch now has actual end-to-end empty-list/CORS evidence.

## Synthetic publication audit

The [pre-quarantine inventory](pre-quarantine.json) found 100 packages: 89 `bulk-100x` and 10 `local-10x` exact synthetic rows marked `PUBLISHED`, plus one already `DELETED` foundation row. The bulk rows contain a fixture metadata object instead of signed part URLs and non-hash SHA labels. The local rows contain fixture part names with no backing objects. All 99 published rows had a synthetic download fact: 90 linked to `.invalid` accounts and 9 to absent accounts; none linked to other accounts. A separate scan of 381 structured/reference columns across nine owner schemas found no other references. Media owner facts and all five local MinIO objects contained no offline package bytes. There were **zero real published packages** before withdrawal.

## Applied local quarantine

The [transaction evidence](applied.json) records exact withdrawal of the 99 packages (`state=DELETED`) and isolation of their 99 synthetic download facts under the `local-offline-fixture` tenant, which has no IAM principals. The unrelated foundation row, offline event and receipt history, media facts, and other owner schemas were not changed. Full-row checksums were verified under row locks before and after the transaction. The [post-quarantine inventory](post-quarantine.json) and backup-backed verifier report 0 published packages, 0 other structured references, and 0 offline objects.

The complete 198-row, every-column restore source is outside Git:

`C:\temp\cloudstudy-offline-packages-before-20260923T102527274198Z.json`

Backup SHA-256: `13fb90d9011024cac21e05e7023f0196c92e703b26f17fe8718e9baadb3c88cc`

To recheck without writes:

```powershell
python scripts/database/quarantine_local_offline_packages.py --verify C:\temp\cloudstudy-offline-packages-before-20260923T102527274198Z.json --backup-sha256 13fb90d9011024cac21e05e7023f0196c92e703b26f17fe8718e9baadb3c88cc
```

If the original synthetic data is needed for isolated investigation, `--restore` accepts the same path and SHA. It refuses a changed backup or changed quarantined rows and restores every original column in one transaction.

The fixed `local-real-10x` seed no longer inserts the fake package or download rows. Its fixture manifest and check count were updated from 108 to 106; the local coverage checker now requires zero published synthetic offline packages. The separate `seed-local-real-learning-world` foundation row is already `DELETED` and remains so. No tracked producer for the historic `bulk-100x-v1` offline rows was found; the local checker prevents these rows from silently reappearing as published data.

## Runtime and gates

- Local fixed seed checker: 106 checks PASS.
- Local data coverage checker: 35 checks PASS, including zero published synthetic offline packages.
- Gateway route and CORS targeted Maven tests: 10 PASS.
- Notification principal boundary targeted Maven tests: 2 PASS.
- [New adult owner probe before the batch](../../uat-2026-09-23/offline-package-owner-pre-gateway.json): owner 200 with `items=[]`; anonymous 401, pre-gate 403, no downloads created, disposable account disabled and active sessions/devices revoked. [After the tenth Gateway batch](../../uat-2026-09-23/offline-package-gateway-live.md), the exact Gateway GET and mobile credential CORS pass on the fixed local runtime; five write paths remain withheld.
- Frozen Gateway contract checker remains FAIL in the shared worktree: 64 route rules versus frozen 56, 208 available operations versus frozen 170, digest drift, and IAM deletion's old unavailable assertion. Main task merged/generated canonical OpenAPI, so projection parity now passes; six frozen/semantic failures remain. The [read-only drift review](gateway-freeze-drift-review.md) accounts for all eight routes and 38 operation promotions. Those frozen baselines were not changed by this task.

The remaining business gap is real offline publication: no licensed media object, signed part URL, entitlement and verification chain exists for a downloadable package. The GET now truthfully returns an empty catalog through the deployed local Gateway. Write paths must remain withheld until that chain and permissions are implemented and verified.
