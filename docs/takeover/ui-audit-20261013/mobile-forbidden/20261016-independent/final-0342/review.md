# MB005 independent final H5 UI review

**UI_PASS — current candidate4 formal H5 visual/interaction fixture scope.** Real IAM/backend business acceptance, native devices and assistive-device acceptance are **NOT_RUN**. This review does not upgrade R1 business or release readiness. Reviewer: `/root/mb003_final`; source author and engineering integration are separate.

## Exact final source

All eight raw SHA256 values match `candidate4/source-freeze.json` and were checked again at final collection. No product/shared source, main audit document or Git was changed by this reviewer.

| File | SHA256 |
| --- | --- |
| apps/mobile/src/pages/forbidden/forbidden.vue | d38dd97ccb717d3b477327cef5af49fa84d265df0a0032a17e2725ad6e85e718 |
| packages/i18n/src/mobile-experience.ts | cb47a78d810e2c2b08fc280f237cae726ee7a66cc2c0bf2dccf7c1112baaca83 |
| apps/mobile/tests/ui-forbidden.e2e.cjs | 04ff778848e3f8746430b1579feff2e4d27ec75b9415928a021e178a6588b2de |
| apps/mobile/tests/adult-consent-copy.test.mjs | 14e90f2993e0f8b1ae446e50c33320c3d6c0165e4f6f07b18aca49c201740886 |
| apps/mobile/src/stores/session.ts | d944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931 |
| apps/mobile/src/auth/gateway-auth.ts | 746bb9d83d241162bce9d9cd701d2f6662d11a132977533e3ba2a11e428c3277 |
| apps/mobile/src/auth/navigation.ts | 7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5 |
| apps/mobile/src/platform/pointer-feedback.ts | 24a1f9b26ad6797fc9a61a16cb43559d116230cd7e9cd66c1dd4d9a563d94a6c |

## Current candidate4 evidence

| JSON under candidate4/ | Actual scope | Result |
| --- | --- | --- |
| visual-results.json | Five displayed states × four themes, both locales, selected320/390 widths; additional768/1280 samples; one H1/native document.title, no raw key/overlay/overflow, actual H5 hosts and visible focus | 22 PASS, pageErrors0 |
| text-results.json | Five states at320 English200% short dark viewport; Chinese390/desktop1280 samples; generic English200% across all four themes | 10 PASS, pageErrors0 |
| interaction-run2/interaction-results.json | Account/help/logout each real0/160ms click, drag-away and native touchCancel; help/logout Enter and Space, visible focus, one actual destination/logout, cancellation produces no action | 16 PASS, pageErrors0 |
| owner-query-run2/owner-query-results.json | Old logout resolves while a new login is still pending, then the new owner completes safely; real malicious deep-link query cannot manufacture adult/withdrawn reason or external redirect, followed by actual synthetic sign-in to fixed settings destination | 2 PASS, pageErrors0 |
| closure-results.json | Official native interceptor cancellation reaches the bounded single alert/unlocks, removing interceptor permits actual settings navigation; logout503 shows current unknown title and honest device-exit message, then safe login works | 2 PASS, pageErrors0 |

These are52 current-source records across the named scopes, not a product-completion percentage. Every group checks the frozen hashes. Some raw `scope` strings still contain a candidate2 template label; they were left intact. Their sourceHashesBefore/After are current cb47/04ff, and actual headings contain the final short words. Folder names, full hashes and rendered facts identify the version; template text is not used to inherit an old pass.

The visual script asserts exact nonempty controls: three actual `[role=button]` hosts for authenticated states, one for anonymous, and corresponding button text plus heading/description. Across22 samples it measured58 controls; minimum text contrast and identifying primary/secondary boundary contrast are both5.504:1. Every primary is at least48px high; targets are at least44px. The primary focus outline is visibly2px solid and uses the same measured identifying color. Text-only exit controls are identified by their readable text/focus, not falsely assigned a nonexistent border.

## Earlier same-page logic scope retained with its real version

`../../20261015-independent/candidate2-2335/run2/risk-results.json` contains11 independent cases on page d38 / copy2a14: fixed account/help exits, logout true/false and pending conflicts, real native cancel recovery/retry, controlled late navigation completion, new-owner and hide late-logout guards, read503→unknown→visible reload recovery, primary Enter/Space. That is explicitly candidate2 evidence. Candidate2→candidate4 only changes two English H1 strings and matching test expectations; page/security sources are unchanged. The changed headings/layout, all remaining interactions, actual query/new-login boundary and cancel/logoutfalse paths were actually exercised on candidate4 above. The11 old cases were not relabeled as current or counted twice. Author128 matrix and engineering results remain separate.

## Five-point fidelity review from actual images

The complete `concept.png` and current candidate4 adult390 Chinese-light, generic/unknown320 English200-dark, paused/anonymous390 English-dark and logoutfalse English pictures were viewed in the same review operation.

1. **Structure:** open single column, light brand top, one reason heading and one explanation; duplicate header/card layers and heavy shadows are absent.
2. **Hierarchy:** smaller22px lock and28px normal H1 follow DESIGN-SPEC. The outline brand/shared semantic colors intentionally adapt the generated reference; its gradient and larger lock are not copied into runtime.
3. **Actions:** primary account action, outlined help action and separated exit are visually distinct. Anonymous/cleared-session state honestly shows only the safe sign-in action. Current sticky paused state never claims the owner explicitly withdrew consent.
4. **Flow:** normal390px hierarchy has comfortable spacing; short-screen200% content scrolls naturally and the exit is reachable. There is no fixed bottom control masking text. Buttons grow and wrap at spaces.
5. **Words and contrast:** final `This content is not available.` and `We cannot confirm access` remain whole words at320/200%; the prior `unavailable` and `confirmed` split failures are gone. All ten final text samples have no horizontal overflow or DOM Range word split. Actual visual reading agrees with the geometry and contrast records.

No unresolved material visual/interaction issue was found in the signed scope. State-source limitations remain honest: a sticky ownerless safety marker supports neutral paused copy, not an authoritative withdrawal claim; local bounded navigation waiting cannot cancel an already dispatched platform navigation. The controlled late-Promise test does not claim otherwise.

## Preserved failures and harness corrections

- Candidate1 real `uni.addInterceptor` invoke=false left busy indefinitely: original script/2200ms image remains in `../../20261015-independent/candidate1-2300/`. This was a product failure; candidate4 real cancel/retry proves recovery.
- Candidate1 native `button` selection produced empty control arrays. Its earlier boundary claim is withdrawn by `visual-controls-erratum.md`; original records are untouched. Current exact-host count assertions prevent vacuous passes.
- Candidate2 `unavailable` and candidate3 `confirmed` actually split at320/200%. Their images/Range failures remain in this directory and candidate3/. Candidate3 all-case diagnosis retained8PASS/2FAIL; it was not waived.
- Candidate2 footer `button` locator timeout is a harness failure, corrected in its separate run2.
- Candidate4 pointer run1 required an exactly constant top. The existing shared uni.scss active translation is1px; run2 records that transform, limits displacement to1.01px and proves the old real center still hits the action. All trusted click/action counts and cancellation assertions remain strict.
- Candidate4 query run1 compared a raw encoded returnTo to a decoded path. Run2 additionally uses the real login UI with synthetic intercepted credentials and proves actual settings navigation with zero external requests. It does not declare safety merely from decoding a string.

## Method and operating boundary

Browser plugin API/browser skill was unavailable; existing Playwright Chromium was used without installing dependencies. All contexts were isolated, all APIs intercepted with synthetic fixtures, and outside-page origins blocked. Network evidence is metadata only. No real account or reset secret, request body/header, cookie/storage or token value was inspected or logged. Native touchCancel means browser CDP touch cancellation, not physical-device acceptance.

Only verified owned services were refreshed for shared i18n. Current service is session10670 / PID36440, creation2026-10-16T03:55:51.253027+08:00, fixed127.0.0.1:18183 strictPort/force. `candidate4/service.json` records ownership. No unknown/shared process was stopped. No independent group is now in flight. Every new group checked actual ordinary allowance/primary usage; last group started at30%/week36%, ordinary allowed. No reset credit was used.

**Final signature:** `/root/mb003_final` signs candidate4 named H5 fixture UI scope only. Real backend business, native runtime, physical assistive technology, production performance and release acceptance remain NOT_RUN.
