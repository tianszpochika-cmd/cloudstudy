# P1R-M2-001 Gateway runtime batch

This directory is a test-only, no-dependency runtime harness for the M2-001 Gateway boundary. It does not replace the canonical OpenAPI, the contract tests, or durable `audit-service` evidence. Nothing here verifies M2-006 durable audit or M2-008 NetworkPolicy.

## Safety and scope

- The full runner binds only `127.0.0.1:18087` (IAM) and `127.0.0.1:18070` (Gateway), and connects only to the registered Redis endpoint `127.0.0.1:16379`, database 15.
- `--run` refuses dirty Gateway/IAM inputs, stale jars, busy fixed ports, non-Java-25 execution, or a pre-existing Gateway-health rate key. It never deletes that key and never runs a Redis flush.
- IAM is a real Java process with the explicit `local` profile, an ephemeral signing key, and in-memory test state. The Gateway is a distinct real Java process with Redis rate limiting and the explicit `m2-evidence` profile. This batch is not MySQL/IAM durability evidence.
- Generated account credentials, refresh cookies, JWTs, and signing material stay in process memory. Child logs are drained but not forwarded. Only the closed redacted audit projection and bounded result schema reach harness output.
- The two-Gateway check is deliberately sequential: process A leaves a DB15 fixed-window counter, then process B on the same registered port continues it and returns 429. It proves cross-process Redis state continuation, not simultaneous replica concurrency.
- Browser files are fixtures only. They remain `NOT_RUNTIME_VERIFIED` until an operator or an external browser runner captures the assertions below.

## Node checks

Run the non-networked safety/schema suite from the repository root:

```powershell
node --test services/api-gateway/src/test/runtime/p1r-m2-001-runtime.test.mjs
```

A read-only probe of already-running services performs only JWKS, unauthenticated 401, default-owner 404, correlation-header, and Redis connectivity checks. It explicitly lists all unverified claims:

```powershell
node services/api-gateway/src/test/runtime/p1r-m2-001-runtime.mjs --probe-only
```

After both service trees are committed and their current jars are built with Java 25, the ordinary full run is:

```powershell
node services/api-gateway/src/test/runtime/p1r-m2-001-runtime.mjs --run
```

`M2_JAVA_BIN`, `M2_GATEWAY_JAR`, and `M2_IAM_JAR` may identify Java 25 and jars inside each service's own `target` directory. The no-fault form returns `PARTIAL` and keeps HTTP 503/recovery unverified.

Redis failure injection is a separate explicit action. Supply one exact container name only after confirming that no other work depends on it:

```powershell
$env:M2_REDIS_FAULT_OPT_IN = 'PAUSE_EXACT_REDIS_16379_AND_RECOVER'
$env:M2_REDIS_CONTAINER = '<exact-container-name>'
node services/api-gateway/src/test/runtime/p1r-m2-001-runtime.mjs --run --fault
Remove-Item Env:M2_REDIS_FAULT_OPT_IN, Env:M2_REDIS_CONTAINER
```

The runner validates that the named, running, unpaused Redis image owns the exact `127.0.0.1:16379 -> 6379/tcp` mapping. It uses only pause/unpause, restores in `finally` and signal handlers, then waits for DB15 `PING`. It does not restart, stop, remove, or flush Redis.

## Browser fixture

Stop the corresponding frontend on its registered port, then serve exactly one origin profile. No new host port is introduced:

```powershell
node services/api-gateway/src/test/runtime/browser-fixture-server.mjs learner
```

Other choices are `admin`, `mobile`, `official`, and `unknown`. The `unknown` choice still binds `127.0.0.1:18182`, but instructs the browser to open `http://localhost:18182/`; do not run it alongside the official fixture.

Use a fresh browser profile and DevTools Network with “Preserve log” enabled. Do not copy response bodies, cookies, form values, or authorization values into evidence. Capture only method, path, status, CORS response-header names, correlation IDs, and the matching redacted Gateway audit row.

Expected assertions:

1. From learner `http://127.0.0.1:18180`, `Public JWKS` is visible with HTTP 200 and one exposed request ID plus one exposed trace ID.
2. From learner, enter a synthetic local identifier/password and select `Register`. Its preflight and POST succeed, POST is 201, and the refresh cookie is HttpOnly in the Network cookie metadata. The page clears both fields and never displays the response body or access material.
3. `Protected principal` returns 200 after registration. The request includes forged role/tenant/owner headers, while the independently inspected response shows the ordinary server-derived role and platform tenant. Redact the response before retaining this assertion.
4. `Cookie-authenticated unsafe refresh` returns 200 from learner. The browser supplies the exact learner Origin and same-origin Referer; the page does not read the HttpOnly cookie.
5. From official `http://127.0.0.1:18182`, JWKS is readable, while registration is browser-blocked and its Network preflight is denied. No business cookie or authorization value is sent or set.
6. From unknown `http://localhost:18182`, JWKS is browser-blocked because that literal Origin is not registered. Record the Network status and matching `cors_origin_forbidden` redacted audit row, not a response body.

Ordinary page JavaScript cannot forge `Origin` or reliably rewrite `Referer`. The remaining source-precedence cases require an external browser/CDP runner without adding a repository dependency:

- Establish a learner cookie, intercept only the refresh request, preserve browser Origin as `http://127.0.0.1:18180`, and replace Referer with an untrusted HTTPS origin. Assert HTTP 403 and audit reason `origin_referer_conflict`.
- Establish a learner cookie, remove Origin from the refresh request, and preserve the trusted learner Referer. Assert the unsafe refresh is accepted through the Referer fallback.
- Establish a learner cookie, remove Origin and replace Referer with an untrusted HTTPS origin. Assert HTTP 403 and audit reason `credentialed_referer_untrusted`.

Until those browser cases are executed against the current committed jars, report `BROWSER_CORS_CSRF_ORIGIN_REFERER = NOT_RUNTIME_VERIFIED`.
