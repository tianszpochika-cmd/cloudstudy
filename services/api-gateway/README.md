# api-gateway

`api-gateway` is the v2 Platform 0 external entry point. It targets Java 25 LTS, Spring Boot 4.1.1 and the Spring Cloud 2025.1.3 Oakwood release train.

## Implemented boundary

- Public API paths are versioned under `/api/v1`. Unsupported `/api/*` versions and `/internal/*` paths are rejected at the edge.
- Only explicit compatibility routes reach the old `core-api`: `/api/v1/health` and `/api/v1/legacy/**`. Both routes are GET/HEAD-only; the legacy path is rewritten to the old `/api/v1/**` shape and marked with a compatibility header. Anonymous legacy reads are denied by default and can only be enabled in the explicit `local` profile.
- The Gateway has no controller, repository, ORM entity, migration, domain command or domain write model. It does not own learner, content, order, permission or audit facts.
- `X-Request-Id`, `X-Trace-Id` and W3C `traceparent` input are bounded and sanitized before propagation. The client trace parent is not forwarded as trusted context; responses and route errors expose the generated correlation headers, and `401` responses include `WWW-Authenticate: Bearer`.
- CORS is allow-list based and credential-safe, and is registered both at the WebFlux edge and the Spring Security chain so preflight is handled before authentication. Rate limiting is a real fixed-window global filter when enabled: the bounded memory backend is for one-process local smoke and is not a production distributed limiter, while the Redis/Lua backend is the multi-instance option. It fails closed by default when the selected backend is unavailable. The default security chain denies every non-public request when the verifier is unavailable.
- The IAM boundary at `http://127.0.0.1:18087` exposes only explicit Gateway routes: OIDC authorization start (`GET`), callback (`POST`), metadata/JWKS reads, canonical `/api/v1/iam/**`, and compatibility refresh/logout/session-revoke rewrites. The Gateway never implements an OAuth/OIDC token server and never exchanges a client-supplied code or token itself.
- When `GATEWAY_RESOURCE_SERVER_ENABLED=true`, Spring Security Resource Server discovers the configured OIDC issuer, verifies access-token signatures through its JWKS decoder (including key rotation refresh), and requires both the configured issuer and `OIDC_AUDIENCE`. Missing, malformed, expired, wrong-issuer or wrong-audience tokens are `401`; an authenticated request rejected by policy is `403`.
- When the Resource Server is disabled or misconfigured, protected routes fail closed: they cannot be authorized by a Bearer-header presence check. The explicit OIDC start/callback and refresh entrypoints remain reachable without an access token; health and the configured public catalog are the normal anonymous API reads. Only the explicit `local` compatibility profile may additionally expose read-only legacy GET/HEAD routes. The bounded audit sink is a test/local placeholder and does not replace durable audit-service evidence.
- Client-supplied role, permission, subject, tenant, owner and forwarded-identity headers are stripped before any route. Tenant/owner/role facts are never synthesized by the Gateway; they must come from the independently verified token, IAM and the owning service's PEP/resource facts.
- B14 adds the Phase 1 strangler matrix for learner/content/learning/assessment/media/gamification/social/commerce. Each domain has an explicit `TARGET`, `SHADOW`, `LEGACY` or `FALLBACK` route mode, target base URL, and a configurable deprecation sunset. `TARGET`/`SHADOW` routes go to the target service; `LEGACY`/`FALLBACK` expose only GET/HEAD compatibility reads and the global guard returns `503` for writes, so core-api never becomes a new cross-domain write owner. Target routes are internal service routes with forged authority/tenant headers removed; compatibility emits `Deprecation`/`Sunset` when enabled. Route mode is configuration-only and never accepts client tenant, owner or role facts.
- `/actuator/health` and Boot readiness probes are enabled. `API_GATEWAY_PORT` defaults to the registered fixed port `18070`; deployments may override it explicitly, but the service never auto-increments or silently selects another port. Upstream connect/response budgets default to 1s/5s and are mapped to the same error envelope as route failures.

## Security phase boundary

B7 supplied the JWT pre-validation seam. B23 makes the real Resource Server path issuer/audience-bound and fail-closed when it is not enabled. An access-token header alone is never an authentication success path. Gateway validation still cannot replace service-side PEP checks, and the repository cannot claim IAM/RBAC production completion until the external IdP/G-IDP runtime evidence exists.

For local read-only compatibility smoke tests, start with `SPRING_PROFILES_ACTIVE=local`. Do not use that profile as a production deployment profile.

## Local validation

The Gateway is built with Java 25 and Maven. Run:

```powershell
mvn -o -DskipTests validate
mvn -o test
```

If dependencies are not cached, use the same commands without `-o` in an approved build environment. Do not change the Boot/Cloud versions or fall back to the Java 17 `core-api`.
