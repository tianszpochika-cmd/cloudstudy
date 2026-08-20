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

/**
 * Generated from the contract source.
 */
export type B1ContentStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED";

/**
 * Generated from the contract source.
 */
export type B1ContentType = "COURSE" | "COURSE_UNIT" | "VOCABULARY" | "PHRASE" | "GRAMMAR" | "SENTENCE" | "MEDIA" | "QUESTION";

/**
 * Generated from the contract source.
 */
export type B1ReviewStage = "FIRST_REVIEW" | "FINAL_REVIEW";

/**
 * Generated from the contract source.
 */
export type B1ReviewDecision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

/**
 * Generated from the contract source.
 */
export type B1LicenseStatus = "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED";

/**
 * Generated from the contract source.
 */
export type B1MediaKind = "AUDIO" | "IMAGE" | "VIDEO" | "MODEL_3D" | "SVG" | "WAVEFORM" | "OFFLINE_BUNDLE";

/**
 * Generated from the contract source.
 */
export type B1ContentSource = { sourceCode: string; sourceName: string; sourceKind: "INTERNAL" | "LICENSED" | "OPEN_LICENSE" | "PUBLIC_DOMAIN" | "USER_PROVIDED"; sourceLocator?: string; copyrightOwner?: string; isSynthetic: boolean; };

/**
 * Generated from the contract source.
 */
export type B1ContentLicense = { licenseCode: string; licenseName: string; licenseStatus: B1LicenseStatus; copyrightOwner: string; authorizationEvidenceRef?: string; licenseUrl?: string; permittedPlatforms?: ReadonlyArray<string>; allowsLearning: boolean; allowsOffline: boolean; attributionRequired?: boolean; startsAt?: string; expiresAt?: string; };

/**
 * Generated from the contract source.
 */
export type B1CreateContentRequest = { contentCode: string; contentType: B1ContentType; title: string; locale?: string; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; goalCode: string; parentContentId?: number; sortOrder?: number; payload: Record<string, never>; source: B1ContentSource; license: B1ContentLicense; actorId: string; };

/**
 * Generated from the contract source.
 */
export type B1CreateVersionRequest = { payload: Record<string, never>; source: B1ContentSource; license: B1ContentLicense; releaseNote?: string; rollbackOfVersionId?: number; actorId: string; };

/**
 * Generated from the contract source.
 */
export type B1ActorRequest = { actorId: string; requestId?: string; };

/**
 * Generated from the contract source.
 */
export type B1ActorReasonRequest = B1ActorRequest & { reasonCode?: string; };

/**
 * Generated from the contract source.
 */
export type B1ReviewDecisionRequest = { stage: B1ReviewStage; decision: B1ReviewDecision; reviewerId: string; reasonCode?: string; note?: string; };

/**
 * Generated from the contract source.
 */
export type B1ImportRequest = { batchCode: string; format: "CSV" | "JSON"; payload: string; dryRun?: boolean; actorId: string; };

/**
 * Generated from the contract source.
 */
export type B1ImportIssue = { rowNumber: number; code: string; message: string; normalizedKey?: string; };

/**
 * Generated from the contract source.
 */
export type B1ImportReport = { batchCode: string; format: "CSV" | "JSON"; acceptedCount: number; rejectedCount: number; duplicateCount: number; issues: ReadonlyArray<B1ImportIssue>; createdContentIds?: ReadonlyArray<number>; applied: boolean; };

/**
 * Generated from the contract source.
 */
export type B1ContentVersion = { contentVersionId: number; contentId: number; versionNumber: number; contentType: B1ContentType; status: B1ContentStatus; contentHash: string; sourceCode: string; licenseCode: string; editorId?: string; firstReviewerId?: string | null; finalReviewerId?: string | null; publisherId?: string | null; payload: Record<string, never>; publishedAt?: string | null; archivedAt?: string | null; createdAt: string; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B1LearnerContent = { contentId: number; contentVersionId: number; contentType: B1ContentType; status: "PUBLISHED"; payload: Record<string, never>; contentHash: string; cacheEpoch: number; };

/**
 * Generated from the contract source.
 */
export type B1ContentDiff = { contentId: number; fromVersionId: number; toVersionId: number; changes: ReadonlyArray<B1ContentDiffChange>; generatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B1ContentDiffChange = { path: string; changeType: "ADDED" | "REMOVED" | "CHANGED"; before?: unknown; after?: unknown; };

/**
 * Generated from the contract source.
 */
export type B1MediaUploadRequest = { mediaKind: B1MediaKind; mimeType: string; contentLengthBytes: number; contentHash: string; contentVersionId: number; actorId: string; };

/**
 * Generated from the contract source.
 */
export type B1MediaUploadIntent = { mediaAssetId: number; uploadToken: string; objectKey: string; expiresAt: string; maxBytes: number; accessPolicy: "SIGNED" | "PRIVATE"; supportsRange?: boolean; };

/**
 * Generated from the contract source.
 */
export type B1MediaCompleteRequest = { uploadToken: string; contentLengthBytes: number; contentHash: string; mimeType: string; actorId: string; };

/**
 * Generated from the contract source.
 */
export type B1MediaAsset = { mediaAssetId: number; mediaKind: B1MediaKind; mimeType: string; contentLengthBytes: number; contentHash: string; storageStatus: "UPLOADING" | "ACTIVE" | "REVOKED" | "DELETED"; accessPolicy: "SIGNED" | "PRIVATE"; supportsRange: boolean; objectKey?: string; };

/**
 * Generated from the contract source.
 */
export type B1MediaAccessRequest = { requesterId: string; accessScope: "STREAM" | "DOWNLOAD" | "OFFLINE"; rangeStartBytes?: number; rangeEndBytes?: number; };

/**
 * Generated from the contract source.
 */
export type B1SignedMediaAccess = { mediaAssetId: number; signedUrl: string; expiresAt: string; accessScope: "STREAM" | "DOWNLOAD" | "OFFLINE"; supportsRange: boolean; signatureId?: string; };

/**
 * Generated from the contract source.
 */
export type B1OfflineManifest = { manifestCode: string; manifestVersion: number; contentEpoch: number; manifestHash: string; generatedAt: string; expiresAt: string; entries: ReadonlyArray<B1OfflineManifestEntry>; };

/**
 * Generated from the contract source.
 */
export type B1OfflineManifestEntry = { contentVersionId: number; mediaAssetId?: number | null; resourceKind: "CONTENT_JSON" | "MEDIA" | "INDEX"; resourceKey: string; resourceHash: string; contentLengthBytes: number; allowOffline: boolean; };

/**
 * Generated from the contract source.
 */
export type B1ContentError = { code: string; message: string; requestId: string; details?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B1ErrorResponse = { requestId: string; traceId: string; error: { errorCode: "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "IDEMPOTENCY_CONFLICT"; message: string; retryable: boolean; }; };

/**
 * Generated from the contract source.
 */
export type B1AssessmentStartResponse = { sessionId: string; assessmentVersionId: string; questionId: number; rulesVersion: string; };

/**
 * Generated from the contract source.
 */
export type B1AssessmentStepRequest = { sessionId: string; assessmentVersionId: string; questionId: number; answer: string; timeSpentSec: number; };

/**
 * Generated from the contract source.
 */
export type B1AssessmentStepResponse = { attemptId: number; questionId: number; scoreBucket: "ZERO" | "LOW" | "MEDIUM" | "HIGH" | "FULL" | "WITHHELD"; deduplicated: boolean; };

/**
 * Generated from the contract source.
 */
export type B1DeviceListResponse = { devices: ReadonlyArray<B1Device>; };

/**
 * Generated from the contract source.
 */
export type B1Device = { deviceId: string; sessionId: string; status: "ACTIVE" | "REVOKED"; lastActiveAt: string; };

/**
 * Generated from the contract source.
 */
export type B1KickoutRequest = { deviceId: string; reasonCode: "KICKED" | "RISK_FREEZE" | "ADMIN"; };

/**
 * Generated from the contract source.
 */
export type B1PrivacyExportRequest = { subjectId: number; policyName: "learner-self"; };

/**
 * Generated from the contract source.
 */
export type B1PrivacyExportResponse = { exportId: string; status: "QUEUED" | "READY" | "FAILED"; redactionPolicy: "learner-self"; };

/**
 * Generated from the contract source.
 */
export type B1AnyData = { [key: string]: unknown; };

/**
 * Generated from the contract source.
 */
export type B1SmsCodeRequest = { phone: string; code?: string; adultConfirmed?: boolean; privacyConsent?: boolean; scene?: string; };

/**
 * Generated from the contract source.
 */
export type B1PhoneLoginRequest = { phone: string; code: string; adultConfirmed: boolean; privacyConsent: boolean; privacyPolicyVersion: string; device: B1DeviceInput; };

/**
 * Generated from the contract source.
 */
export type B1DeviceInput = { deviceId: string; deviceType: string; deviceName?: string; clientVersion: string; regionCode?: string; };

/**
 * Generated from the contract source.
 */
export type B1AuthTokenResponse = { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number; userId?: number; deviceId: string; sessionId: SessionId; };

/**
 * Generated from the contract source.
 */
export type B1RefreshRequest = { refreshToken: string; deviceId?: string; };

/**
 * Generated from the contract source.
 */
export type B1LogoutRequest = { allDevices?: boolean; };

/**
 * Generated from the contract source.
 */
export type B1OnboardingProfileRequest = { language?: string; targetGoal: string; examType?: string; dailyQuotaMinutes: 5 | 15 | 30 | 45; preferenceTags?: ReadonlyArray<string>; accentPreference?: string; customHomeLayout?: boolean; customHomeLayoutOrder?: ReadonlyArray<string>; expectedVersion?: number; };

/**
 * Generated from the contract source.
 */
export type B1PlacementSkipRequest = { fastTrackLevel?: "ZERO_A1" | "CET4_B1" | "CET6_B2" | "POSTGRAD_B2_PLUS"; };

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
  createContentEntity: { method: "POST"; path: "/api/v1/content"; request: B1CreateContentRequest; response: unknown; idempotent: true };
  createContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions"; request: B1CreateVersionRequest; response: unknown; idempotent: true };
  previewContentVersion: { method: "GET"; path: "/api/v1/content/{contentId}/versions/{versionId}/preview"; request: never; response: unknown; idempotent: false };
  diffContentVersions: { method: "GET"; path: "/api/v1/content/{contentId}/versions/{versionId}/diff"; request: never; response: B1ContentDiff; idempotent: false };
  submitContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/submit"; request: B1ActorRequest; response: unknown; idempotent: true };
  decideContentVersionReview: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/review"; request: B1ReviewDecisionRequest; response: unknown; idempotent: true };
  publishContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/publish"; request: B1ActorRequest; response: unknown; idempotent: true };
  archiveContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/archive"; request: B1ActorReasonRequest; response: unknown; idempotent: true };
  restoreContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/restore"; request: B1ActorReasonRequest; response: unknown; idempotent: true };
  importContentBatch: { method: "POST"; path: "/api/v1/content/imports"; request: B1ImportRequest; response: B1ImportReport; idempotent: true };
  createContentMediaUploadIntent: { method: "POST"; path: "/api/v1/content/media/upload-intents"; request: B1MediaUploadRequest; response: B1MediaUploadIntent; idempotent: true };
  completeContentMediaUpload: { method: "POST"; path: "/api/v1/content/media/{mediaAssetId}/complete"; request: B1MediaCompleteRequest; response: B1MediaAsset; idempotent: true };
  signContentMediaAccess: { method: "POST"; path: "/api/v1/content/media/{mediaAssetId}/signed-access"; request: B1MediaAccessRequest; response: B1SignedMediaAccess; idempotent: true };
  getContentOfflineManifest: { method: "GET"; path: "/api/v1/content/offline/manifests/{manifestCode}"; request: never; response: B1OfflineManifest; idempotent: false };
  getPublishedContent: { method: "GET"; path: "/api/v1/content/{contentId}"; request: never; response: unknown; idempotent: false };
  startPlacementSession: { method: "POST"; path: "/api/v1/assessment/placement/start"; request: never; response: B1AssessmentStartResponse; idempotent: true };
  submitPlacementStep: { method: "POST"; path: "/api/v1/assessment/placement/submit-step"; request: B1AssessmentStepRequest; response: B1AssessmentStepResponse; idempotent: true };
  listUserDevices: { method: "GET"; path: "/api/v1/user/devices"; request: never; response: B1DeviceListResponse; idempotent: false };
  kickoutUserDevice: { method: "POST"; path: "/api/v1/user/devices/kickout"; request: B1KickoutRequest; response: unknown; idempotent: true };
  createPrivacyExport: { method: "POST"; path: "/api/v1/privacy/export"; request: B1PrivacyExportRequest; response: B1PrivacyExportResponse; idempotent: true };
  sendB1SmsCode: { method: "POST"; path: "/api/v1/auth/sms/send-code"; request: B1SmsCodeRequest; response: B1AnyData; idempotent: true };
  loginB1Phone: { method: "POST"; path: "/api/v1/auth/login/phone"; request: B1PhoneLoginRequest; response: B1AuthTokenResponse; idempotent: true };
  registerB1Phone: { method: "POST"; path: "/api/v1/auth/register"; request: B1PhoneLoginRequest; response: B1AuthTokenResponse; idempotent: true };
  logoutB1Session: { method: "POST"; path: "/api/v1/auth/logout"; request: B1LogoutRequest; response: B1AnyData; idempotent: true };
  listB1AuthSessions: { method: "GET"; path: "/api/v1/auth/sessions"; request: never; response: B1AnyData; idempotent: false };
  revokeB1AuthSession: { method: "POST"; path: "/api/v1/auth/sessions/{sessionId}/revoke"; request: never; response: B1AnyData; idempotent: true };
  getB1OnboardingOptions: { method: "GET"; path: "/api/v1/onboarding/options"; request: never; response: B1AnyData; idempotent: false };
  getB1OnboardingProfile: { method: "GET"; path: "/api/v1/onboarding/profile"; request: never; response: B1AnyData; idempotent: false };
  saveB1OnboardingProfile: { method: "POST"; path: "/api/v1/onboarding/profile"; request: B1OnboardingProfileRequest; response: B1AnyData; idempotent: true };
  patchB1OnboardingProfile: { method: "PATCH"; path: "/api/v1/onboarding/profile"; request: B1OnboardingProfileRequest; response: B1AnyData; idempotent: true };
  createB1FirstGoal: { method: "POST"; path: "/api/v1/onboarding/goals/first"; request: never; response: B1AnyData; idempotent: true };
  getB1DailyTasks: { method: "GET"; path: "/api/v1/onboarding/daily-tasks/today"; request: never; response: B1AnyData; idempotent: false };
  completeB1DailyTask: { method: "POST"; path: "/api/v1/onboarding/daily-tasks/{taskId}/complete"; request: never; response: B1AnyData; idempotent: true };
  reorderB1DailyTasks: { method: "POST"; path: "/api/v1/onboarding/daily-tasks/reorder"; request: never; response: B1AnyData; idempotent: true };
  skipB1Placement: { method: "POST"; path: "/api/v1/assessment/placement/skip"; request: B1PlacementSkipRequest; response: B1AnyData; idempotent: true };
  getB1PlacementReport: { method: "GET"; path: "/api/v1/assessment/placement/report/{sessionId}"; request: never; response: B1AnyData; idempotent: false };
  getB1HomeFeed: { method: "GET"; path: "/api/v1/home/feed"; request: never; response: B1AnyData; idempotent: false };
  getB1ContinueContext: { method: "GET"; path: "/api/v1/learning/continue-context"; request: never; response: B1AnyData; idempotent: false };
  saveB1ContinueContext: { method: "PUT"; path: "/api/v1/learning/continue-context"; request: B1AnyData; response: B1AnyData; idempotent: true };
  saveB1LearningCheckpoint: { method: "PUT"; path: "/api/v1/sync/checkpoints/{lessonId}"; request: B1AnyData; response: B1AnyData; idempotent: true };
  getB1UserProfile: { method: "GET"; path: "/api/v1/user/profile"; request: never; response: B1AnyData; idempotent: false };
  patchB1UserProfile: { method: "PATCH"; path: "/api/v1/user/profile"; request: B1AnyData; response: B1AnyData; idempotent: true };
  getB1LearningPreferences: { method: "GET"; path: "/api/v1/user/learning-preferences"; request: never; response: B1AnyData; idempotent: false };
  patchB1LearningPreferences: { method: "PATCH"; path: "/api/v1/user/learning-preferences"; request: B1AnyData; response: B1AnyData; idempotent: true };
  getB1PrivacySettings: { method: "GET"; path: "/api/v1/user/privacy"; request: never; response: B1AnyData; idempotent: false };
  patchB1PrivacySettings: { method: "PATCH"; path: "/api/v1/user/privacy"; request: B1AnyData; response: B1AnyData; idempotent: true };
  getB1NotificationPreferences: { method: "GET"; path: "/api/v1/user/notifications"; request: never; response: B1AnyData; idempotent: false };
  patchB1NotificationPreferences: { method: "PATCH"; path: "/api/v1/user/notifications"; request: B1AnyData; response: B1AnyData; idempotent: true };
  kickB1UserDevice: { method: "POST"; path: "/api/v1/user/devices/{devicePublicId}/kick"; request: never; response: B1AnyData; idempotent: true };
  listB1LoginAlerts: { method: "GET"; path: "/api/v1/user/login-alerts"; request: never; response: B1AnyData; idempotent: false };
  getB1DeletionStatus: { method: "GET"; path: "/api/v1/user/deletion"; request: never; response: B1AnyData; idempotent: false };
  requestB1Deletion: { method: "POST"; path: "/api/v1/user/deletion"; request: B1AnyData; response: B1AnyData; idempotent: true };
  cancelB1Deletion: { method: "DELETE"; path: "/api/v1/user/deletion"; request: never; response: B1AnyData; idempotent: true };
}

export type ApiOperationId = keyof ApiOperationRegistry;
