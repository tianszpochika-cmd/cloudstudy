# MB004 existing adult birth-year behavior test refresh

Only apps/mobile/tests/adult-birth-year-submit.test.mjs was changed in this follow-up. Original, root related-before FAIL and isolated first-run FAIL are preserved. No application source/shared/Git changes.

Original FAIL: expired :max="birthYearMax" rendering snapshot, before the IAM minor path ran. Removed old decorative and hardcoded-copy matches.

The test executes the real current page script and real Vue ref/computed/watch, real birth-year domain, real resume domain and pointer-feedback helper. It initializes the real onShow callback with an isolated authenticated owner and restricted adult resume; dependency ports simulate only IAM, store IO, navigation and lifecycle registration. It does not replace next or validation.

Final behavior: 2016 remains a string draft; unchecked confirmation sends nothing; explicit real checkbox/change path enables one numeric year 2016 IAM call. IAM reports REJECTED. Only /pages/forbidden/forbidden opens, no target save or additional resume read occurs, step does not advance, year is not rewritten.

Integer, 1900 lower boundary, explicit maxYear and future/fraction/string/non-number rejection remain verified.

Final: 2 pass, 0 fail, 0 skipped. This is isolated current-component/domain behavior, not browser, physical input or real IAM business acceptance.

Raw SHA-256 values are in adult-before-manifest.json and adult-after-manifest.json. Candidate source drift:
C:\Users\Administrator\Desktop\my\cloudstudy\apps\mobile\src\pages\onboarding\onboarding.vue
