# MB004 final-1735 pending-refresh restore module regression

Scope: only apps/mobile/tests/mobile-gateway-auth-bootstrap.test.mjs was edited. Application/shared source, Git, main documents and the resume test were not changed. No browser or real IAM/UI acceptance is claimed.

The original gateway test and baseline output are preserved here. Baseline existing two-file run: 25 pass, 0 fail, 0 skipped. Historical first-run FAIL artifacts in the parent evidence directory remain untouched.

Four added cases execute the real session store, Vue/Pinia, gateway auth adapter and API client with isolated synthetic request callbacks:

- An already restored owner starts a refresh; both subsequent restore calls remain pending without duplicate refresh. HTTP 200 alone does not finish them: canonical principal verification is required. Status refreshing grants neither authentication nor learning readiness.
- Refresh endpoint 401 completes waiting restore without identity/token or authenticated readiness.
- Canonical principal 401 after refresh 200 also fails closed without replaying refresh.
- Delayed canonical A after logout and completed B login cannot restore A, replace B token/owner, or wipe B caches.

Final existing gateway + resume run: 29 pass (gateway 17, resume 12), 0 fail, 0 skipped. Existing owner, bootstrap, cookie refresh, late response and cache checks remain in place. These are module-level synthetic rejection/success fixtures; no credential, cookie or real storage access occurs.

SHA-256 values are recorded in before-manifest.json and after-manifest.json. Source drift:
none
Resume test unchanged:
True
