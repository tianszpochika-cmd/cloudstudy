# AUTH3 shared-i18n narrow smoke — PREP (2026-10-21)

Scope: prepare only. DSH wrote this directory and did **not** launch a browser. No product, Git,
service, old evidence, framework or port was touched. This is **not** a 3-auth re-sign and claims
no backend/native PASS.

## Files

| file | lines | note |
|---|---:|---|
| `auth3-shared-i18n-narrow.cjs` | 120 | `node --check` exit **0** |
| `CHECKPOINT.md` | — | this file |

## Source guard (measured 2026-10-21T09:02:59+08:00, SHA-256)

[实测] `Get-FileHash`; expected = actual at prep time. The script re-reads the same nine files
before creating a run and refuses with exit 2 on any drift (actual hashes printed; pins are never
auto-adopted — Root reviews and re-pins explicitly).

| file | sha256 |
|---|---|
| `apps/mobile/src/pages/login/login.vue` | `0c5fb5cd…a55460` |
| `apps/mobile/src/pages/register/register.vue` | `9258cb03…d66baf` |
| `apps/mobile/src/pages/reset-password/reset-password.vue` | `c9a6da86…cc936` |
| `apps/mobile/src/platform/pointer-feedback.ts` | `24a1f9b2…d94a6c` |
| `apps/mobile/src/stores/session.ts` | `d944c9e8…33f8931` |
| `apps/mobile/src/pages/assessment/assessment.vue` (C8) | `41e16701…d7e86` |
| `packages/i18n/src/mobile-experience.ts` | `6ac6800e…247380` |
| `apps/mobile/package.json` | `484382c7…c0078` |
| `pnpm-lock.yaml` | `d57a87ca…106624` |

## What the smoke does (3 pages x 5 named checks = 15)

Per page at 390x844, `?uiLocale=en-US&theme=light`, fixed `http://127.0.0.1:18183`:

1. `open-390-en-US-light` — H1 visible, native field visible, labels/H1/body contain no bare key, `data-theme=light`, `lang` en.
2. `empty-pointer160-required-focus-no-write` — real mouse press held 160 ms on the primary button; required copy visible, focus on the first invalid field, **0** submit requests.
3. `held-submit-one-request-button-disabled` — native `fill` of synthetic valid values, real submit with the fixture holding the response; exactly **1** submit and the primary button locked.
4. `named-<status>-alert-and-button-restored` — release fixture `401`(login)/`409`(register)/`401`(reset confirm); the exact named copy is shown, primary button unlocked.
5. `same-route-no-extra-write-transport-clean` — still the same hash route/H1, submit count still 1, zero pageerror / unknown API / unnamed console error for that page.

Reset enters the confirm step only through the existing "I have the reset code" button; it never
requests email/SMS and never calls `password-reset/request`.

## Transport allowlist

- `OPTIONS *` → `204` (CORS headers only).
- `POST /api/v1/auth/token/refresh` → `401`.
- `POST` the current mode's own submit path → `401` (login), `409` (register), `401` (reset confirm).
- Anything else → `501` and recorded as FAIL. No broad-401 fallback. The fixture reads only method
  and pathname; no request headers/body/token/storage are read or recorded. Busy state is asserted
  on the primary button only. No page function is invoked; fills and presses are native.

## Root run (one unique RUN, never overwritten)

```powershell
$env:CONFIRM='1'; $env:RUN='auth3-narrow-20261021-1'
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-auth3/auth3-shared-i18n-narrow.cjs
```

Evidence: `runs/<RUN>/results.json`. Exit **0** = 15/15 UI-fixture pass, **1** = measured fail,
**2** = refusal / freeze drift / setup or close failure. Warnings are recorded, not waived.

## NOT_RUN / unchanged

- The previous `20261015-title-lifecycle` "clear last required field + pointer160 old-center
  transient edit" group is **stopped and NOT_RUN** for this round; its old artifacts and PASS
  records are unchanged and not re-interpreted.
- No full 3-auth re-sign, no backend/IAM/DB/Gateway probe, no native/App/mini-program check.
- Browser execution is Root-only; this directory was prepared with `node --check` alone.

## Static review fixes (2026-10-21, Root)

1. `location.hash` retains `#`, so the final check compares exactly `'#/pages/' + route`; no substring/contains check.
2. Console `named` no longer falls back on `p === null` + 401/409. A line is named only when a recorded request for the same case, method `POST`, exact pathname `p` and status `code` exists, and the path is the known submit or refresh path. Requests are recorded as method+path+status only; unclassified console errors stay FAIL and unknown 501 stays FAIL.

Pre-fix bytes: `archive/auth3-shared-i18n-narrow.cjs.pre-static-fix.raw` sha256 a3102d7a100f8f9254a48db76e3119cf5c8c31f73cfa5a6e4c4d3e069564d784 (120 lines).
Post-fix: `node --check` exit 0; static compare shows six intended lines changed; no driver run.
