# MB006 OWNER late-response lifecycle — prepared only (Root executes)

Date 2026-10-21. **DSH wrote / Root audits and executes.** This directory is test
preparation only. DSH did **not** launch a browser, run a probe, start or stop a
service, touch product source, run Git, or claim any PASS. No whole-page sign-off is
implied.

Scope: two independent C8 UI-lifecycle cases, each in its own process and context:

| case | prepared scenario |
|---|---|
| `owner-late-submit` | A real start, real select A, transport-held response, real Submit (busy); switch the synthetic IAM principal to 401; real browser Back, existing hash guard + rollback triggers the existing IAM revalidation; on a stable real login switch the synthetic subject to B, log in with the real form; release A's old response; check B DOM/route/focus and write counts. |
| `owner-late-read` | A real start, no selection, real Settings, transport-held placement GET, real browser Back to the busy assessment read; switch the synthetic IAM principal to 401; real browser Back again; on a stable real login switch to B and log in; release A's old GET; check B DOM/route/focus and zero start/write. |

The IAM subject/status change is a **synthetic API transport fact only**. Real login
form, real existing IAM/navigation guard, real UI, real browser history.

## 1. Gate — Root must set the page hash explicitly

Required environment (no defaults, no auto-accept):

| variable | rule |
|---|---|
| `OWNER_CONFIRM_BROWSER` | must be exactly `1` |
| `OWNER_RUN` | required, unique, `/^[a-z0-9][a-z0-9-]{0,63}$/i`; an existing run directory is refused and never overwritten |
| `OWNER_EXECUTOR` | required, 1–80 chars from `[A-Za-z0-9 ._-]` |
| `OWNER_EXPECTED_PAGE_SHA` | required; exactly 64 lowercase hex; must equal the current page bytes **and** the approved C8 hash `41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86` |

There is no default page hash. A missing, malformed, wrong, or stale hash refuses with
exit **2 before launching Chromium and before creating any run directory**. (The case
files do `require` the local fixture, which loads the Playwright module, but no browser
is launched until `fixture.init()` after the gate passes.)
The seven support files and two mobile dependency files keep the strict risk-suite
values; drift refuses instead of being rewritten:

| file | frozen SHA-256 |
|---|---|
| `packages/i18n/src/mobile-experience.ts` | `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` |
| `apps/mobile/src/api/learner-content.ts` | `43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6` |
| `apps/mobile/src/stores/learner-content.ts` | `95cc92496db996242d91baed3301d76f985e4e3b9134e1e50c2b9ab8d41e4c61` |
| `apps/mobile/src/stores/session.ts` | `d944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931` |
| `apps/mobile/src/auth/navigation.ts` | `7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5` |
| `apps/mobile/src/platform/uni-runtime.ts` | `fcbeba8626d8364af0ae96db64a05fcff9a3bb2b46a7d8fbcba21507ef609751` |
| `apps/mobile/src/uni.scss` | `0bd56842fc5baebd8767e721f2d938986e293d1d87bfc74bb087b3c228f638d7` |
| `apps/mobile/package.json` | `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078` |
| `pnpm-lock.yaml` | `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624` |

The page + the seven support files are the eight-source guard; the two dependency files
are the unchanged risk-suite dependency guard. All ten are re-hashed before and after
the case; a mid-run change is `BLOCKED_SETUP_INCOMPLETE`, not a product verdict.

## 2. Run (Root review environment only)

Services already refreshed to fixed `127.0.0.1:18183`; these scripts never start,
stop, or repoint a service and never select a port.

```powershell
$env:OWNER_CONFIRM_BROWSER='1'
$env:OWNER_RUN='owner-review-20261021-1'          # unique; existing dir refused
$env:OWNER_EXECUTOR='root-review'
$env:OWNER_EXPECTED_PAGE_SHA='41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86'
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-owner/owner-late-submit.cjs
node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-owner/owner-late-read.cjs
```

Each case is a separate process and context and writes
`runs/<run>/<case>/{results.json,manifest.json,*.png}`. Use a different `OWNER_RUN` (or
the same run id with two different case directories) so neither case writes the other's
evidence. Output is never pre-created by DSH.

Exit codes:

- **0** — every selected, actually executed scoped check passed; non-empty evidence.
  This is **not** whole-page acceptance.
- **1** — a measured product safety assertion failed (stale A question/report/error,
  illegal navigation, extra write/start, pageerror, unexcluded console error, unknown
  501, unexpected dialog).
- **2** — refusal, source/dependency drift, setup incomplete, or a NOT_CONSTRUCTED
  branch (including the busy guard not constructing the IAM-revalidation login).

## 3. Injection boundary

Allowed and only allowed:

1. synthetic API status flags `state.principalStatus` / `state.refreshStatus`
   (`401` then `200`) — the next synthetic IAM responses only;
2. explicit transport holds (`state.hold('response')`, `state.hold('get')`) and the
   matching `release`;
3. the synthetic IAM `subject` string (`A` then `B`) used by the synthetic transport;
4. the synthetic API responses and request counting already present in the risk
   fixture.

Forbidden and not used: writing app store/session/token/storage/JWT/guard/`onShow`
state; patching `history`/`popstate`; calling page functions or `app.navigate`;
reading cookies/storage/request headers/bodies/tokens/real user data. The script never
calls `page.evaluate` to write app state; its `evaluate` calls are read-only DOM/route
facts (`location.hash`, `innerText`, attributes, `document.activeElement`) and scroll
reset before a screenshot. Dialogs are only ever **dismissed**, never accepted.

## 4. What each case actually asserts

Common evidence per step: full-page PNG, read-only DOM facts (present nodes, options,
`aria-pressed`/`disabled`, busy, active element, error text, stem/report text), actual
`location.hash`, and synthetic transport counts (`login/refresh/principal/start/respond/
retest/ensure/GET/placementGet`).

`owner-late-submit` executed assertions (only after the flow is actually constructed):

- A guide → start → question has 4 options → real select A → held submit is `aria-busy`
  and `respond === 1`.
- Real Back + guard rollback produces observable IAM principal/refresh traffic and a
  stable real login; no A question/report/skipped/error on login; `respond` still 1.
- Real B login (synthetic subject B, 200) reaches B's assessment guide; no A stem/
  question/report/error; `start === 1`, `respond === 1`, `retest === 0`, `ensure === 0`.
- After releasing A's old response and waiting for the actual late packet: B route
  stays exactly assessment, guide remains, no A question/report/error, focus is not on
  an old question/submit control, no illegal navigation, and no new
  respond/retest/ensure/start. The late A write is only the original `respond === 1`.

`owner-late-read` executed assertions:

- A guide → start → question with no selection → real Settings.
- Real Back into assessment holds exactly one placement GET with the read busy;
  `start === 1`, `respond === 0`.
- Real Back again + guard rollback produces observable IAM traffic and a stable real
  login; no A question/report/error; `placementGet === 1`, no writes.
- Real B login reaches B's guide; no A stem/question/report/error; `start === 1`,
  `placementGet === 1`, zero respond/retest/ensure.
- After releasing A's old GET: B route/DOM/focus unchanged, no old error/navigation,
  no new start or write, `placementGet` stays 1.

The late-response check is a **UI leak/ownership-surface check**, not proof of backend
owner authorization, real IAM, real DB, Gateway, native, or whole-page behavior.

## 5. NOT_CONSTRUCTED / no guessing

If the public busy/hash guard does not construct the 401 login precondition (for
example, the back is vetoed without observable IAM traffic, or the stable route is
not login), the case:

- preserves the actual route, counts, `aria-busy`, pending holds, and DOM in
  `results.json` and a PNG;
- records a named `*-NOT_CONSTRUCTED` setup entry and exits **2**;
- does **not** convert the unexecuted B/release assertions into PASS or into a product
  FAIL.

The same rule applies if the first question/guide, the held write/GET, the real
settings route, the stable login form, or the real B login form is not reached. Only
executed, named scope can be PASS.

The app's existing mobile API client has an 8,000 ms request timeout. If the held A
response/GET outlives that window (or its route handle is already gone), the actual late
packet is not delivered to the app; the case records `late-packet-NOT_CONSTRUCTED`
with the measured hold duration and `fulfillErrors`, and exits **2** instead of
asserting a late-packet result that did not happen. The preparation does not extend or
patch that timeout.

## 6. Console / warnings policy

- Any `pageerror`, any console error not exactly matched to a fixture-injected status
  on the exact injected path, any unknown 501, and any `alert`/`confirm`/`prompt`
  dialog are FAIL.
- Console warnings are recorded verbatim in `consoleWarnings`, with the case label and
  the raw text/path. The known settings `Do not nest other components in text`
  warning (settings `text`-wrapped `AppIcon`) is marked `knownSettingsTextAppIcon` and
  kept; it is **not** attributed to the assessment page and **not** silently dropped.
  Warnings do not become PASS evidence.

## 7. Files

| file | purpose |
|---|---|
| `owner-lib.cjs` | local trimmed risk/lifecycle helper: env page gate, 8-source + 2-dependency freeze, unique run, reporter, read-only DOM/route/counts/PNG, dialog observation, exact-injection console policy, guaranteed close, before/after hashes, 0/1/2 semantics. |
| `fixture.cjs` | local copy of `dsh-20261020-risk/fixture.cjs` with only: owner subject prefix, `refreshStatus` synthetic flag, real B login-form helper, and verbatim console-warning capture. Strict API list, unknown 501, target-read separation and "no storage/header/body/token" rules unchanged. |
| `owner-late-submit.cjs` | case 1. |
| `owner-late-read.cjs` | case 2. |
| `source-freeze.json` | C8 page + seven support + two dependency hashes; support/dependency values unchanged from the risk C8 freeze. |
| `README.md` | this contract. |

No other file is written. `runs/` is created only by Root execution.

## 8. Evidence level of this preparation

`[读取]` the C8 page and support sources at the hashes above; `[实测]` the hashes were
recomputed in this session with `Get-FileHash -Algorithm SHA256` (lowercased) and match
the tables. `[读取]` the existing C8/risk/lifecycle/backguard/states prepared suites for
the guard/rollback/busy and 401 facts. `[未验证]` all runtime behavior in this suite:
DSH executed no browser, no probe, no service call, and no case. The static claim that
this case is *prepared* is not a claim that it will pass, that the product has no leak,
or that the page is accepted.
