# MB004 shared module regression (two existing test files only)

Scope: only mobile-gateway-auth-bootstrap.test.mjs and onboarding-resume-step.test.mjs were edited. No application/shared source, Git, browser, service or Root专项 test changes.

Originals and first-run.txt are preserved. First run: 19 tests, 3 pass, 16 fail, 0 skipped. Failures expose the old /iam/permissions route, PASSED fixtures without explicit learningAccess, and expired page lexical snapshots.

Updated positive fixtures use B8PrincipalResponse fields and a B8 adultGate object with PASSED + ELIGIBLE. Subject fixtures use distinct synthetic UUIDs. Token origin/header, verified owner, delayed A response after B login, IAM cookie refresh, revocation and cache identity assertions are preserved.

Repeated principal reads select the newest uncompleted request. Completing a request twice is rejected. Positive session readiness is explicitly asserted.

Added module/domain behavior: missing adult access, RESTRICTED, legacy PASSED string and IAM 503 do not request learner targets; a saved target cannot advance without explicit adult eligibility.

Removed expired page rendering-loop/metadata and hardcoded Chinese-copy snapshots. Business source boundaries and canonical goal/prefill domain behavior remain checked.

Final run: 24 tests, 24 pass, 0 fail, 0 skipped. This is isolated module regression evidence, not browser/native/real IAM business acceptance.

Source and test SHA-256 values are recorded in before-manifest.json and after-manifest.json.

Candidate application source changed during this review: C:\Users\Administrator\Desktop\my\cloudstudy\apps\mobile\src\pages\onboarding\onboarding.vue

Current candidate follow-up: Root changed onboarding.vue during the review (7e1feb659... to 25484f4f...). Same two files reran: 24 pass, 0 fail, 0 skipped. Before/after SHA-256 values in current-candidate-manifest.json; files changed during this follow-up run:
none
