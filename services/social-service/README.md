# social-service

`social-service` is the standalone Java 25 / Spring Boot 4.1.1 B12-SOC-002 boundary. It owns
study-room membership, seat leases, presence/focus state, privacy redaction, controlled preset
interactions, leaderboard projections, reports and moderation transitions.

## Boundary

- HTTP identity is a verified IAM `SocialPrincipal`. `userId`, `subjectId`, `tenantId`, `ownerId`,
  `role`, `permission`, `score`, `minutes`, `rank` and similar fields in client headers/bodies are
  rejected; the service derives subject/tenant/owner from authentication and service-owned room
  facts.
- Phase 1 exposes no free-text social payload, private chat, open posting, attachments, URLs or
  arbitrary interaction payloads. Interactions are limited to `CHEER_UP`, `STUDY_TOGETHER`,
  `CONGRATS`, `TRY_AGAIN` and `TONIGHT_20_MIN`.
- Seat renewal is a lease operation only. Ping/renew does not update learning activity. Trusted
  learning activity can update `lastActivityAt`; disconnect has a 60-second recovery window and
  idle/lease expiry releases the seat and auto-releases focus.
- Focus state is server-clocked, but focus commands never increment a leaderboard. Leaderboards
  are projections of authenticated `learning-service` or `gamification-service` events only;
  `learning.focus.qualified.v1`, `learning.mastery.reached.v1` and
  `gamification.xp.ledger_posted.v1` are allowlisted inputs. This service never writes a
  gamification ledger.
- Current runtime storage is a deterministic in-memory adapter for the standalone smoke runtime;
  `src/main/resources/db/migration/V1__create_social_service_schema.sql` is the service-owned
  Flyway schema boundary for the durable adapter.

## HTTP surface

Member endpoints are under `/api/v1/social`:

- `GET /rooms`, `GET /rooms/{roomId}` (the snapshot requires active membership)
- `POST /rooms/{roomId}/join`, `/leave`, `/disconnect`, `/recover`, `/lease/renew`
- `POST /rooms/{roomId}/focus`, `PATCH /focus-sessions/{focusId}`
- `POST /rooms/{roomId}/interactions`
- `GET /leaderboards?kind=FOCUS_MINUTES|MASTERED_WORDS|XP&period=DAY|WEEK`
- `PATCH /me/visibility`
- `POST /rooms/{roomId}/reports`, `GET /reports/{reportId}`

Trusted/internal endpoints are intentionally separate:

- `POST /internal/v1/social/trusted-events`
- `POST /internal/v1/social/moderation/reports/{reportId}/decision`

All writes require `Idempotency-Key`; trusted events use `eventId` dedupe. Responses use
`{requestId,data,meta}` and errors use `{requestId,error:{code,message,retryable}}`. Authentication
and authorization failures are not converted to empty lists: 401 means no verified principal,
403 means a verified principal lacks the required tenant/owner/permission/resource access, 404
means the resource does not exist, and 409 means a valid request conflicts with room/lease/state
or idempotency facts.

## State machines

```text
seat:  AVAILABLE -> OCCUPIED -> DISCONNECTED -> OCCUPIED (within 60s)
                     |              |
                     +--------------+-----------> AVAILABLE (leave/expiry/idle)

focus: RUNNING <-> PAUSED -> COMPLETED
        |
        +------------------> AUTO_RELEASED / INVALID

report: RECEIVED -> TRIAGED -> IN_REVIEW -> ACTIONED / REJECTED -> CLOSED
```

Leaderboard responses deliberately expose `projectionState`, `dataFreshness`, `delayed`,
`asOf` and `sourceWatermark`; a missing or stale projection is delayed/provisional rather than a
fabricated zero.

## Run and verify

The service uses the repository's fixed local service shape and defaults to `127.0.0.1:18095` in
this module; root port registration is intentionally not changed by this task.

```powershell
$env:SOCIAL_RESOURCE_SERVER_ENABLED = "false"
& "$env:JAVA_HOME\bin\java.exe" -version   # Java 25 required by the POM
mvn -f services/social-service/pom.xml test
mvn -f services/social-service/pom.xml spring-boot:run
```

With the resource server disabled, `/health` and `/actuator/health` are public and every social
route fails closed. Production must enable the verified OIDC/JWKS resource server; no local token
or client-header authentication path is provided.
