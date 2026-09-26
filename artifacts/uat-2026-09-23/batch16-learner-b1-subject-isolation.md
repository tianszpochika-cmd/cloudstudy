# Batch 16 — Learner Web B1 account state isolation

## Finding

`apps/learner-web/src/stores/b1.ts` restored one unowned browser snapshot for every account. An A-account onboarding draft, assessment answers, profile/home state, and continue checkpoint could remain in the live Pinia store after logout or A→B login. A null or failed learning-owner continue-context read kept the old checkpoint.

## Change

- B1 local snapshots now carry the IAM-verified `principal.subject`; missing or mismatched owner snapshots are discarded. Logout/session clear removes the persisted snapshot and the live store resets on identity change.
- The auth store now requires a verified principal after login, register, restore, and refresh. Its refresh path supports the actual IAM token response without `userId`, then rejects a principal that differs from the previous verified subject.
- In the real runtime, continue context is not restored from local storage or synthesized as a completed onboarding checkpoint. Null/error owner reads clear it, and a failed owner write cannot be presented as saved. Identity and request-version guards discard late responses after account changes or newer checkpoint operations.
- Existing unowned B1 drafts are intentionally discarded on the next verified restore because their account ownership cannot be established.

## Verification

- `node --test apps/learner-web/tests/b1-subject-isolation.test.mjs`: **8/8 passed**. Covers A→B, logout, same-account refresh/reload, browser reload into another account, refresh subject mismatch, owner null/503, late A response, and failed checkpoint write.
- `pnpm --filter @englishflow/learner-web build`: **passed**, including `vue-tsc`; Vite reported existing mixed static/dynamic import chunk notices.
- `git diff --check -- apps/learner-web/src/stores/b1.ts apps/learner-web/src/stores/session.ts apps/learner-web/tests/b1-subject-isolation.test.mjs`: **passed**.
- Additional `c02-learner-profile.test.mjs` + `experience-regressions.test.mjs`: **4/5 passed**. The C02 settings source assertion still expects the former literal “昵称与发音偏好暂不可修改。” while the current dirty `SettingsPage.vue` uses `et('settingsNicknameUnavailable')`; this is an existing test/UI text drift unrelated to B1 account isolation. The other four checks passed.

## Boundary

This is source and test evidence. It has not yet been rebuilt into the isolated Docker environment or verified with two real authenticated browser sessions. Other learner-web stores maintain their own local snapshots and need separate account-isolation review.
