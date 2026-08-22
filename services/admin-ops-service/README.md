# admin-ops-service

B13-ADM-003 / B13-SUP-005 的独立 Java 25 + Spring Boot 4.1.x 风格服务边界。

## Ownership and boundaries

- Owns admin command orchestration metadata, approval/confirmation decisions, support-ticket metadata, SLA state and audit association.
- Reads domain-owned facts through `AdminProjectionPort`; it never copies or writes commerce/content/learner tables.
- Forwards typed `DomainCommand` through `DomainCommandPort`; production wiring must use an outbox/workflow adapter, not a cross-service SQL write.
- Support requests accept only allowlisted codes, SHA-256 description fingerprints and `MediaObjectRef` metadata. Raw text, file bytes, URLs and filenames are rejected.
- Media attachment readability is delegated through `MediaObjectAuthorizationPort`; media ownership and tenant facts are not copied into this service.
- Each attachment is checked through `MediaObjectAuthorizationPort`; media ownership and tenant visibility stay in media-service.
- Principal, tenant and owner scope are derived from a verified IAM JWT. Client role, tenant, owner and user headers are rejected.

## Safety behavior

- Service-side default-deny PEP with tenant isolation and redacted projection/ticket views.
- Content approval sequence is first review -> final review -> publish; the author cannot review or publish their own content and first/final reviewers must be different principals.
- High-risk commands use a single-use, actor/tenant/action/resource-bound second-confirmation challenge.
- Commands and support transitions are idempotent and linked to an append-only, hash-chained audit record.

## Local verification

The dependency-free smoke entry point is `tests/smoke/AdminOpsServiceSmoke.java`; it covers tenant/permission denial, author/operator separation, approval ordering, confirmation binding, command idempotency, support redaction, media-reference-only attachments, SLA state and immutable audit snapshots.

Local Spring wiring uses in-memory adapters deliberately. Replacing them with service-owned projection, idempotency, audit and outbox/workflow adapters is required before production deployment; OIDC/JWKS is fail-closed when not configured.

The service defaults to `127.0.0.1:18096`; OIDC resource-server mode is disabled by default and business routes remain fail-closed until issuer and JWKS settings are supplied. The `/health` probe is intentionally public and contains no tenant or identity data.

JDK 25 + Maven verification:

```text
mvn -f services/admin-ops-service/pom.xml test
```

The pure Java smoke can run without Spring, a database or a network by compiling the domain sources plus `tests/smoke/AdminOpsServiceSmoke.java` and invoking `com.englishflow.adminops.smoke.AdminOpsServiceSmoke`.

Real Gateway/OIDC, durable persistence, Kafka/Outbox, workflow/Saga, cross-service HTTP/gRPC and admin-web integration remain runtime gates outside this directory-only code task.
