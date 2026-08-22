# api-gateway

`api-gateway` is the v2 Platform 0 external entry point. It targets Java 25 LTS, Spring Boot 4.1.1 and the Spring Cloud 2025.1.3 Oakwood release train.

## Implemented boundary

- Public API paths are versioned under `/api/v1`. Unsupported `/api/*` versions and `/internal/*` paths are rejected at the edge.
- Only explicit compatibility routes reach the old `core-api`: `/api/v1/health` and `/api/v1/legacy/**`. Both routes are GET/HEAD-only; the legacy path is rewritten to the old `/api/v1/**` shape and marked with a compatibility header. Anonymous legacy reads are denied by default and can only be enabled in the explicit `local` profile.
- The Gateway has no controller, repository, ORM entity, migration, domain command or domain write model. It does not own learner, content, order, permission or audit facts.
- `X-Request-Id`, `X-Trace-Id` and W3C `traceparent` input are bounded and sanitized before propagation. A response always exposes the generated correlation headers.
- CORS is allow-list based and credential-safe. Rate limiting is an explicitly disabled-by-default local placeholder; it is not a production distributed limiter. The default security chain denies every non-health request; B8 replaces the local read-only exception with verified OIDC/JWKS and service-side PEP checks.
- B8 adds the provider-neutral IAM boundary at http://127.0.0.1:18087: canonical /api/v1/iam/** and /api/v1/auth/oidc/** requests route to IAM, while /api/v1/auth/refresh, logout and session revoke are explicit compatibility rewrites. Client-supplied role/tenant/owner headers are removed before forwarding. The IAM route is a code seam only until ADR-0011/G-IDP is approved; it is not a self-hosted token server.
- B8 adds conditional Spring Security Resource Server/JWKS validation, bounded edge security audit records and distinct 401/403 mapping. GATEWAY_RESOURCE_SERVER_ENABLED remains false until G-IDP; the bounded sink is a test/local placeholder and does not replace durable audit-service evidence.
- B14 adds the Phase 1 strangler matrix for learner/content/learning/assessment/media/gamification/social/commerce. Each domain has an explicit `TARGET`, `SHADOW`, `LEGACY` or `FALLBACK` route mode, target base URL, and a configurable deprecation sunset. `TARGET`/`SHADOW` routes go to the target service; `LEGACY`/`FALLBACK` expose only GET/HEAD compatibility reads and the global guard returns `503` for writes, so core-api never becomes a new cross-domain write owner. Target routes are internal service routes with forged authority/tenant headers removed; compatibility emits `Deprecation`/`Sunset` when enabled. Route mode is configuration-only and never accepts client tenant, owner or role facts.
- `/actuator/health` and Boot readiness probes are enabled. `GATEWAY_PORT` is required so the service reads a registered fixed port and never auto-increments or silently falls back to a conflicting port.

## Security phase boundary

B7 supplied the JWT pre-validation seam. B8 supplies the conditional Spring Security Resource Server OIDC/JWKS path, but it remains disabled until the `G-IDP` gate; the old presence-only filter is never an authentication success path. Gateway validation still cannot replace service-side PEP checks, and the repository cannot claim IAM/RBAC production completion from this skeleton alone.

For local read-only compatibility smoke tests, start with `SPRING_PROFILES_ACTIVE=local`. Do not use that profile as a production deployment profile.

## Local validation

The repository currently has Java 24 and no Maven executable in the local shell. The build therefore needs a Java 25 + Maven environment. The intended commands are:

```powershell
mvn -o -DskipTests validate
mvn -o test
```

If dependencies are not cached, use the same commands without `-o` in an approved build environment. Do not change the Boot/Cloud versions or fall back to the Java 17 `core-api`.
