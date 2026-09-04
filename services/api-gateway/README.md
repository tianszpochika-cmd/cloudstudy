# api-gateway

`api-gateway` is the v2 Platform 0 external entry point. It targets Java 25 LTS, Spring Boot 4.1.1 and the Spring Cloud 2025.1.3 Oakwood release train.

## Current candidate runtime boundary

- Public API paths are versioned under `/api/v1`. Unsupported `/api/*` versions and `/internal/*` paths are rejected at the edge.
- Runtime routes are generated only from the finite `routeExecutions` projection in the canonical Gateway contract. Unknown paths, controller-less operations and every `/internal/*` path fail closed; there is no broad proxy or `core-api` fallback. `/api/v1/health` is handled locally by the Gateway.
- The Gateway has no controller, repository, ORM entity, migration, domain command or domain write model. It does not own learner, content, order, permission or audit facts.
- `X-Request-Id`, `X-Trace-Id` and W3C `traceparent` input are bounded and sanitized before propagation. The client trace parent is not forwarded as trusted context; public responses normalize the correlation headers to one value even when an owner echoes them, and `401` responses include `WWW-Authenticate: Bearer`.
- CORS is allow-list based and credential-safe, and is registered both at the WebFlux edge and the Spring Security chain so preflight is handled before authentication. Rate limiting is a real fixed-window global filter when enabled: the bounded memory backend is for one-process local smoke and is not a production distributed limiter, while the Redis/Lua backend is the multi-instance option. It fails closed by default when the selected backend is unavailable. The default security chain denies every non-public request when the verifier is unavailable.
- The IAM boundary at `http://127.0.0.1:18087` exposes the direct account-password login, refresh, logout, revoke, password-reset, principal and JWKS routes under `/api/v1/auth/**` and `/api/v1/iam/**`. The Gateway never implements an account store or token signer; it forwards authentication requests to IAM and independently validates every protected JWT.
- When `GATEWAY_RESOURCE_SERVER_ENABLED=true`, Spring Security Resource Server uses the explicitly configured IAM JWKS URI, verifies RS256 signatures, issuer, `yuxuexing-api` audience, time window, `token_type=access`, and scope/permission claims. Missing, malformed, expired, wrong-issuer, wrong-audience or wrong-algorithm tokens are `401`; an authenticated request rejected by policy is `403`.
- When the Resource Server is disabled or misconfigured, protected routes fail closed: they cannot be authorized by a Bearer-header presence check. The direct login/refresh/password-reset and JWKS entrypoints remain reachable without an access token; health and the configured public catalog are the normal anonymous API reads. The bounded audit sink is a test/local placeholder and does not replace durable audit-service evidence.
- Client-supplied role, permission, subject, tenant, owner and forwarded-identity headers are stripped before any route. Tenant/owner/role facts are never synthesized by the Gateway; they must come from the independently verified token, IAM and the owning service's PEP/resource facts.
- Domain target groups are disabled in the default profile and require an explicit deployment/integration opt-in after the corresponding service-side PEP is accepted. Even when enabled, only `TARGET` plus an exact reviewed controller projection is executable; `SHADOW`, `LEGACY` and `FALLBACK` do not fall through to `core-api`. The three external payment callbacks remain explicitly unavailable until commerce owns a verified provider-signature boundary instead of the current workload-only controller.
- `/actuator/health` and Boot readiness probes are enabled. `API_GATEWAY_PORT` defaults to the registered fixed port `18070`; deployments may override it explicitly, but the service never auto-increments or silently selects another port. Upstream connect/response budgets default to 1s/5s and are mapped to the same error envelope as route failures.

## Security phase boundary

B7 supplied the JWT pre-validation seam. The current boundary is the self-owned IAM signer plus explicit JWKS verification. An access-token header alone is never an authentication success path. Gateway validation still cannot replace service-side PEP checks, and production completion still requires runtime evidence for key management, rotation, revocation, persistence and cross-service authorization.

For isolated local smoke tests, start with `SPRING_PROFILES_ACTIVE=local`; that profile explicitly enables candidate owner targets and the one-process memory limiter. Do not use it as a production deployment profile or as distributed-runtime Evidence.

## P1R rebaseline status

P1R-M1-004 freezes the target Gateway D2 policy in `packages/contracts/fragments/p1r-gateway-boundary.openapi.json` and checks it against every active public operation. That contract is authoritative for route ownership, origin/credential profiles, Web Cookie CSRF source checks, native transport, JWT precheck, route-class rate limiting, canonical failures, correlation, redacted audit and direct-connect deny semantics.

The current Java code is still an `IN_PROGRESS` M2 candidate, not accepted runtime Evidence. Exact Origin/Referer CSRF checks, the finite anonymous-path set, Redis/Lua rate limiting (enabled by default), canonical 401/403/429/503 errors, JWT/JWKS validation and redacted boundary audit recording are implemented and covered by process-level tests. Acceptance still requires current cross-process Redis/JWKS/browser evidence plus the downstream durable-audit and network-isolation Evidence assigned by the platform dependency plan; the bounded in-memory sink and edge rejection of `/internal` cannot substitute for either one.

## Local validation

The Gateway is built with Java 25 and Maven. Run:

```powershell
mvn -o -DskipTests validate
mvn -o test
```

If dependencies are not cached, use the same commands without `-o` in an approved build environment. Do not change the Boot/Cloud versions or fall back to the Java 17 `core-api`.
