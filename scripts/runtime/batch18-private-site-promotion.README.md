# Batch18 private official-site and mobile H5 promotion

This helper is scoped to the private Compose project `cloudstudy-uat-isolated-3c94b27160`, the exact release tag `583ab627-uat-batch18-202609250315`, and only `official-site` plus `mobile-h5`. It requires the completed private IAM V17 receipt. Since Batch17 `state.json` and `docker-compose.isolated.yml` still describe the pre-V17 IAM image, it layers a separate private Compose override that pins IAM to the V17 receipt image while selecting Batch18 candidates. The shared `yuxuexing-local` project is fingerprinted before and after service changes.

Run from the repository root in PowerShell after both candidate images have been built:

```powershell
$state = '<existing private Batch17 state.json>'
node scripts/runtime/batch18-private-site-promotion.mjs dry-run $state
node scripts/runtime/batch18-private-site-promotion.mjs preflight $state
node scripts/runtime/batch18-private-site-promotion.mjs promote $state
node scripts/runtime/batch18-private-site-promotion.mjs refresh-proxy $state
node scripts/runtime/batch18-private-site-promotion.mjs readiness $state
# Run the Batch18 browser checks, including the official-to-mobile handoff.
node scripts/runtime/batch18-private-site-promotion.mjs verify $state
node scripts/runtime/batch18-private-site-promotion.mjs status $state
```

`dry-run` is read-only: it sends the Batch18 image overlay through Compose stdin and checks candidate image IDs, running state, isolation and the shared fingerprint. `preflight` repeats the guards and writes only `batch18-private-promotion.json` and `docker-compose.batch18-promotion.yml` in the private temp directory. The overlay contains the existing V17 IAM image and exactly the two approved Batch18 image tags.

`promote` updates the two app containers one at a time with Compose `--no-deps --no-build --pull never`; no IAM, Gateway, database, owner service, shared project, or dependency container is selected. It records progress after each verified service. If interrupted after a container is replaced but before receipt progress is written, rerun `promote`: the exact recorded candidate image and a new running container are recognized and skipped. Any image, identity, network, port, shared fingerprint, or non-target drift stops the operation.

`refresh-proxy` restarts only the private HTTPS proxy after both application replacements. Nginx caches DNS upstreams, so restart it before browser checks. This proxy is a separately created 27th container and is deliberately excluded from the exact 26 Compose-service snapshot; its private project label, identity, network, and zero host-port bindings are checked separately.

`readiness` runs the existing 19 private HTTP readiness targets from an ephemeral Node utility container on the isolated network, then proves the 26-service snapshot and shared fingerprint did not change. Run browser checks after readiness. `verify` records container and image IDs plus the unchanged shared fingerprint only after the private proxy refresh; it does not claim browser interaction success.

If a browser check fails, `rollback` restores only `official-site` and `mobile-h5` to the exact Batch17 image tags and IDs from the preflight receipt. It retains the completed IAM V17 candidate. The rollback has the same per-service resume guard; after it completes run `refresh-proxy`, `readiness`, then `status` and retry the checks against Batch17.

The ordinary Batch17 `docker-compose.isolated.yml` and `state.json` still name the pre-V17 IAM image. Keep the appropriate Batch18 overlay in every later private Compose invocation: use `docker-compose.batch18-promotion.yml` while Batch18 is active and `docker-compose.batch18-rollback.yml` after rollback. Do not run a later `docker compose up` against only the stale Batch17 override, because that could select the old IAM image. The Batch18 helper always layers the selected overlay and refuses changes outside the recorded candidate scope.

Focused guard and simulated-resume tests:

```powershell
node --test tests/uat/batch18-private-site-promotion.test.mjs
```
