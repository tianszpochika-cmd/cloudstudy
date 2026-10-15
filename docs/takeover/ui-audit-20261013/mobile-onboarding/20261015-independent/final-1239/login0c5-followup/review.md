# MB001 title lifecycle narrow independent receipt

**UI_PASS for the title lifecycle correction only**, login raw SHA256 `0c5fb5cd346d9e86271eaf65638cf2ffabbc9b466fb3d6cd1079e4fbc9a55460`. This does not re-sign every login requirement or a real authentication backend.

The old onShow title call failed during401/identity teardown reLaunch to login. `../revision-c4c-24a/title-run2/title-origin-results.json` records the actual rejected title `登录`, login served-source callsite and `setNavigationBarTitle:fail page not found`. The correction moves that unchanged title update to onReady, without changing page layout, credentials, authentication policy or adding a global rejection waiver.

- `restoring-results.json`: three actual onShow refresh200/401/logout-late200 cases pass with no pageerror, without wrapping the title API or suppressing errors.
- `title-results.json`: eight actual `cases` pass. Both Chinese and English have the correct title on first load, actual registration return, cached history return and restricted onboarding logout reLaunch; there is no overlay or pageerror.
- `auth3-helper24a/results.json`: 15 real-pointer/busy/error-recovery checks pass across login/register/reset against current login0c5, shared helper24a, sessiond944 and copy7b21. Login itself does not consume the shared pointer helper. Other auth page sources remain9258cb03 andc9a6da86.
- `gate-keyboard-results.json`: three current MB004 input-focus/primary-keyboard cases pass, as affected companion evidence rather than additional login completion claims.

All nine relevant raw hashes match `product-freeze.json`; the full final signature is in the parent `final-signature.json`. Prior failures remain intact. APIs were intercepted with synthetic fixtures only; no real credential, request body/header, cookie/storage or token value was inspected. Native and real-backend acceptance are NOT_RUN. No product source, shared source, main document or Git was changed by this reviewer.
