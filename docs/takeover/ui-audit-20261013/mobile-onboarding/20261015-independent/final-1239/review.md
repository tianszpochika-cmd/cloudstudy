# MB004 independent final H5 UI review

**UI_PASS — formal H5 page, isolated synthetic API fixtures, named source combination below.** Real-backend business acceptance and native-device acceptance are **NOT_RUN**. Build/type/module results are separate integration evidence owned by Root.

## Frozen source

Final raw SHA256 values were rechecked after all work. The receipt is `final-signature.json`; no product source or Git was changed by this reviewer.

| File | SHA256 |
| --- | --- |
| onboarding.vue | c4c691dd9ab74c8aa7f21a677d43f3541b22c4ea4642f733ad53c4cf94176086 |
| mobile-experience.ts | 7b21f6e074bf705463e27941cbc4c91847a242443cdbd1ad3deea155fc733dde |
| gateway-auth.ts | 746bb9d83d241162bce9d9cd701d2f6662d11a132977533e3ba2a11e428c3277 |
| session.ts | d944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931 |
| api/learner-content.ts | 43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6 |
| domain/onboarding-resume.ts | ea6e26682e69a9f1c3d8fd47d284aa55d96e39d646e27e5d41d0f556ba902e26 |
| stores/learner-content.ts | 95cc92496db996242d91baed3301d76f985e4e3b9134e1e50c2b9ab8d41e4c61 |
| pointer-feedback.ts | 24a1f9b26ad6797fc9a61a16cb43559d116230cd7e9cd66c1dd4d9a563d94a6c |
| login.vue, title lifecycle followup dependency | 0c5fb5cd346d9e86271eaf65638cf2ffabbc9b466fb3d6cd1079e4fbc9a55460 |

## Independently exercised scope

| Evidence | Result and boundary |
| --- | --- |
| `revision-c4c-24a/visual-boundaries-results.json` | 14 rendered records PASS: actual four-state layout/copy, four-theme checkbox checked/unchecked, input and unselected goal/quota edges. Minimum unchecked/control border ratio against both fill and page is 5.504:1; checked checkbox outer boundary minimum is 3.696:1. |
| `revision-c4c-24a/risk-results.json` | 16 cases PASS: explicit PASSED+ELIGIBLE, missing/UNKNOWN/RESTRICTED fail closed,503, target403 transient/persistent with exactly one owner refresh, persistent refusal blocked with zero target PUT and zero consent PUT, current-consent revocation before save, unreadable target, ARIA, keyboard goal actions, busy guards, late callbacks and logout. |
| `revision-c4c-24a/pointer-text-results.json` | 18 cases PASS: actual old-center 0/160ms clicks, drag and native touchCancel, disabled action release then recovery, enabled secondary freeze, and four states at 320/390/1280 widths with English 200% text on short dark viewport. |
| `login0c5-followup/restoring-results.json` | Three actual onShow race cases PASS, pageErrors empty: refresh200 waits on owned page then permits goal;401 returns an unlocked public login; logout during held refresh cannot be resurrected by late200. No API wrapper or exception waiver was used. |
| `login0c5-followup/gate-keyboard-results.json` | Three cases PASS: input confirm actually focuses the first invalid year/checkbox without test-driven focus; gate primary Enter and Space each issue one request and reject repeat activation while pending. |
| `login0c5-followup/auth3-helper24a/results.json` | 15 narrow cross-page cases PASS: each login/register/reset primary at 0/160ms, drag/nativecancel, error clearance/retry and busy single action. Login has no shared pointer-helper consumer and is explicitly marked helperUsed=false; register/reset exercise the helper. |
| `login0c5-followup/title-results.json` | Eight actual `cases` PASS, pageErrors empty: Chinese/English first login, actual register-signin return, cached history return, and restricted onboarding logout reLaunch all have the correct document.title and no overlay. |

The c4c/7b21/d944/24a eight-file combination remained unchanged across the visual, risk and pointer/text groups. The ninth source is the independently corrected login title lifecycle. Its affected restoration, title and auth-pointer paths were actually repeated against 0c5. Previous 854/9a or f56 results are not relabeled as current-source passes. The normal 128-state author matrix is separate author evidence and was not counted as independent review coverage here.

Actual screenshots were viewed against `concept.png` and current full-page samples. The page preserves an open single-column layout, brand, progress, heading hierarchy and separated footer actions. Current 320 English200 gate/goal,390 consent and1280 assessment pictures retain whole progress/time words; `e.g. 1995` remains readable. No document horizontal overflow, raw translation key or build overlay was found in these rendered samples. The dynamic risk, pointer, restoration, title and cross-auth runs explicitly require no pageerror. Expected intercepted HTTP refusal statuses are not treated as real-backend results.

## Preserved failures and correction proof

- Original f56 checkbox light/system-light boundary failure remains in the parent visual evidence and `boundary-interpretation.md`. Dark/HC border-versus-white-fill alone was not misclassified as an invisible outer boundary.
- 854/9a held-pointer failure remains in `revision-854-9a0/pointer-text-results.json`; the new helper's real enabled/disabled/secondary gestures were repeated.
- Restoration run1's missing hash prefix was a harness assertion error and remains saved. Runs2–4 independently exposed actual title API rejections, not a backend or fake fixture failure.
- `revision-c4c-24a/title-run2/title-origin-results.json` proves the rejected call came from login onShow, title `登录`, with `setNavigationBarTitle:fail page not found`. The 0c5 onReady change actually removes that failure; the final three restoration cases have no pageerror. No global catch, fail callback or API waiver was added by this reviewer.

## Method and limits

Existing Playwright Chromium was used because the Browser plugin/skill was unavailable. Browser contexts were isolated; every API request was intercepted with synthetic facts. A frozen copy of the author's API transport was reused, while the assertions, contrast/background composition, gesture checks, risk cases and title diagnostics were independently written. No real account/email/password/reset secret was used. Request bodies, headers, cookies, authentication storage and token values were not inspected or logged; network evidence is method/origin/path metadata only.

Only the reviewer's owned service was refreshed after both reviewers had no in-flight group. Current service session72774 / PID35148, creation 2026-10-15T17:49:22.198750+08:00, fixed 127.0.0.1:18183 with strictPort and force. `revision-c4c-24a/service.json` and `fresh-resource.json` record ownership and real fresh rendered copy. Last new-group quota check was ordinaryUsageAllowed=true, primary65%, weekly10%; no reset credit was used.

This signature closes the stated H5 visual/interaction fixture scope for MB004. It grants no real IAM/learner-service business, production, accessibility-device, performance or native-runtime acceptance.
