/* eslint-disable */
// GENERATED FILE. Source: packages/contracts/openapi/v1/openapi.json
// Run node scripts/contracts/generate-contracts.mjs after changing the source.

/**
 * MySQL BIGINT UNSIGNED 在 REST JSON 中的 canonical 表示。字段名决定领域含义，数值必须为正整数。
 */
export type CanonicalInt64Id = number;

/**
 * 跨服务请求关联 ID；客户端可生成，服务端可替换，但响应必须回传最终值。
 */
export type RequestId = string;

/**
 * Generated from the contract source.
 */
export type TraceId = string;

/**
 * Generated from the contract source.
 */
export type Traceparent = string;

/**
 * 事件唯一 ID。推荐 ULID；消费端按 eventId 去重。
 */
export type EventId = string;

/**
 * 离线或客户端产生事件的幂等 ID。
 */
export type ClientEventId = string;

/**
 * 事件总线上的不透明聚合 ID，可承载十进制 BIGINT、UUID 或 ULID；不能用来替代 payload 内的领域 ID 字段。
 */
export type AggregateId = string;

/**
 * 触发事件的用户、服务或 system 标识。原始手机号、第三方 subject 和 Token 禁止写入。
 */
export type ActorId = string;

/**
 * 不可逆设备公开标识；不等同于设备指纹。
 */
export type DeviceId = string;

/**
 * 学习、认证或考试会话的不可变 ID；优先 UUID/ULID，不与数据库自增主键混用。
 */
export type SessionId = string;

/**
 * 同一用户/设备/路由作用域内唯一的写请求幂等键；服务端持久化 request body hash 和首次结果。
 */
export type IdempotencyKey = string;

/**
 * Generated from the contract source.
 */
export type Cursor = string;

/**
 * Generated from the contract source.
 */
export type PageSize = number;

/**
 * 接口使用 RFC 3339 date-time；数据库统一 UTC DATETIME(3)，客户端按用户时区显示。
 */
export type DateTime = string;

/**
 * Generated from the contract source.
 */
export type ApiVersion = "v1";

/**
 * Generated from the contract source.
 */
export type SemanticVersion = string;

/**
 * Generated from the contract source.
 */
export type ApiMeta = { apiVersion: ApiVersion; schemaVersion: SemanticVersion; serverTime: DateTime; traceId: TraceId; };

/**
 * Generated from the contract source.
 */
export type PageMeta = { nextCursor?: Cursor | null; hasMore: boolean; pageSize: PageSize; };

/**
 * Generated from the contract source.
 */
export type ErrorCode = "VALIDATION_ERROR" | "AUTH_REQUIRED" | "AUTH_INVALID_REFRESH_TOKEN" | "AUTH_REFRESH_TOKEN_EXPIRED" | "AUTH_REFRESH_TOKEN_REVOKED" | "AUTH_REFRESH_REUSE_DETECTED" | "AUTH_DEVICE_MISMATCH" | "AUTH_IDENTITY_BOUND_OTHER" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "IDEMPOTENCY_REQUIRED" | "IDEMPOTENCY_CONFLICT" | "IDEMPOTENCY_KEY_REUSED" | "VERSION_CONFLICT" | "CONTENT_NOT_PUBLISHED" | "SYNC_CONFLICT" | "EVENT_EXPIRED" | "RATE_LIMITED" | "FEATURE_DISABLED" | "SERVICE_UNAVAILABLE" | "INTERNAL_ERROR";

/**
 * Generated from the contract source.
 */
export type ErrorDetailValue = string | number | boolean | ReadonlyArray<string> | { [key: string]: unknown; };

/**
 * 仅放可安全展示的结构化字段；不得放 Token、原始答案、音频、支付回调或第三方身份原文。
 */
export type ErrorDetails = { [key: string]: ErrorDetailValue; };

/**
 * Generated from the contract source.
 */
export type ApiError = { errorCode: ErrorCode; message: string; retryable: boolean; details?: ErrorDetails; };

/**
 * Generated from the contract source.
 */
export type ApiErrorResponse = { requestId: RequestId; traceId: TraceId; error: ApiError; };

/**
 * Generated from the contract source.
 */
export type HealthStatus = "UP" | "DEGRADED" | "DOWN";

/**
 * Generated from the contract source.
 */
export type HealthDependency = { name: string; status: HealthStatus; latencyMs?: number | null; errorCode?: ErrorCode | null; };

/**
 * Generated from the contract source.
 */
export type HealthData = { status: HealthStatus; service: "core-api"; version: SemanticVersion; build: string; dependencies: ReadonlyArray<HealthDependency>; };

/**
 * Generated from the contract source.
 */
export type HealthResponse = { requestId: RequestId; data: HealthData; meta: ApiMeta; };

/**
 * Generated from the contract source.
 */
export type AuthRefreshRequest = { refreshToken: string; deviceId: DeviceId; };

/**
 * Generated from the contract source.
 */
export type TokenType = "Bearer";

/**
 * Generated from the contract source.
 */
export type AuthTokenPair = { accessToken: string; refreshToken: string; tokenType: TokenType; accessTokenExpiresAt: DateTime; refreshTokenExpiresAt: DateTime; userId: CanonicalInt64Id; deviceId: DeviceId; sessionId: SessionId; };

/**
 * Generated from the contract source.
 */
export type AuthRefreshResponse = { requestId: RequestId; data: AuthTokenPair; meta: ApiMeta; };

/**
 * Generated from the contract source.
 */
export type LanguageCode = "EN";

/**
 * Generated from the contract source.
 */
export type UserRole = "LEARNER" | "CONTENT_EDITOR" | "REVIEWER" | "FINANCE" | "RISK" | "OPERATOR" | "ADMIN";

/**
 * Generated from the contract source.
 */
export type UserStatus = "ACTIVE" | "LOCKED" | "DELETION_PENDING" | "DELETED";

/**
 * Generated from the contract source.
 */
export type ContentStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED";

/**
 * Generated from the contract source.
 */
export type ContentAvailabilityStatus = "ONLINE" | "OFFLINE" | "REVOKED" | "EXPIRED";

/**
 * Generated from the contract source.
 */
export type MasteryStatus = "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED";

/**
 * Generated from the contract source.
 */
export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

/**
 * Generated from the contract source.
 */
export type ItemType = "VOCAB" | "PHRASE" | "EXPRESSION" | "GRAMMAR" | "SENTENCE" | "LISTENING" | "READING" | "WRITING" | "EXERCISE";

/**
 * Generated from the contract source.
 */
export type SyncStatus = "PENDING" | "ACCEPTED" | "CONFLICT" | "REJECTED" | "EXPIRED";

/**
 * Generated from the contract source.
 */
export type NotificationCategory = "LEARNING" | "REMINDER" | "SECURITY" | "TRANSACTION" | "SYSTEM";

/**
 * Generated from the contract source.
 */
export type EntitlementStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED" | "FROZEN";

/**
 * Generated from the contract source.
 */
export type PerformanceTier = "ULTRA" | "HIGH" | "MEDIUM" | "PERFORMANCE";

/**
 * Generated from the contract source.
 */
export type SessionStatus = "ACTIVE" | "REVOKED" | "KICKED" | "EXPIRED";

export interface CanonicalIdRegistry {
  userId: CanonicalInt64Id;
  contentVersionId: CanonicalInt64Id;
  vocabId: CanonicalInt64Id;
  expressionId: CanonicalInt64Id;
  grammarPointId: CanonicalInt64Id;
  sentenceId: CanonicalInt64Id;
  questionId: CanonicalInt64Id;
  exerciseId: CanonicalInt64Id;
  attemptId: CanonicalInt64Id;
  sessionId: SessionId;
  requestId: RequestId;
  traceId: TraceId;
  eventId: EventId;
  aggregateId: AggregateId;
  actorId: ActorId;
}

export interface ApiOperationRegistry {
  getHealth: { method: "GET"; path: "/api/v1/health"; request: never; response: HealthResponse; idempotent: false };
  refreshAuthSession: { method: "POST"; path: "/api/v1/auth/refresh"; request: AuthRefreshRequest; response: AuthRefreshResponse; idempotent: true };
}

export type ApiOperationId = keyof ApiOperationRegistry;
