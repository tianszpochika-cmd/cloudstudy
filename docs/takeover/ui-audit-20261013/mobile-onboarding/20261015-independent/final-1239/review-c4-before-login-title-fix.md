# Independent MB004 review — pending title lifecycle correction

**NOT SIGNED as a whole page.** Current MB004 product combination is page c4c691dd / copy 7b21f6e0 / session d944c9e8 / helper 24a1f9b2. Full eight-file hashes are in `revision-c4c-24a/product-freeze.json`; each completed group checks its scope before and after execution. All APIs are intercepted with synthetic fixtures. Browser plugin is unavailable, so existing Playwright Chromium was used. No real credentials, backend, native device, request bodies/headers, cookies, token values or authentication storage were inspected.

Current independently completed evidence:

| Evidence | Actual scope | Result |
| --- | --- | --- |
| `revision-c4c-24a/visual-boundaries-results.json` | Four themes, checkbox checked/unchecked, input/goal/quota boundaries, four-state screenshots | 14 rendered records PASS |
| `revision-c4c-24a/risk-results.json` | Explicit adult eligibility, missing/unknown/restricted facts,503, bounded target403 refresh, current-consent rejection, zero implicit signing, target unreadability, keyboard/ARIA/busy, late callbacks and exits | 16 cases PASS |
| `revision-c4c-24a/pointer-text-results.json` | Real 0/160ms old-center press, drag/nativecancel, disabled end release and recovery, secondary freeze, four states at320/390/1280 English200% on short dark viewport | 18 cases PASS |
| `auth3-helper24a/results.json` | Login/register/reset each 0/160ms click, drag/nativecancel, error recovery, pending single action and retry | 15 cases PASS |
| `revision-c4c-24a/restoring-run4-diagnostic/restoring-results.json` | Actual onShow refresh200,401, logout while refresh held and late200 | Three behavior assertions PASS, overall FAIL from two unhandled title API rejections |

The minimum measured unchecked/input/unselected-choice edge contrast is5.504:1 against both fill and surrounding page; checked-checkbox outer boundary minimum is3.696:1. Actual current screenshots were viewed, including the concept comparison,320 English200 gate/goal,390 consent and1280 assessment. Progress labels and time choices keep whole words, the placeholder displays `e.g. 1995`, and no horizontal document overflow, raw translation keys or build overlay was found in these samples.

The remaining actual failure is **login onShow's title update**, not onboarding watch(step). `revision-c4c-24a/title-run2/title-origin-results.json` wraps the real title API while preserving return/rejection. The rejected call has title `登录`, route `#/pages/login/login`, and stack from served `src/pages/login/login.vue:123:8`. Rejection is `setNavigationBarTitle:fail page not found`. Successful renewal has no pageerror;401 and logout-late each expose one. Do not waive the generic earlier `Object` messages or claim pageerror0.

Login does not consume the shared pointer helper; that page's real-pointer regression is explicitly recorded with helperUsed=false. Register/reset exercise the changed shared helper. Their formal page hashes remain1d347967 /9258cb03 /c9a6da86 in this regression receipt.

Preserved failures: original f56 checkbox light boundary;854/9a held-pointer failure; first restoration route-prefix harness assertion; subsequent restoration pageerror failures; first title instrumentation attempt did not override read-only getters and is diagnostic-only. The later cloned API wrapper establishes the real callsite without suppressing rejection.

Service: only our own old87595/PID24472 was refreshed with fixed strictPort/force after both sides had no group in flight. Current service72774/PID35148, creation2026-10-15T17:49:22.198750+08:00, binds127.0.0.1:18183. `revision-c4c-24a/service.json` records ownership and `fresh-resource.json` records actual rendered new copy. Native backend/business and device acceptance remain NOT_RUN.

Next acceptance is the minimal login title lifecycle fix, then repeat the affected restoration/exit cases and verify actual source hashes. No product code, shared source, Git or main audit document was modified by this independent reviewer.
