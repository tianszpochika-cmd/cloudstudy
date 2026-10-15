# MB004 typed consent session-refresh module follow-up

Scope: existing gateway and resume test files only; only onboarding-resume-step.test.mjs needed a new named behavior case. No source/shared/Git or UI signing. First-run output preserved: 24 pass, 0 fail, 0 skipped; earlier first FAIL evidence remains intact.

The real learner-content API module preserves current IAM accepted=true and empty unsatisfied purposes when target GET returns 403 CONSENT_REQUIRED, reports sessionRefreshRequired=true and target.readable=false. Real resume domain stops at consent, including when a cached saved target exists; the flag does not authorize advancement. Existing gateway owner/token/epoch tests remain unchanged.

Final two-file run: 25 pass, 0 fail, 0 skipped. Raw hashes in consent-refresh-before-manifest.json and consent-refresh-after-manifest.json. Source drift:
none
