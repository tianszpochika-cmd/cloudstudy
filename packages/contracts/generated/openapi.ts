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
 * Compatibility metadata retained for existing responses. New and migrated public operations use ApiResponseMeta.
 */
export type ApiMeta = { apiVersion: ApiVersion; schemaVersion: SemanticVersion; serverTime: DateTime; traceId: TraceId; };

/**
 * Generated from the contract source.
 */
export type PageMeta = { nextCursor?: Cursor | null; serverTime?: DateTime; snapshotAt?: DateTime | null; hasMore: boolean; pageSize: PageSize; };

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
 * Compatibility envelope retained for existing operations. New and migrated public operations use ApiErrorEnvelope so success and error results share canonical metadata.
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
export type HealthData = { status: HealthStatus; service: "api-gateway"; version: SemanticVersion; build: string; dependencies: ReadonlyArray<HealthDependency>; };

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
export type MasteryStatus = "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED" | "SHORT_TERM" | "CONSOLIDATING" | "AT_RISK" | "SUSPENDED";

/**
 * Generated from the contract source.
 */
export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

/**
 * Generated from the contract source.
 */
export type ItemType = "VOCAB" | "PHRASE" | "CHUNK" | "EXPRESSION" | "GRAMMAR" | "SENTENCE" | "LISTENING" | "READING" | "WRITING" | "EXERCISE";

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
export type B1ContentLicense = { licenseCode: string; licenseName: string; licenseStatus: B1LicenseStatus; copyrightOwner: string; authorizationEvidenceRef?: string; licenseUrl?: string; permittedPlatforms?: readonly [string, ...Array<string>]; allowsLearning: boolean; allowsOffline: boolean; attributionRequired?: boolean; startsAt?: string; expiresAt?: string; };

/**
 * 旧 B1 compatibility request。actorId 仅保留用于兼容解析，不是授权主体；新实现使用 submitB9ContentCommand。
 */
export type B1CreateContentRequest = { contentCode: string; contentType: B1ContentType; title: string; locale?: string; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; goalCode: string; parentContentId?: number; sortOrder?: number; payload: Record<string, never>; source: B1ContentSource; license: B1ContentLicense; actorId: string; };

/**
 * 旧 B1 compatibility request。actorId 仅保留用于兼容解析，不是授权主体；新实现使用 submitB9ContentCommand。
 */
export type B1CreateVersionRequest = { payload: Record<string, never>; source: B1ContentSource; license: B1ContentLicense; releaseNote?: string; rollbackOfVersionId?: number; actorId: string; };

/**
 * 旧 B1 compatibility request。actorId 仅保留用于兼容解析，不是授权主体；新实现使用 submitB9ContentCommand。
 */
export type B1ActorRequest = { actorId: string; requestId?: string; };

/**
 * 旧 B1 compatibility request。actorId 仅保留用于兼容解析，不是授权主体。
 */
export type B1ActorReasonRequest = B1ActorRequest & { reasonCode?: string; };

/**
 * 旧 B1 compatibility request。reviewerId 仅保留用于兼容解析；服务端必须从已验证主体和双审状态派生并校验 reviewer。
 */
export type B1ReviewDecisionRequest = { stage: B1ReviewStage; decision: B1ReviewDecision; reviewerId: string; reasonCode?: string; note?: string; };

/**
 * 旧 B1 compatibility request。批量导入迁移为逐内容 B9 draft commands；actorId 仅保留用于兼容解析，不是授权主体。
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
 * Compatibility error shape for existing content operations. New or migrated operations use ApiErrorEnvelope.
 */
export type B1ContentError = { code: string; message: string; requestId: string; details?: ReadonlyArray<string>; };

/**
 * Compatibility error shape for existing onboarding operations. New or migrated operations use ApiErrorEnvelope.
 */
export type B1ErrorResponse = { requestId: string; traceId: string; error: { errorCode: "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "IDEMPOTENCY_CONFLICT"; message: string; retryable: boolean; }; };

/**
 * Generated from the contract source.
 */
export type B1AssessmentReadResponse = { status?: string; sessionId?: string; contentVersionId?: string; currentQuestion?: unknown; nextQuestion?: unknown; report?: unknown; isCompleted?: boolean; [key: string]: unknown; };

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
export type B1PrivacyExportRequest = { policyName: "learner-self"; reauthenticationRef: string; };

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
 * Legacy wire shape retained only for the B9 adapter; the request cannot establish identity, ownership, tenant, gate, consent, policy or server versions.
 */
export type B1OnboardingProfileRequest = { language?: string; targetGoal: "ZERO_BASIS" | "CET_4_6" | "POSTGRADUATE" | "WORKPLACE_DAILY"; examType?: string; dailyQuotaMinutes: 5 | 15 | 30 | 45; preferenceTags?: readonly [] | readonly [string] | readonly [string, string] | readonly [string, string, string]; accentPreference?: string; customHomeLayout?: boolean; customHomeLayoutOrder?: ReadonlyArray<string>; expectedVersion?: number; };

/**
 * Generated from the contract source.
 */
export type B1PlacementSkipRequest = { fastTrackLevel?: "ZERO_A1" | "CET4_B1" | "CET6_B2" | "POSTGRAD_B2_PLUS"; };

/**
 * Generated from the contract source.
 */
export type B2CreateAssessmentSessionRequest = { sessionType: "DAILY_STREAM" | "QUICK_PRACTICE" | "CHECKPOINT"; targetCount?: number; planVersion?: string; streamRevision?: string; };

/**
 * Generated from the contract source.
 */
export type B2CreateExamSessionRequest = { paperId: number; examCode: "CET4" | "CET6" | "KY_ENGLISH_1" | "KY_ENGLISH_2"; deviceHash?: string; };

/**
 * Generated from the contract source.
 */
export type B2AnswerSubmissionRequest = { exerciseId: number; clientSubmissionId: string; revision: number; answer: B2AnswerByQuestionType; confidence?: "SURE" | "FUZZY" | "GUESS" | "DONT_KNOW"; elapsedMs?: number; checkpointSeq?: number; };

/**
 * 服务端按 questionType 校验；客户端不得传 score、isCorrect 或 correctAnswer
 */
export type B2AnswerByQuestionType = { selectedOptionKeys?: ReadonlyArray<string>; blanks?: ReadonlyArray<{ blankId: string; text: string; }>; orderedTokenIds?: ReadonlyArray<string>; pairs?: ReadonlyArray<Record<string, never>>; text?: string; [key: string]: unknown; };

/**
 * Generated from the contract source.
 */
export type B2CheckpointRequest = { checkpointSeq: number; currentExerciseId?: number; clientState?: Record<string, never>; clientStateHash: string; monotonicElapsedMs?: number; };

/**
 * Generated from the contract source.
 */
export type B2HeartbeatRequest = { checkpointSeq: number; clientEpochMs: number; deviceHash: string; visibilityState?: "VISIBLE" | "HIDDEN"; focusState?: "FOCUSED" | "BLURRED"; };

/**
 * Generated from the contract source.
 */
export type B2AntiCheatEventRequest = { clientEventId: string; eventType: "VISIBILITY_HIDDEN" | "FOCUS_LOST" | "FULLSCREEN_EXIT" | "HEARTBEAT_MISSED" | "MULTI_DEVICE" | "CLOCK_SKEW" | "CLIENT_TIME_BACKWARD" | "ELAPSED_GAP" | "PASTE_USED" | "RAPID_SEQUENCE" | "ANSWER_AFTER_DEADLINE" | "CHECKPOINT_CONFLICT"; sequence?: number; clientEpochMs?: number; deviceHash: string; metadata?: Record<string, never>; };

/**
 * Generated from the contract source.
 */
export type B2AnswerSheetMarkRequest = { exerciseId: number; reviewMark: "NONE" | "REVIEW"; };

/**
 * Generated from the contract source.
 */
export type B2VerificationSubmission = B2AnswerSubmissionRequest & ({ stage: "D0" | "D1" | "D7"; });

/**
 * Generated from the contract source.
 */
export type B2ShareAssetRequest = { reportId: number; templateCode: string; includeNickname?: boolean; includeScore?: boolean; };

/**
 * Generated from the contract source.
 */
export type B2Exercise = { sessionId: string; exerciseId: number; questionId: number; itemId?: number; questionType: "CHOICE" | "CONNECT_LINE" | "DRAG_SORTER" | "FILL_BLANK" | "SPELL_INPUT" | "LISTEN_CHOICE" | "ERROR_CORRECTION" | "TRANSLATION_INPUT"; position: number; sourceBucket?: "NEW" | "REVIEW" | "MISTAKE" | "EXAM"; verificationStage?: "D0" | "D1" | "D7"; prompt: Record<string, never>; interaction?: Record<string, never>; feedbackPolicy?: "IMMEDIATE" | "AFTER_SUBMIT" | "PENDING_MANUAL"; };

/**
 * Generated from the contract source.
 */
export type B2Session = { sessionId: string; sessionType: string; status: string; serverNow: string; deadlineAt?: string | null; remainingSec?: number; lastCheckpointSeq?: number; exercises: ReadonlyArray<B2Exercise>; answerSheet?: ReadonlyArray<Record<string, never>>; requestedQuota?: Record<string, never>; actualQuota?: Record<string, never>; degraded?: boolean; };

/**
 * Generated from the contract source.
 */
export type B2AnswerResult = { requestId: string; exerciseId: number; accepted: boolean; revision?: number; scoringStatus: "SCORED" | "PENDING_MANUAL" | "REJECTED" | "LATE" | "ACCEPTED"; isCorrect?: boolean | null; score?: number | null; maxScore?: number | null; errorCauseCandidates?: ReadonlyArray<string>; masteryEffect?: Record<string, never> | null; };

/**
 * Generated from the contract source.
 */
export type B2Report = { reportId: number; reportType: "EXAM_DIAGNOSTIC" | "DAILY" | "WEEKLY"; status: "GENERATING" | "READY" | "PARTIAL" | "FAILED"; score?: number | null; reportedMaxScore?: number | null; percentile?: number | null; cohortCount?: number | null; calculationVersion: string; metrics?: Record<string, never>; evidence?: ReadonlyArray<Record<string, never>>; explanation?: Record<string, never>; };

/**
 * Generated from the contract source.
 */
export type B2Mistake = { mistakeId: number; itemId: number; questionId?: number; mistakeStatus: "PENDING_RETRY" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REOPENED"; masteryStatus: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; errorCategory: string; reasonTrace?: ReadonlyArray<Record<string, never>>; };

/**
 * Generated from the contract source.
 */
export type B2Verification = { verificationId: number; mistakeId: number; stage: "D0" | "D1" | "D7"; result: "PENDING" | "PASSED" | "FAILED" | "NOT_DUE" | "EXPIRED"; dueAt: string; score?: number | null; maxScore?: number | null; nextState?: string; };

/**
 * Compatibility error shape for existing assessment operations. New or migrated operations use ApiErrorEnvelope.
 */
export type B2ApiError = { requestId: string; error: { errorCode: string; message: string; retryable: boolean; }; };

/**
 * Generated from the contract source.
 */
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/**
 * Generated from the contract source.
 */
export type LearningItemRef = { itemType: ItemType; vocabId?: number; chunkId?: number; expressionId?: number; };

/**
 * Generated from the contract source.
 */
export type SrsState = { srsStateId: number; item: LearningItemRef; repetitionCount: number; easeFactor: number; intervalDays: number; dueAt: string; dueLocalDate: string; masteryStatus: MasteryStatus; delayedVerifyStage?: "NONE" | "D1_PENDING" | "D7_PENDING" | "PASSED" | "FAILED"; stateVersion: number; riskBand?: "LOW" | "MEDIUM" | "HIGH"; explanation?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type ReviewEventRequest = { snapshotId?: number; snapshotItemId: number; item: LearningItemRef; rawQuality: 0 | 1 | 2 | 3; answerOutcome: "CORRECT" | "INCORRECT" | "UNANSWERED" | "REVEALED_WITHOUT_ANSWER"; responseTimeMs?: number; revealElapsedMs?: number; attemptNo?: number; clientEventId: string; clientOccurredAt: string; baseStateVersion: number; };

/**
 * Generated from the contract source.
 */
export type LibraryEntryCreateRequest = { itemType: ItemType; vocabId?: number; chunkId?: number; expressionId?: number; sourceType: string; collectionStatus?: "NEW_WORD" | "SAVED" | "MASTERED"; };

/**
 * Generated from the contract source.
 */
export type ExpressionCreateRequest = { sourceType: "READING" | "LISTENING" | "SCENARIO" | "VOCAB_EXAMPLE"; sourceRef?: string; sourceContentVersion?: string; sentenceText: string; translationCn?: string; selectedText?: string; rangeStart?: number; rangeEnd?: number; wantToSay?: boolean; addToSrs?: boolean; privateNote?: string; };

/**
 * Generated from the contract source.
 */
export type ExpressionUpdateRequest = { wantToSay?: boolean; privateNote?: string; addTagIds?: ReadonlyArray<number>; removeTagIds?: ReadonlyArray<number>; };

/**
 * Generated from the contract source.
 */
export type SrsBatchCreateRequest = { localDate: string; timezone: string; dailyNewTarget: number; maxDailyReview: number; scheduleType: "DAILY" | "CATCH_UP" | "EXPRESSION"; };

/**
 * Generated from the contract source.
 */
export type OfflineCard = { snapshotItemId: number; item: LearningItemRef; front: { word?: string; phoneticUs?: string; phoneticUk?: string; audio?: Record<string, never>; }; contentVersion: string; };

/**
 * Generated from the contract source.
 */
export type Wordbook = { wordbookId: number; code: string; nameCn: string; status: "PUBLISHED" | "ARCHIVED"; contentVersion: string; sourceVersion?: string; minCefr?: CefrLevel; maxCefr?: CefrLevel; wordCount: number; active?: boolean; };

/**
 * Generated from the contract source.
 */
export type VocabItem = { vocabId: number; word: string; cefrLevel: CefrLevel; contentVersion: string; srsState?: SrsState; };

/**
 * Generated from the contract source.
 */
export type VocabDetail = { vocabId: number; word: string; phoneticUs?: string | null; phoneticUk?: string | null; audio?: { [key: string]: string; }; pronunciation?: { [key: string]: unknown; }; cefrLevel?: CefrLevel; frequencyRank?: number | null; definitions: ReadonlyArray<Record<string, never>>; examples: ReadonlyArray<Record<string, never>>; relations?: ReadonlyArray<Record<string, never>>; srsState?: SrsState; contentVersion: string; };

/**
 * Generated from the contract source.
 */
export type ChunkDetail = { chunkId: number; canonicalText: string; chunkType?: string; meaningCn: string; usageNote?: string | null; scenarioCode?: string | null; examples?: ReadonlyArray<Record<string, never>>; srsState?: SrsState; contentVersion: string; };

/**
 * Generated from the contract source.
 */
export type SrsBatchItem = { snapshotItemId: number; sequenceNo: number; item: LearningItemRef; sourceReason: "NEW" | "DUE" | "OVERDUE_SMOOTHING" | "D1_VERIFY" | "D7_VERIFY" | "MISTAKE_REPAIR" | "EXPRESSION"; plannedLocalDate: string; dueAtAtSnapshot?: string | null; priorityScore?: number; status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "EXPIRED" | "RISK_FILTERED"; contentVersion?: string; };

/**
 * Generated from the contract source.
 */
export type ExpressionResponse = { expressionId: number; sourceType: string; sourceRef?: string | null; sentenceText: string; translationCn?: string | null; selectedText?: string | null; wantToSay?: boolean; tags?: ReadonlyArray<number>; privateNote?: string | null; srsState?: SrsState; status: "ACTIVE" | "ARCHIVED" | "DELETED"; };

/**
 * Generated from the contract source.
 */
export type ReviewEventResponse = { reviewEventId: number; eventStatus: "ACCEPTED" | "DUPLICATE" | "RISK_FILTERED" | "CONFLICT" | "REJECTED" | "EXPIRED"; riskDecision: "ALLOW" | "ACCEPT_NO_REWARD" | "THROTTLE" | "REJECT" | "REVIEW"; effectiveQuality?: 0 | 1 | 2 | 3 | null; reconciled?: boolean; stateVersion: number; srsState?: SrsState; rewardSettlementStatus?: "PENDING" | "SETTLED" | "NOT_ELIGIBLE" | "DUPLICATE"; nextSnapshotItemId?: number | null; };

/**
 * Generated from the contract source.
 */
export type SrsOverview = { todayDue: number; overdue: number; atRisk: number; shortTerm: number; mastered: number; consolidated: number; last7DaysMasteryRate?: number; };

/**
 * Generated from the contract source.
 */
export type B2LearningStreamActionRequest = { itemId: number; itemType?: "VOCAB" | "PHRASE" | "CHUNK" | "EXPRESSION" | "EXERCISE"; responseQuality: number; clientEventId?: string; };

/**
 * Generated from the contract source.
 */
export type B2LegacyAnswerItemRequest = { sessionUuid: string; exerciseId: number; answer: Record<string, never>; clientSubmissionId?: string; };

/**
 * Generated from the contract source.
 */
export type B2LegacySessionSubmitRequest = { sessionUuid: string; };

/**
 * Generated from the contract source.
 */
export type B2LegacyMistakeVerifyRequest = { mistakeId: number; stage: "D0" | "D1" | "D7"; answer: Record<string, never>; };

/**
 * Generated from the contract source.
 */
export type B2LearningStream = { items: ReadonlyArray<B2Exercise>; serverNow: string; requestedQuota?: Record<string, never>; actualQuota?: Record<string, never>; degraded?: boolean; };

/**
 * Generated from the contract source.
 */
export type B2DailySummary = { date: string; completedCount: number; reviewedCount: number; masteredCount: number; masteryRadar?: Record<string, never>; };

/**
 * Generated from the contract source.
 */
export type B2Notification = { notificationId: string; templateCode: string; status: "UNREAD" | "READ"; safeParams?: Record<string, never>; deepLink?: string; occurredAt: string; };

/**
 * Generated from the contract source.
 */
export type B3Id = number;

/**
 * Generated from the contract source.
 */
export type B3Response = { requestId: string; serverTime: string; data: { [key: string]: unknown; }; };

/**
 * Compatibility error shape for existing multimodal operations. New or migrated operations use ApiErrorEnvelope.
 */
export type B3ErrorResponse = { requestId: string; error: { code: string; message: string; retryable?: boolean; }; };

/**
 * Generated from the contract source.
 */
export type B3TimelineToken = { tokenId: string; text: string; startMs: number; endMs: number; ipa?: string; partOfSpeech?: string; stress?: "PRIMARY" | "SECONDARY" | "NONE"; };

/**
 * Generated from the contract source.
 */
export type B3SoundChangeAnnotation = { annotationId: string; ruleCode: "LINK_C2V" | "WEAK_FUNCTION_WORD" | "UNRELEASED_STOP" | "PLACE_ASSIM_N" | "STRESS_SHIFT"; tokenStartId?: string; tokenEndId?: string; startMs: number; endMs: number; label?: string; explanation?: string; ruleSetVersion: string; };

/**
 * Generated from the contract source.
 */
export type B3TimelineSegment = { segmentId: string; startMs: number; endMs: number; text: string; translation?: string; tokens: ReadonlyArray<B3TimelineToken>; annotations?: ReadonlyArray<B3SoundChangeAnnotation>; };

/**
 * Generated from the contract source.
 */
export type B3MediaRef = { assetId: string; variant: string; signedUrl?: string; rightsStatus: "AUTHORIZED" | "REVOKED"; };

/**
 * Generated from the contract source.
 */
export type B3GrammarPoint = { grammarPointId: B3Id; code: string; title: string; ruleFormula: string; meaningCn?: string; examples?: ReadonlyArray<string>; trapTags?: ReadonlyArray<string>; prerequisites?: ReadonlyArray<B3Id>; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3SyntaxNode = { nodeId: string; role: "SUBJECT" | "PREDICATE" | "OBJECT" | "COMPLEMENT" | "MODIFIER" | "CLAUSE" | "ROOT"; text: string; startToken: number; endToken: number; parentNodeId?: string | null; };

/**
 * Generated from the contract source.
 */
export type B3SyntaxEdge = { fromNodeId: string; toNodeId: string; relation: string; };

/**
 * Generated from the contract source.
 */
export type B3Sentence = { sentenceId: B3Id; text: string; translation?: string; contentVersionId: B3Id; nodes: ReadonlyArray<B3SyntaxNode>; edges: ReadonlyArray<B3SyntaxEdge>; audio?: B3MediaRef; };

/**
 * Generated from the contract source.
 */
export type B3GrammarSessionRequest = { grammarPointId: B3Id; targetCount: number; contentVersionId: B3Id; mode?: "FILL_BLANK" | "CHOICE" | "SENTENCE_BUILD" | "PARAPHRASE"; };

/**
 * Generated from the contract source.
 */
export type B3GrammarAnswerRequest = { exerciseId: B3Id; answer: { [key: string]: unknown; }; clientAnswerId: string; contentVersionId?: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3WritingPrompt = { promptId: B3Id; title: string; taskText: string; promptType?: "TRANSLATION" | "CORRECTION" | "ESSAY" | "LETTER"; targetStructure?: ReadonlyArray<string>; rubric?: ReadonlyArray<{ code: string; weight: number; }>; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3WritingSubmissionRequest = { promptId: B3Id; answer: string; clientSubmissionId: string; contentVersionId: B3Id; mode?: "TRANSLATION" | "CORRECTION" | "WRITING"; };

/**
 * Generated from the contract source.
 */
export type B3CorrectionRequest = { promptId: B3Id; exerciseId?: B3Id; answer: string; clientSubmissionId: string; contentVersionId?: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3WritingEvaluation = { submissionId: B3Id; score: number; band?: string; ruleVersion: string; rubricResults?: ReadonlyArray<{ code: string; score: number; feedbackCode?: string; }>; matchedPointCodes?: ReadonlyArray<string>; aiScoringAvailable: false; reviewState?: "RULE_EVALUATED" | "PENDING_USER_REVIEW"; };

/**
 * Generated from the contract source.
 */
export type B3ListeningMaterial = { materialId: B3Id; title: string; cefrLevel?: string; durationMs: number; contentVersionId: B3Id; rightsStatus: "AUTHORIZED" | "REVOKED"; mediaRef?: B3MediaRef; segments: ReadonlyArray<B3TimelineSegment>; manifestHash?: string; };

/**
 * Generated from the contract source.
 */
export type B3ListeningSessionRequest = { materialId: B3Id; contentVersionId: B3Id; mode?: "LISTEN" | "DICTATION" | "CLIPS" | "SHADOWING"; offline?: boolean; };

/**
 * Generated from the contract source.
 */
export type B3DictationRequest = { segmentId: string; mode: "WORD" | "SENTENCE" | "PARAGRAPH"; answer: string; attemptNo: number; hintCount?: number; clientEventId: string; contentVersionId?: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3ProgressRequest = { articleId?: B3Id; sessionId?: string; contentVersionId: B3Id; segmentId?: string; blockId?: string; tokenId?: string; characterOffset?: number; mediaPositionMs?: number; progressPercent: number; positionVersion: number; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B3ReadingBlock = { blockId: string; blockIndex: number; text: string; translation?: string; tokens?: ReadonlyArray<B3TimelineToken>; branchChoices?: ReadonlyArray<{ choiceCode: string; label: string; nextBlockId: string; }>; };

/**
 * Generated from the contract source.
 */
export type B3ReadingArticle = { articleId: B3Id; title: string; cefrLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; wordCount: number; estimatedMinutes?: number; rightsStatus?: "AUTHORIZED" | "REVOKED"; contentVersionId: B3Id; branching?: boolean; blocks: ReadonlyArray<B3ReadingBlock>; };

/**
 * Generated from the contract source.
 */
export type B3MiningRequest = { articleId: B3Id; blockId: string; selectedText: string; contentVersionId: B3Id; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B3MouthProfile = { profileVersion: string; fallback2d: string; jawOpen: number; tongueHeight: number; tongueBackness: number; tongueTipCurl?: number; lipRound: number; lipSpread?: number; softPalate?: number; glottisOpen?: number; voicing: boolean; airflow?: number; constriction?: number; };

/**
 * Generated from the contract source.
 */
export type B3Phoneme = { phonemeId: B3Id; symbol: string; group: "MONOPHTHONG" | "DIPHTHONG" | "CONSONANT" | "TEACHING_VARIANT"; exampleWord: string; description?: string; contentVersionId: B3Id; mediaRef?: B3MediaRef; mouthProfile: B3MouthProfile; minimalPairs?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B3RecordingRequest = { sessionId?: string; sourceSegmentId: string; durationMs: number; contentHash: string; storageMode: "LOCAL_ENCRYPTED" | "REMOTE_ENCRYPTED"; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B3Recording = { recordingId: B3Id; status: "LOCAL_ONLY" | "UPLOAD_PENDING" | "READY" | "DELETE_PENDING" | "DELETED"; durationMs: number; storageMode: string; waveformRef?: string; assetId?: string; retentionUntil?: string; aiScoringAvailable: false; selfRating?: "NEEDS_PRACTICE" | "BASIC" | "FLUENT" | "UNCERTAIN"; };

/**
 * Generated from the contract source.
 */
export type B3SelfRatingRequest = { rating: "NEEDS_PRACTICE" | "BASIC" | "FLUENT" | "UNCERTAIN"; tags?: ReadonlyArray<"RHYTHM" | "STRESS" | "LINKING" | "MOUTH_SHAPE" | "UNSURE">; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B3SyncChange = { changeId: string; entityType: "SRS_STATE" | "READING_PROGRESS" | "MEDIA_PROGRESS" | "EXPRESSION" | "RECORDING" | "SETTINGS"; entityId: string; entityVersion: number; operation: "UPSERT" | "DELETE"; payloadHash: string; occurredAt: string; clientEventId?: string; };

/**
 * Generated from the contract source.
 */
export type B3SyncPushRequest = { deviceId: string; clientBatchId: string; baseCursor: string; changes: ReadonlyArray<B3SyncChange>; };

/**
 * Generated from the contract source.
 */
export type B3SyncConflict = { conflictId: B3Id; entityType: string; entityId: string; resolution: "SERVER_WINS" | "LOCAL_RETRY" | "MERGED"; serverVersion: number; localChangeId?: string; };

/**
 * Generated from the contract source.
 */
export type B3OfflineManifest = { manifestId: string; contentVersionId: B3Id; expiresAt: string; sha256: string; bytes?: number; items: ReadonlyArray<{ assetId: string; kind: "AUDIO" | "WAVEFORM" | "TRANSCRIPT" | "PHONETICS_2D"; size: number; sha256: string; }>; };

/**
 * Generated from the contract source.
 */
export type B3GrammarExercise = { exerciseId: B3Id; grammarPointId: B3Id; type: "FILL_BLANK" | "CHOICE" | "SENTENCE_BUILD" | "PARAPHRASE" | "CORRECTION"; promptText: string; options?: ReadonlyArray<{ optionCode: string; label: string; }>; contentVersionId: B3Id; ruleVersion: string; };

/**
 * Generated from the contract source.
 */
export type B3GrammarAttemptRequest = { exerciseId: B3Id; answer: { [key: string]: unknown; }; clientAnswerId: string; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3MasterySnapshot = { dimensions: { [key: string]: number; }; overall: number; level: "REVIEW" | "DEVELOPING" | "MASTERED"; ruleVersion: string; };

/**
 * Generated from the contract source.
 */
export type B3SentenceBlockRequest = { blockOrder: readonly [string, ...Array<string>]; clientEventId: string; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3ImitationRequest = { slotValues: { [key: string]: string; }; clientEventId: string; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3WritingTemplate = { templateId: B3Id; templateType: "ESSAY" | "LETTER"; title: string; structure: ReadonlyArray<{ slotCode: string; label: string; required: boolean; }>; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3WritingMaterial = { materialId: B3Id; topicCode: string; title: string; bodyText: string; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3ProofreadingIssue = { issueId: B3Id; errorType: string; wrongText: string; wrongTextHash: string; explanation: string; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3LanguageClip = { clipId: B3Id; title: string; startMs: number; endMs: number; mediaRef: B3MediaRef; };

/**
 * Generated from the contract source.
 */
export type B3OfflinePackageRequest = { contentVersionId: B3Id; materialIds: readonly [B3Id, ...Array<B3Id>]; deviceId: string; };

/**
 * Generated from the contract source.
 */
export type B3OfflinePackageSyncRequest = { deviceId: string; items: ReadonlyArray<{ assetId: string; status: "PENDING" | "DOWNLOADING" | "READY" | "FAILED" | "EXPIRED"; bytesDownloaded: number; sha256: string; }>; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B3DictionaryEntry = { tokenId: string; lemma: string; partOfSpeech?: string; meaningCn: string; exampleText?: string; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3ReadingQuestion = { questionId: B3Id; questionType: "MAIN_IDEA" | "DETAIL" | "INFERENCE" | "VOCABULARY"; stemText: string; options: ReadonlyArray<{ optionCode: string; label: string; }>; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3ReadingAttemptRequest = { questionId: B3Id; answer: string; clientAttemptId: string; contentVersionId: B3Id; };

/**
 * Generated from the contract source.
 */
export type B3MinimalPair = { pairId: B3Id; leftPhonemeId: B3Id; rightPhonemeId: B3Id; leftWord: string; rightWord: string; };

/**
 * Generated from the contract source.
 */
export type B3ShadowingSessionRequest = { sourceSegmentId: string; targetGapMs: number; contentVersionId: B3Id; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B3ShadowingProgressRequest = { positionMs: number; attemptNo: number; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B3RoleplaySessionRequest = { roleplayCode: string; contentVersionId: B3Id; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B3RoleplayTurnRequest = { turnIndex: number; recordingId: string; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B4Id = number;

/**
 * Generated from the contract source.
 */
export type B4Envelope = { requestId: string; serverTime: string; data: { [key: string]: unknown; }; };

/**
 * Compatibility error shape for existing gamification and social operations. New or migrated operations use ApiErrorEnvelope.
 */
export type B4ErrorResponse = { requestId: string; error: { code: string; message: string; retryable: boolean; }; };

/**
 * Generated from the contract source.
 */
export type B4LearningEventRequest = { sourceType: "LESSON_COMPLETE" | "REVIEW_BATCH_COMPLETE" | "READING_COMPLETE" | "LISTENING_COMPLETE" | "WRITING_SUBMISSION" | "CHECKPOINT_PASS" | "GAME_SESSION_QUALIFIED" | "DAILY_GOAL_REACHED" | "QUEST_COMPLETED" | "ACHIEVEMENT_UNLOCKED" | "STREAK_MILESTONE"; sourceEventId: string; resultCode?: string; ruleVersion?: string; };

/**
 * Generated from the contract source.
 */
export type B4StreakSettingsRequest = { timeZone: string; weekendProtectionEnabled?: boolean; };

/**
 * Generated from the contract source.
 */
export type B4RescueRequest = { rescueMethod?: "CARD" | "CHALLENGE"; };

/**
 * Generated from the contract source.
 */
export type B4ShowcaseRequest = { showcased: boolean; };

/**
 * Generated from the contract source.
 */
export type B4AvatarRequest = { resourceVersion?: string; renderMode?: "3D" | "2D_FALLBACK"; };

/**
 * Generated from the contract source.
 */
export type B4LoadoutRequest = { name?: string; itemCodes?: ReadonlyArray<string>; resourceVersion?: string; };

/**
 * Generated from the contract source.
 */
export type B4StudySpaceRequest = { renderMode?: "3D" | "2D_FALLBACK"; placements?: ReadonlyArray<{ placementId: string; itemCode: string; positionCode?: string; }>; };

/**
 * Generated from the contract source.
 */
export type B4GameSessionRequest = { gameCode: "SENTENCE_TRAIN" | "WORD_MATCH" | "WORD_DEFENSE" | "WORD_PUZZLE" | "GRAMMAR_BLASTER" | "CATCH_MEANING"; contentVersionId?: B4Id; performanceTier?: "Ultra" | "High" | "Medium" | "Performance"; };

/**
 * Generated from the contract source.
 */
export type B4GameEventRequest = { eventId: string; seq: number; itemCode?: string; responseToken: string; };

/**
 * Generated from the contract source.
 */
export type B4JoinRoomRequest = { seatPreference?: string; };

/**
 * Generated from the contract source.
 */
export type B4FocusRequest = { action?: "PAUSE" | "RESUME" | "COMPLETE" | "AUTO_RELEASE" | "HEARTBEAT"; durationMinutes?: 25 | 45; focusTagCode?: string; clientEventId?: string; };

/**
 * Generated from the contract source.
 */
export type B4InteractionRequest = { interactionCode: "CHEER_UP" | "STUDY_TOGETHER" | "CONGRATS" | "TRY_AGAIN" | "TONIGHT_20_MIN"; targetUserId?: B4Id; };

/**
 * Generated from the contract source.
 */
export type B4WsTicketRequest = { roomId?: string; deviceId?: string; };

/**
 * Generated from the contract source.
 */
export type B4NotificationPreferencesRequest = { roomInteractions?: boolean; focusReminders?: boolean; system?: boolean; doNotDisturb?: boolean; };

/**
 * Generated from the contract source.
 */
export type B4SyncRequest = { clientBatchId: string; events: ReadonlyArray<{ clientEventId: string; eventType: string; occurredAt: string; entityId?: string; entityVersion?: number; }>; };

/**
 * Generated from the contract source.
 */
export type B4CheckpointRequest = { entityVersion: number; deviceId?: string; };

/**
 * Generated from the contract source.
 */
export type B4ReportRequest = { reasonCode: "SPAM" | "HARASSMENT" | "SENSITIVE_CONTENT" | "IMPERSONATION" | "OTHER"; targetUserId: B4Id; roomId?: string; };

/**
 * Generated from the contract source.
 */
export type B4BlockRequest = { targetUserId: B4Id; };

/**
 * Generated from the contract source.
 */
export type B4MuteRequest = { targetUserId: B4Id; durationSeconds?: number; };

/**
 * Generated from the contract source.
 */
export type B4OfflineDownloadRequest = { action: "PAUSE" | "RESUME" | "PART_RECEIVED"; partIndex?: number; etag?: string; };

/**
 * Generated from the contract source.
 */
export type B4AppealRequest = { appealCode: "FALSE_POSITIVE" | "CONTEXT" | "OTHER"; };

/**
 * Generated from the contract source.
 */
export type B5UserIdValue = number;

/**
 * Generated from the contract source.
 */
export type B5Envelope = { requestId: string; data: { [key: string]: unknown; }; meta?: { [key: string]: unknown; }; };

/**
 * Generated from the contract source.
 */
export type B5ErrorEnvelope = { requestId: string; error: { code: string; message: string; retryable?: boolean; }; };

/**
 * Generated from the contract source.
 */
export type B5CreateOrderRequest = { skuId: string; priceId: string; channelCode: "WECHAT" | "ALIPAY" | "APPLE" | "ACTIVATION_CODE"; sourcePlatform?: "WEB" | "H5" | "IOS" | "ANDROID" | "IPAD" | "WECHAT_MINI_PROGRAM"; };

/**
 * Generated from the contract source.
 */
export type B5PaymentAttemptRequest = { channelCode: "WECHAT" | "ALIPAY" | "APPLE" | "ACTIVATION_CODE"; returnPath?: string; };

/**
 * Generated from the contract source.
 */
export type B5ProviderCallbackRequest = { callbackEventId: string; orderId: string; channelTradeNo: string; amountMinor: number; currency: "CNY" | "USD"; payloadHash: string; signatureSerial: string; };

/**
 * Generated from the contract source.
 */
export type B5AppleVerificationRequest = { transactionId: string; originalTransactionId: string; productId: string; environment: "Sandbox" | "Production"; bundleId: string; appAccountTokenHash?: string; payloadHash: string; };

/**
 * Generated from the contract source.
 */
export type B5HouseholdRequest = { nameRef?: string; };

/**
 * Generated from the contract source.
 */
export type B5InvitationRequest = { memberRefHash: string; };

/**
 * Generated from the contract source.
 */
export type B5InvitationAcceptRequest = { invitationId: string; };

/**
 * Generated from the contract source.
 */
export type B5ActivationRedeemRequest = { code: string; };

/**
 * Generated from the contract source.
 */
export type B5RefundRequest = { reasonCode: string; amountMinor?: number; };

/**
 * Generated from the contract source.
 */
export type B5InvoiceRequest = { orderId: string; invoiceType: "PERSONAL" | "ORGANIZATION"; recipientRefHash: string; };

/**
 * Generated from the contract source.
 */
export type B5SupportTicketRequest = { ticketType: "CONTENT_CORRECTION" | "PAYMENT" | "ACCOUNT" | "OTHER"; resourceRef: string; descriptionHash: string; attachmentRefs?: readonly [] | readonly [string] | readonly [string, string] | readonly [string, string, string] | readonly [string, string, string, string] | readonly [string, string, string, string, string]; };

/**
 * Generated from the contract source.
 */
export type B5SupportMessageRequest = { messageHash: string; clientMessageRef: string; };

/**
 * Generated from the contract source.
 */
export type B6Envelope = { requestId: string; data: { [key: string]: unknown; }; };

/**
 * Compatibility error shape for existing platform-quality operations. New or migrated operations use ApiErrorEnvelope.
 */
export type B6ErrorEnvelope = { requestId: string; error: B6Error; };

/**
 * Generated from the contract source.
 */
export type B6Error = { code: string; message: string; retryable: boolean; };

/**
 * Generated from the contract source.
 */
export type B6BuildRequest = { platformCode: "WEB" | "H5" | "ANDROID" | "IOS" | "IPAD" | "WECHAT_MINI_PROGRAM" | "WINDOWS_PWA"; buildVersion: string; sourceRevision: string; artifactRef: string; artifactSha256: string; artifactSizeBytes: number; status: "PENDING" | "READY" | "FAILED"; capabilities?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B6CompatibilityCheckRequest = { buildId: string; platformCode: string; viewportCode: string; orientation: "PORTRAIT" | "LANDSCAPE" | "BOTH"; overflowCount: number; keyboardReachable: boolean; touchTargetFailures: number; resultCode: "PASS" | "FAIL" | "BLOCKED"; evidenceRef: string; };

/**
 * Generated from the contract source.
 */
export type B6E2ERunRequest = { scenarioCode: string; surface: "ONBOARDING" | "LEARNING_LOOP" | "CONTENT_VISIBILITY" | "COMMERCE"; platformCode: string; sourceRevision: string; status: "PASSED" | "FAILED" | "SKIPPED"; passedCount: number; failedCount: number; evidenceRef: string; };

/**
 * Generated from the contract source.
 */
export type B6SecurityScanRequest = { scanType: "AUTHORIZATION" | "DEPENDENCY" | "SECRET" | "PRIVACY" | "CONTRACT"; sourceRevision: string; ruleVersion: string; status: "PASS" | "FAIL" | "BLOCKED"; criticalCount: number; highCount: number; mediumCount: number; sensitiveFindingCount: number; reportRef: string; };

/**
 * Generated from the contract source.
 */
export type B6ReliabilityRunRequest = { runType: "LOAD" | "CHAOS" | "WEAK_NETWORK" | "IDEMPOTENCY"; sourceRevision: string; status: "PASS" | "FAIL" | "BLOCKED"; duplicateWriteCount: number; lostWriteCount: number; retrySuccessRate: number; p95LatencyMs: number; reportRef: string; };

/**
 * Generated from the contract source.
 */
export type B6DrillRequest = { drillType: "MIGRATION_ROLLBACK" | "MYSQL_RESTORE" | "REDIS_REBUILD" | "OBJECT_STORAGE_RESTORE"; sourceRevision: string; status: "PASSED" | "FAILED" | "BLOCKED"; rtoSeconds: number; rpoSeconds: number; restoredResourceCount: number; failedResourceCount: number; backupRef: string; rollbackRef: string; };

/**
 * Generated from the contract source.
 */
export type B6ReleaseGateRequest = { releaseVersion: string; candidateBuildIds: readonly [string, ...Array<string>]; requiredChecks: readonly ["COMPATIBILITY" | "E2E" | "SECURITY" | "RELIABILITY" | "BACKUP", ...Array<"COMPATIBILITY" | "E2E" | "SECURITY" | "RELIABILITY" | "BACKUP">]; privacyStatus: "PASS" | "FAIL" | "PENDING"; copyrightStatus: "PASS" | "FAIL" | "PENDING"; merchantStatus: "PASS" | "FAIL" | "PENDING"; platformReviewStatus: "PASS" | "FAIL" | "PENDING" | "NOT_REQUIRED"; rollbackPlanRef: string; };

/**
 * Compatibility error shape for existing IAM operations. New or migrated operations use ApiErrorEnvelope.
 */
export type B8ErrorEnvelope = { requestId: string; error: B8Error; };

/**
 * Generated from the contract source.
 */
export type B8Error = { code: "invalid_request" | "unauthorized" | "forbidden" | "adult_gate_required" | "consent_required" | "session_revoked" | "policy_denied" | "account_locked" | "password_reset_invalid" | "refresh_token_reused" | "rate_limited" | "conflict"; message: string; retryable: boolean; policyVersion?: string; };

/**
 * Generated from the contract source.
 */
export type B8SessionRevocationResponse = { sessionId: string; status: "REVOKED" | "ALREADY_REVOKED"; revocationScope?: "CURRENT_SESSION_AND_TOKEN_FAMILY" | "TARGET_SESSION_AND_TOKEN_FAMILY" | "ALL_PRINCIPAL_SESSIONS_AND_TOKEN_FAMILIES"; reasonCode?: "LOGOUT" | "EXPLICIT_REVOKE" | "PASSWORD_RESET" | "REFRESH_REUSE"; revokedAt?: string; };

/**
 * Generated from the contract source.
 */
export type B8PrincipalResponse = { principalId: string; subject?: B8ServerDerivedSubject; tenantId: string; tenant?: B8ServerDerivedTenant; sessionId: string; deviceId: string; roles: ReadonlyArray<string>; permissions: ReadonlyArray<string>; phase?: B8PhaseAccessContext; authMode: "self-owned-jwt"; status?: "ACTIVE" | "RESTRICTED"; adultGate?: B8AdultGateResponse; consentState?: B8ConsentState; deviceTrust?: B8DeviceTrustContext; policyVersion?: string; policy?: B8PolicyVersionContext; authorityProvenance?: B8AuthorityProvenance; };

/**
 * Generated from the contract source.
 */
export type B8Device = { deviceId: string; deviceType: string; status: "ACTIVE" | "REVOKED"; lastActiveAt: string; isCurrent: boolean; };

/**
 * Generated from the contract source.
 */
export type B8DeviceListResponse = { devices: ReadonlyArray<B8Device>; };

/**
 * Generated from the contract source.
 */
export type B8AdultGateRequest = { confirmed: true; birthYear: number; policyVersion: string; };

/**
 * Generated from the contract source.
 */
export type B8AdultGateResponse = { status: "PASSED" | "REJECTED" | "NOT_EVALUATED"; learningAccess?: "ELIGIBLE" | "RESTRICTED"; effectiveAt: string; policyVersion?: string; policyAsOf?: string; minimumAge?: 18; evidenceDigest?: string; evidenceStatus?: "SERVER_VERIFIED" | "INSUFFICIENT" | "REJECTED"; evaluationProvenance?: B8AdultGateEvaluationProvenance; revalidation?: B8RevalidationRequirement; restrictionReasons?: ReadonlyArray<"ADULT_GATE_NOT_EVALUATED" | "ADULT_EVIDENCE_INSUFFICIENT" | "ADULT_EVIDENCE_REJECTED" | "ADULT_POLICY_SUPERSEDED" | "ADULT_REVALIDATION_REQUIRED">; retryAllowed?: boolean; };

/**
 * Generated from the contract source.
 */
export type B8Consent = { type: "TERMS" | "PRIVACY" | "ADULT_LEARNING" | "PRODUCT_ANALYTICS" | "VOICE_RECORDING"; version: string; decision: "ACCEPTED" | "WITHDRAWN"; decidedAt: string; purpose: "ACCOUNT_TERMS" | "PRIVACY_NOTICE" | "ADULT_LEARNING_ELIGIBILITY" | "PRODUCT_ANALYTICS" | "ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY"; required: boolean; document: B8ConsentDocument; state: "GRANTED" | "WITHDRAWN"; effectiveAt: string; restrictionEffect: "NO_RESTRICTION" | "RESTRICT_PROTECTED_CAPABILITY" | "RESTRICT_ALL_LEARNING_ACCESS"; revalidation: B8RevalidationRequirement; withdrawalEffect: B8ConsentWithdrawalEffect; provenance: B8ConsentProvenance; policyRef: string; policyVersion: string; decisionRef: string; };

/**
 * Generated from the contract source.
 */
export type B8ConsentState = { required?: boolean; accepted?: boolean; version?: string; learningAccess?: "ELIGIBLE" | "RESTRICTED"; requiredPurposes?: ReadonlyArray<"ACCOUNT_TERMS" | "PRIVACY_NOTICE" | "ADULT_LEARNING_ELIGIBILITY" | "PRODUCT_ANALYTICS" | "ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY">; unsatisfiedPurposes?: ReadonlyArray<"ACCOUNT_TERMS" | "PRIVACY_NOTICE" | "ADULT_LEARNING_ELIGIBILITY" | "PRODUCT_ANALYTICS" | "ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY">; evaluatedAt?: string; policyVersion?: string; revalidation?: B8RevalidationRequirement; provenance?: B8ConsentProvenance; };

/**
 * Generated from the contract source.
 */
export type B8ConsentListResponse = { items: ReadonlyArray<B8Consent>; };

/**
 * Generated from the contract source.
 */
export type B8ConsentUpdateRequest = { type: "TERMS" | "PRIVACY" | "ADULT_LEARNING" | "PRODUCT_ANALYTICS" | "VOICE_RECORDING"; version: string; decision: "ACCEPTED" | "WITHDRAWN"; expectedDocumentDigest?: string; };

/**
 * Generated from the contract source.
 */
export type B8JwksResponse = { keys: ReadonlyArray<{ kty: "RSA"; kid: string; use: "sig"; alg: "RS256"; n: string; e: string; }>; };

/**
 * Compatibility request shape for the deprecated authorization endpoint. New PEP integrations use B8PdpAuthorizationDecisionRequest with a trusted service identity, principal provenance, resource provenance and policy context.
 */
export type B8AuthorizationDecisionRequest = { action: string; resourceType: string; resourceId: string; phase: "P1" | "P2" | "P3"; contentRights?: string; deviceTrust?: string; consentRequirement?: string; };

/**
 * Generated from the contract source.
 */
export type B8AuthorizationDecisionResponse = { decisionId: string; decision: "ALLOW" | "DENY"; reasonCode: "ALLOWED" | "POLICY_DENIED" | "ADULT_GATE_REQUIRED" | "CONSENT_REQUIRED" | "SESSION_REVOKED" | "CONTEXT_MISSING" | "POLICY_UNAVAILABLE" | "POLICY_VERSION_EXPIRED" | "REVOCATION_UNCERTAIN" | "PDP_ERROR" | "PDP_TIMEOUT" | "INVALID_SERVICE_IDENTITY" | "RESOURCE_PROVENANCE_MISSING" | "TENANT_PROVENANCE_MISMATCH" | "OWNER_PROVENANCE_MISMATCH"; policyVersion: string; evaluatedAt: string; cacheUntil?: string; enforcement?: B8AuthorizationEnforcement; auditLink?: B8AuditLink; };

/**
 * Generated from the contract source.
 */
export type B8SessionId = string;

/**
 * Generated from the contract source.
 */
export type B8DeviceId = string;

/**
 * Generated from the contract source.
 */
export type B8PermissionsResponse = { permissions: ReadonlyArray<string>; roles: ReadonlyArray<string>; policyVersion: string; policy?: B8PolicyVersionContext; authorityProvenance?: B8AuthorityProvenance; };

/**
 * 内容版本的只读摘要。canonical 持久状态只有 DRAFT、IN_REVIEW、APPROVED、PUBLISHED、ARCHIVED；UNPUBLISHED 和 ROLLED_BACK 仅为旧 v1 响应的 deprecated compatibility aliases，新实现不得产生。
 */
export type B9ContentVersionSummary = { contentVersionId: B9ContentVersionId; versionNumber: number; status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "UNPUBLISHED" | "ROLLED_BACK" | "ARCHIVED"; contentHash: string; sourceCode?: string; licenseCode?: string; createdAt: B9DateTime; publishedAt?: B9DateTime; };

/**
 * Generated from the contract source.
 */
export type B9ContentItemDefinition = { itemCode: string; itemType: B9ContentItemType; displayOrder: number; stimulusRef: string; displayText?: string; definition: { [key: string]: unknown; }; answerRuleVersion?: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentDraftInput = { contentType: B9ContentType; title: string; summary?: string; contentLocale: B9Locale; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; sourceCode: string; licenseCode: string; permittedChannels?: readonly [string] | readonly [string, string] | readonly [string, string, string] | readonly [string, string, string, string] | readonly [string, string, string, string, string] | readonly [string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string]; authorizationEvidenceRef?: string; allowsLearning?: boolean; contentHash: string; items: readonly [B9ContentItemDefinition, ...Array<B9ContentItemDefinition>]; };

/**
 * 命令只表达意图和资源版本；actor、tenant、owner、role、permission、reviewer 和版权事实均由服务端从已验证上下文与内容记录派生。
 */
export type B9ContentCommandRequest = ({ command: "CREATE_DRAFT" | "SAVE_DRAFT" | "VALIDATE_DRAFT" | "SUBMIT_REVIEW" | "REVIEW_FIRST" | "REVIEW_FINAL" | "PUBLISH" | "SCHEDULE_PUBLISH" | "CANCEL_SCHEDULED_PUBLISH" | "UNPUBLISH" | "ROLLBACK" | "LEXEME_UPSERT" | "LEXEME_SUBMIT_REVIEW" | "LEXEME_REVIEW_FIRST" | "LEXEME_REVIEW_FINAL" | "LEXEME_PUBLISH" | "LEXEME_UNPUBLISH" | "LEXEME_ARCHIVE" | "LEXEME_PRONUNCIATION_UPSERT" | "LEXEME_PRONUNCIATION_QC" | "ITEM_UPSERT" | "ITEM_SUBMIT_REVIEW" | "ITEM_REVIEW_FIRST" | "ITEM_REVIEW_FINAL" | "ITEM_PUBLISH" | "ITEM_UNPUBLISH" | "ITEM_ARCHIVE"; contentCode: B9ContentCode; expectedStateVersion: B9ExpectedStateVersion; targetVersionNumber?: number; reasonCode?: string; content?: B9ContentDraftInput; reviewDecision?: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reviewNote?: string; schedule?: B9PublishScheduleInput; scheduledPublishTaskId?: B9ScheduledPublishTaskId; lexeme?: LexemeUpsertInput; pronunciation?: LexemePronunciationInput; lexemeId?: string; item?: ContentItemUpsertInput; itemId?: string; targetType?: "PACK" | "LEXEME" | "ITEM"; targetRef?: string; cohort?: string; }) & ({ content: B9ContentDraftInput; command: "CREATE_DRAFT"; targetVersionNumber?: never; reasonCode?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; } | { content: B9ContentDraftInput; command: "SAVE_DRAFT"; reasonCode?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; } | { command: "VALIDATE_DRAFT"; targetVersionNumber?: never; reasonCode?: never; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; } | { command: "SUBMIT_REVIEW"; targetVersionNumber?: never; reasonCode?: never; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; } | { reviewDecision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; command: "REVIEW_FIRST" | "REVIEW_FINAL"; targetVersionNumber?: never; reasonCode?: never; content?: never; schedule?: never; scheduledPublishTaskId?: never; } | { targetVersionNumber: number; command: "PUBLISH"; reasonCode?: never; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; } | { schedule: B9PublishScheduleInput; command: "SCHEDULE_PUBLISH"; targetVersionNumber?: never; content?: never; reviewDecision?: never; reviewNote?: never; scheduledPublishTaskId?: never; } | { scheduledPublishTaskId: B9ScheduledPublishTaskId; command: "CANCEL_SCHEDULED_PUBLISH"; targetVersionNumber?: never; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; } | { reasonCode: string; command: "UNPUBLISH"; targetVersionNumber?: never; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; } | { targetVersionNumber: number; reasonCode: string; command: "ROLLBACK"; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; } | { lexeme: LexemeUpsertInput; command: "LEXEME_UPSERT"; targetVersionNumber?: never; reasonCode?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; content?: never; pronunciation?: never; } | { command: "LEXEME_SUBMIT_REVIEW"; targetVersionNumber?: never; reasonCode?: never; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; lexeme?: never; pronunciation?: never; } | { reviewDecision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; command: "LEXEME_REVIEW_FIRST" | "LEXEME_REVIEW_FINAL"; targetVersionNumber?: never; reasonCode?: never; content?: never; schedule?: never; scheduledPublishTaskId?: never; lexeme?: never; pronunciation?: never; } | { reasonCode: string; command: "LEXEME_PUBLISH" | "LEXEME_UNPUBLISH" | "LEXEME_ARCHIVE"; targetVersionNumber?: never; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; lexeme?: never; pronunciation?: never; } | { pronunciation: LexemePronunciationInput; command: "LEXEME_PRONUNCIATION_UPSERT" | "LEXEME_PRONUNCIATION_QC"; targetVersionNumber?: never; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; lexeme?: never; } | { item: ContentItemUpsertInput; command: "ITEM_UPSERT"; targetVersionNumber?: never; reasonCode?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; content?: never; lexeme?: never; pronunciation?: never; } | { command: "ITEM_SUBMIT_REVIEW"; targetVersionNumber?: never; reasonCode?: never; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; lexeme?: never; pronunciation?: never; item?: never; } | { reviewDecision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; command: "ITEM_REVIEW_FIRST" | "ITEM_REVIEW_FINAL"; targetVersionNumber?: never; reasonCode?: never; content?: never; schedule?: never; scheduledPublishTaskId?: never; lexeme?: never; pronunciation?: never; item?: never; } | { reasonCode: string; command: "ITEM_PUBLISH" | "ITEM_UNPUBLISH" | "ITEM_ARCHIVE"; targetVersionNumber?: never; content?: never; reviewDecision?: never; reviewNote?: never; schedule?: never; scheduledPublishTaskId?: never; lexeme?: never; pronunciation?: never; item?: never; });

/**
 * 服务端生成的命令受理结果。排期命令只返回只读任务引用；任务 status 不是 runtime publication proof。
 */
export type B9ContentCommandAccepted = { commandId: string; command: "CREATE_DRAFT" | "SAVE_DRAFT" | "VALIDATE_DRAFT" | "SUBMIT_REVIEW" | "REVIEW_FIRST" | "REVIEW_FINAL" | "PUBLISH" | "SCHEDULE_PUBLISH" | "CANCEL_SCHEDULED_PUBLISH" | "UNPUBLISH" | "ROLLBACK" | "LEXEME_UPSERT" | "LEXEME_SUBMIT_REVIEW" | "LEXEME_REVIEW_FIRST" | "LEXEME_REVIEW_FINAL" | "LEXEME_PUBLISH" | "LEXEME_UNPUBLISH" | "LEXEME_ARCHIVE" | "LEXEME_PRONUNCIATION_UPSERT" | "LEXEME_PRONUNCIATION_QC" | "ITEM_UPSERT" | "ITEM_SUBMIT_REVIEW" | "ITEM_REVIEW_FIRST" | "ITEM_REVIEW_FINAL" | "ITEM_PUBLISH" | "ITEM_UNPUBLISH" | "ITEM_ARCHIVE"; contentCode: B9ContentCode; contentVersionId?: B9ContentVersionId; status: B9CommandStatus; stateVersion: B9StateVersion; outboxEventId?: string; acceptedAt: B9DateTime; scheduledPublishTask?: B9ScheduledPublishTaskRef; lexemeId?: string; lexemeStateVersion?: B9StateVersion; itemId?: string; itemStateVersion?: B9StateVersion; validationReport?: B9ValidationReport; };

/**
 * Generated from the contract source.
 */
export type B9PublicContentItem = { itemCode: string; itemType: B9ContentItemType; displayOrder: number; stimulusRef: string; displayText?: string; mediaRefs?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B9PublicContentProjection = { projectionKey: B9ProjectionKey; contentCode: B9ContentCode; contentType: B9ContentType; title: string; summary?: string; contentLocale: B9Locale; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; contentVersionId: B9ContentVersionId; versionNumber: number; projectionVersion: B9ProjectionVersion; contentEpoch: B9ContentEpoch; availability: "PUBLISHED"; projectionStatus?: "CURRENT" | "STALE" | "PROCESSING"; items: ReadonlyArray<B9PublicContentItem>; publishedAt: B9DateTime; cacheTag: string; };

/**
 * Generated from the contract source.
 */
export type B9LearnerContentProjection = { content: B9PublicContentProjection; learnerAccess: { available: boolean; offlineAllowed: boolean; reasonCode: "ALLOWED" | "PHASE_RESTRICTED" | "RIGHTS_RESTRICTED" | "DEVICE_RESTRICTED" | "POLICY_DENIED"; }; contentEpoch: B9ContentEpoch; projectionStatus?: "CURRENT" | "STALE" | "PROCESSING"; sessionPin?: B9SessionContentPin; };

/**
 * Generated from the contract source.
 */
export type B9PublicContentCard = { contentCode: B9ContentCode; contentType: B9ContentType; title: string; summary?: string; contentLocale: B9Locale; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; contentVersionId: B9ContentVersionId; availability: "PUBLISHED"; };

/**
 * Generated from the contract source.
 */
export type B9PublicProjectionMeta = { projectionVersion: B9ProjectionVersion; contentEpoch: B9ContentEpoch; generatedAt: B9DateTime; source: "CONTENT_SERVICE" | "CACHE" | "STATIC_DEGRADED"; stale?: boolean; traceId?: string; };

/**
 * Generated from the contract source.
 */
export type B9PublicContentCatalog = { items: ReadonlyArray<B9PublicContentCard>; nextCursor?: string; contentEpoch: B9ContentEpoch; projectionVersion: B9ProjectionVersion; };

/**
 * Generated from the contract source.
 */
export type B9LearnerContentCatalog = { items: ReadonlyArray<B9PublicContentCard>; nextCursor?: string; contentEpoch: B9ContentEpoch; projectionVersion: B9ProjectionVersion; };

/**
 * Generated from the contract source.
 */
export type B9PriceCard = { priceCode: string; currency: string; amountMinor: number; displayAmount: string; status: "PUBLISHED" | "UNAVAILABLE"; effectiveFrom?: B9DateTime; effectiveUntil?: B9DateTime; };

/**
 * Generated from the contract source.
 */
export type B9DownloadChannel = ({ platform: "WEB" | "IOS" | "ANDROID" | "IPAD" | "WECHAT_MINI_PROGRAM" | "WINDOWS"; channel: string; status: "AVAILABLE" | "UNAVAILABLE" | "COMING_SOON"; downloadUrl?: string; version?: string; }) & ({ downloadUrl: string; status: "AVAILABLE"; } | { status: "UNAVAILABLE" | "COMING_SOON"; });

/**
 * Generated from the contract source.
 */
export type B9PublicAnnouncement = { announcementCode: string; title: string; summary: string; publishedAt: B9DateTime; expiresAt?: B9DateTime; };

/**
 * Generated from the contract source.
 */
export type B9ComplianceNotice = { noticeCode: string; title: string; body: string; version: string; effectiveAt: B9DateTime; };

/**
 * Generated from the contract source.
 */
export type B9PublicSiteProjection = { projectionVersion: B9ProjectionVersion; contentEpoch: B9ContentEpoch; generatedAt: B9DateTime; courses: ReadonlyArray<B9PublicContentCard>; pricing: ReadonlyArray<B9PriceCard>; downloads: ReadonlyArray<B9DownloadChannel>; announcements: ReadonlyArray<B9PublicAnnouncement>; compliance: ReadonlyArray<B9ComplianceNotice>; };

/**
 * 公开投影水位状态。STALE/PROCESSING 只表示投影落后或重建中，不能把草稿或未授权版本标成 PUBLISHED。
 */
export type B9PublicProjectionState = { availability: B9ContentAvailability; projectionVersion: B9ProjectionVersion; contentEpoch: B9ContentEpoch; projectionStatus?: "CURRENT" | "STALE" | "PROCESSING"; lastPublishedAt?: B9DateTime; cacheTag?: string; };

/**
 * 内容后台状态。canonical 持久状态为 DRAFT/IN_REVIEW/APPROVED/PUBLISHED/ARCHIVED；旧 UNPUBLISHED/ROLLED_BACK 只读兼容且新实现不得产生。排期任务由服务端只读维护。
 */
export type B9AdminContentState = { contentCode: B9ContentCode; contentType: B9ContentType; title: string; authorSubject?: string; stateVersion: B9StateVersion; latestStatus: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "UNPUBLISHED" | "ROLLED_BACK" | "ARCHIVED"; versions: ReadonlyArray<B9ContentVersionSummary>; publicProjection: B9PublicProjectionState; rightsStatus: "PENDING" | "VALID" | "EXPIRED" | "REVOKED"; reviewSubmissionReady?: boolean; reviewSubmissionReason?: "READY" | "DRAFT_REQUIRED" | "RIGHTS_NOT_READY" | "VALIDATION_NOT_PASSED" | "VALIDATION_REPORT_UNAVAILABLE" | "MEDIA_ELIGIBILITY_UNAVAILABLE"; validationReport?: B9ValidationReport; reviewRecords?: (readonly [] | readonly [({ contentVersionId: B9ContentVersionId; contentHash: string; reviewStage: "FIRST_REVIEW" | "FINAL_REVIEW"; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reviewVersion: number; auditId: B9AuditId; decidedAt: B9DateTime; }) & ({ reviewStage: "FIRST_REVIEW"; } | { reviewStage: "FINAL_REVIEW"; })] | readonly [({ contentVersionId: B9ContentVersionId; contentHash: string; reviewStage: "FIRST_REVIEW" | "FINAL_REVIEW"; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reviewVersion: number; auditId: B9AuditId; decidedAt: B9DateTime; }) & ({ reviewStage: "FIRST_REVIEW"; } | { reviewStage: "FINAL_REVIEW"; }), ({ contentVersionId: B9ContentVersionId; contentHash: string; reviewStage: "FIRST_REVIEW" | "FINAL_REVIEW"; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reviewVersion: number; auditId: B9AuditId; decidedAt: B9DateTime; }) & ({ reviewStage: "FIRST_REVIEW"; } | { reviewStage: "FINAL_REVIEW"; })]) & (readonly [] | readonly [{ reviewStage: "FIRST_REVIEW"; }] | (readonly [({ contentVersionId: B9ContentVersionId; contentHash: string; reviewStage: "FIRST_REVIEW" | "FINAL_REVIEW"; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reviewVersion: number; auditId: B9AuditId; decidedAt: B9DateTime; }) & ({ reviewStage: "FIRST_REVIEW"; } | { reviewStage: "FINAL_REVIEW"; }), ({ contentVersionId: B9ContentVersionId; contentHash: string; reviewStage: "FIRST_REVIEW" | "FINAL_REVIEW"; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reviewVersion: number; auditId: B9AuditId; decidedAt: B9DateTime; }) & ({ reviewStage: "FIRST_REVIEW"; } | { reviewStage: "FINAL_REVIEW"; })])); scheduledPublishTask?: B9ScheduledPublishTaskRef; lexeme?: LexemeRecord; item?: ContentItemRecord; scheduledTasks?: ReadonlyArray<{ taskId: string; targetType: "PACK" | "LEXEME" | "ITEM"; targetRef: string; expectedStateVersion?: B9StateVersion; runAt: B9DateTime; status: "SCHEDULED" | "CANCELLED" | "EXECUTED" | "FAILED"; reasonCode?: string; failureCode?: string; createdBy?: string; createdAt?: B9DateTime; updatedAt?: B9DateTime; }>; };

/**
 * Generated from the contract source.
 */
export type B9AssessmentItemDefinition = { itemCode: string; itemType: B9ContentItemType; stimulusRef: string; answerRuleVersion: string; scoringPolicyRef: string; };

/**
 * Generated from the contract source.
 */
export type B9AssessmentContentSnapshot = { contentVersionId: B9ContentVersionId; contentCode: B9ContentCode; snapshotVersion: B9ProjectionVersion; items: ReadonlyArray<B9AssessmentItemDefinition>; rightsStatus: "VALID" | "EXPIRED" | "REVOKED"; expiresAt?: B9DateTime; };

/**
 * Generated from the contract source.
 */
export type B9PublicContentCatalogResponse = { data: B9PublicContentCatalog; meta: B9PublicProjectionMeta; };

/**
 * Generated from the contract source.
 */
export type B9PublicContentProjectionResponse = { data: B9PublicContentProjection; meta: B9PublicProjectionMeta; };

/**
 * Generated from the contract source.
 */
export type B9LearnerContentCatalogResponse = { data: B9LearnerContentCatalog; meta: B9PublicProjectionMeta; };

/**
 * Generated from the contract source.
 */
export type B9LearnerContentProjectionResponse = { data: B9LearnerContentProjection; meta: B9PublicProjectionMeta; };

/**
 * Generated from the contract source.
 */
export type B9PublicSiteProjectionResponse = { data: B9PublicSiteProjection; meta: B9PublicProjectionMeta; };

/**
 * Generated from the contract source.
 */
export type B9ContentCommandAcceptedResponse = { data: B9ContentCommandAccepted; };

/**
 * Generated from the contract source.
 */
export type B9AdminContentStateResponse = { data: B9AdminContentState; };

/**
 * Generated from the contract source.
 */
export type B9InternalPublicProjectionResponse = { data: B9PublicContentProjection; meta: B9PublicProjectionMeta; };

/**
 * Generated from the contract source.
 */
export type B9AssessmentContentSnapshotResponse = { data: B9AssessmentContentSnapshot; };

/**
 * Generated from the contract source.
 */
export type B9LearnerProfile = { principalId: B9PrincipalId; tenantId: "platform"; status: "ONBOARDING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED"; uiLocale: B9Locale; contentLocale: B9Locale; timezone: string; profileVersion: B9StateVersion; targetGoal?: string; proficiencyLevel?: "UNKNOWN" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; stateVersion: B9StateVersion; updatedAt: B9DateTime; };

/**
 * 只提交可由学习者修改的字段；principalId、tenantId、role、owner、server versions 和权限事实由服务端派生。targetGoal 历史影子字段保留定义，但写入恒以 422 拒绝。
 */
export type B9LearnerProfilePatch = { expectedStateVersion: B9ExpectedStateVersion; uiLocale?: B9Locale; contentLocale?: B9Locale; timezone?: string; targetGoal?: never; proficiencyLevel?: "UNKNOWN" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; };

/**
 * Generated from the contract source.
 */
export type B9LearnerTarget = { targetId: number; goalCode: "FOUNDATION" | "COLLEGE_CET" | "POSTGRADUATE_ENGLISH" | "WORKPLACE_DAILY"; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; examCode?: string; dailyQuotaMinutes: 5 | 15 | 30 | 45; targetDate?: string; status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED"; targetVersion: B9StateVersion; stateVersion: B9StateVersion; updatedAt: B9DateTime; };

/**
 * 目标命令不接受 tenantId、owner/principal 或 server version 字段；目标始终绑定到已验证主体。
 */
export type B9LearnerTargetUpsert = { expectedStateVersion: B9ExpectedStateVersion; goalCode: "FOUNDATION" | "COLLEGE_CET" | "POSTGRADUATE_ENGLISH" | "WORKPLACE_DAILY"; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; examCode?: string; dailyQuotaMinutes: 5 | 15 | 30 | 45; targetDate?: string; status?: "ACTIVE" | "PAUSED"; };

/**
 * Generated from the contract source.
 */
export type B9LearnerPreferences = { uiLocale: B9Locale; contentLocale: B9Locale; timezone: string; weeklyStudyDays: readonly [number] | readonly [number, number] | readonly [number, number, number] | readonly [number, number, number, number] | readonly [number, number, number, number, number] | readonly [number, number, number, number, number, number] | readonly [number, number, number, number, number, number, number]; themeMode: "LIGHT" | "DARK" | "SYSTEM"; highContrast: boolean; motionMode: "FULL" | "REDUCED" | "OFF"; preferenceVersion: B9StateVersion; stateVersion: B9StateVersion; updatedAt: B9DateTime; };

/**
 * UI locale、content locale、主题和无障碍设置分开持久化；contentLocale 不得覆盖 UI locale；server versions and identity are never accepted.
 */
export type B9LearnerPreferencesPatch = { expectedStateVersion: B9ExpectedStateVersion; uiLocale?: B9Locale; contentLocale?: B9Locale; timezone?: string; weeklyStudyDays?: readonly [number] | readonly [number, number] | readonly [number, number, number] | readonly [number, number, number, number] | readonly [number, number, number, number, number] | readonly [number, number, number, number, number, number] | readonly [number, number, number, number, number, number, number]; themeMode?: "LIGHT" | "DARK" | "SYSTEM"; highContrast?: boolean; motionMode?: "FULL" | "REDUCED" | "OFF"; };

/**
 * Generated from the contract source.
 */
export type B9TaskRef = { taskId: string; taskType: "GOAL_SETUP" | "PLACEMENT" | "LESSON" | "REVIEW" | "CONTENT_RECOVERY"; status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED" | "UNAVAILABLE"; contentCode?: B9ContentCode; contentVersionPin?: B9ContentVersionId; position: number; unavailableReason?: "NONE" | "CONTENT_UNPUBLISHED" | "RIGHTS_EXPIRED" | "POLICY_DENIED" | "SERVICE_DEGRADED"; };

/**
 * Generated from the contract source.
 */
export type B9FirstDayProjection = B9FirstDayProjectionCommon & ({ state: "NOT_READY"; taskCount: 0; tasks: readonly []; blocker: "PROFILE_INCOMPLETE" | "TARGET_INCOMPLETE" | "PLACEMENT_REQUIRED" | "CONSENT_REQUIRED" | "POLICY_DENIED"; planningInput?: never; job?: never; plan?: never; degradedReason?: never; recovery?: never; } | { state: "PROCESSING"; profileReady: true; targetReady: true; taskCount: 0; tasks: readonly []; planningInput: B9PlanningInputSnapshot; job: B9PlanningJobRef & ({ status: "QUEUED" | "PROCESSING" | "RETRYABLE"; }); blocker?: never; plan?: never; degradedReason?: never; recovery?: never; } | { state: "READY"; profileReady: true; targetReady: true; taskCount: number; tasks: readonly [B9TaskRef, ...Array<B9TaskRef>]; planningInput: B9PlanningInputSnapshot; plan: B9PlanReference; blocker?: never; job?: never; degradedReason?: never; recovery?: never; } | { state: "DEGRADED"; profileReady: true; targetReady: true; taskCount: 0; tasks: readonly []; planningInput: B9PlanningInputSnapshot; degradedReason: "CONTENT_PROJECTION_STALE" | "LEGACY_SHADOW_ONLY" | "DEPENDENCY_UNAVAILABLE" | "PLAN_FAILED" | "RIGHTS_DENIED" | "POLICY_DENIED"; recovery: B9FirstDayRecovery & ({ status: "QUEUED" | "PROCESSING" | "RETRYABLE" | "FAILED"; }); blocker?: never; job?: never; plan?: never; });

/**
 * Generated from the contract source.
 */
export type B9HomeProjection = { projectionVersion: B9ProjectionVersion; contentEpoch: B9ContentEpoch; generatedAt: B9DateTime; firstDay: B9FirstDayProjection; tasks: ReadonlyArray<B9TaskRef>; resume?: { contentCode?: B9ContentCode; contentVersionPin?: B9ContentVersionId; checkpointKey?: string; available?: boolean; }; };

/**
 * Generated from the contract source.
 */
export type B9LegacyShadowProfile = { source: "LEGACY_READ_ONLY"; profile: B9LearnerProfile; legacyProfileVersion: string; mappedAt: B9DateTime; consistent: boolean; differenceCodes?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B9LearnerResponseMeta = { traceId?: string; requestId?: string; source?: "LEARNER_SERVICE" | "LEGACY_SHADOW"; stale?: boolean; };

/**
 * Generated from the contract source.
 */
export type B9LearnerProfileResponse = { data: B9LearnerProfile; meta?: B9LearnerResponseMeta; };

/**
 * Generated from the contract source.
 */
export type B9LearnerTargetResponse = { data: B9LearnerTarget; meta?: B9LearnerResponseMeta; };

/**
 * Generated from the contract source.
 */
export type B9LearnerPreferencesResponse = { data: B9LearnerPreferences; meta?: B9LearnerResponseMeta; };

/**
 * Generated from the contract source.
 */
export type B9FirstDayProjectionResponse = { data: B9FirstDayProjection; meta?: B9LearnerResponseMeta; };

/**
 * Generated from the contract source.
 */
export type B9HomeProjectionResponse = { data: B9HomeProjection; meta?: B9LearnerResponseMeta; };

/**
 * Generated from the contract source.
 */
export type B9LegacyShadowProfileResponse = { data: B9LegacyShadowProfile; meta?: B9LearnerResponseMeta; };

/**
 * 由 IAM 映射的不可变 principal；客户端不能提交或覆盖 owner/tenant 事实。
 */
export type B9PrincipalId = string;

/**
 * Generated from the contract source.
 */
export type B9ContentCode = string;

/**
 * Generated from the contract source.
 */
export type B9ProjectionKey = string;

/**
 * Generated from the contract source.
 */
export type B9ContentVersionId = number;

/**
 * Generated from the contract source.
 */
export type B9Locale = string;

/**
 * Compatibility error payload for existing B9 operations. New or migrated operations use ApiError inside ApiErrorEnvelope.
 */
export type B9Problem = { code: "validation_error" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "version_conflict" | "idempotency_conflict" | "content_unpublished" | "content_rights_expired" | "projection_stale" | "not_ready" | "service_unavailable"; message: string; traceId: string; requestId?: string; retryable?: boolean; details?: { [key: string]: unknown; }; };

/**
 * 由服务端递增的聚合状态版本；不是客户端可自由生成的时间戳。
 */
export type B9StateVersion = number;

/**
 * Generated from the contract source.
 */
export type B9ProjectionVersion = number;

/**
 * 内容发布/下线/权利变化后单调递增的缓存失效 epoch。
 */
export type B9ContentEpoch = number;

/**
 * Generated from the contract source.
 */
export type B9DateTime = string;

/**
 * Generated from the contract source.
 */
export type B9CommandStatus = "ACCEPTED" | "APPLIED" | "REJECTED" | "CONFLICT";

/**
 * Generated from the contract source.
 */
export type B9ContentAvailability = "PUBLISHED" | "UNPUBLISHED" | "RIGHTS_PENDING" | "RIGHTS_EXPIRED" | "NOT_READY";

/**
 * Generated from the contract source.
 */
export type B9ContentItemType = "VOCABULARY" | "PHRASE" | "GRAMMAR" | "SENTENCE" | "QUESTION";

/**
 * Generated from the contract source.
 */
export type B9ContentType = "COURSE" | "COURSE_UNIT" | "VOCABULARY" | "PHRASE" | "GRAMMAR" | "SENTENCE" | "QUESTION";

/**
 * Generated from the contract source.
 */
export type B9AdminContentStateList = { items: ReadonlyArray<B9AdminContentState>; nextCursor?: string; };

/**
 * Generated from the contract source.
 */
export type B9AdminContentStateListResponse = { data: B9AdminContentStateList; };

/**
 * 乐观并发写入的期望版本；新聚合尚未持久化时允许使用 0，服务端成功写入后返回从 1 开始的 B9StateVersion。
 */
export type B9ExpectedStateVersion = number;

/**
 * Generated from the contract source.
 */
export type B10CompatDomain = "VOCABULARY" | "ASSESSMENT" | "GRAMMAR" | "READING" | "WRITING" | "LISTENING" | "SPEAKING";

/**
 * Generated from the contract source.
 */
export type B10ReadMode = "LEGACY_READ" | "SHADOW_READ" | "TARGET_READ" | "FALLBACK_READ";

/**
 * Synthetic or irreversible subject reference hash; raw identity is never part of this adapter contract.
 */
export type B10SubjectRefHash = string;

/**
 * Generated from the contract source.
 */
export type B10ReconciliationStatus = "MATCH" | "MISMATCH" | "LEGACY_ONLY" | "TARGET_ONLY" | "UNAVAILABLE" | "NOT_COMPARED";

/**
 * Generated from the contract source.
 */
export type B10ReadShadow = { comparisonId: string; domainCode: B10CompatDomain; subjectRefHash: B10SubjectRefHash; fixtureVersion: string; readMode: B10ReadMode; legacyVersion?: string; targetVersion?: string; legacySnapshotHash?: string | null; targetSnapshotHash?: string | null; status: B10ReconciliationStatus; differenceCodes?: ReadonlyArray<string>; readOnly: true; safeToCutover: boolean; rollbackWindowEndsAt?: string | null; comparedAt: string; };

/**
 * Generated from the contract source.
 */
export type B10ReconciliationRequest = { domainCode: B10CompatDomain; subjectRefHash: B10SubjectRefHash; fixtureVersion: string; legacyVersion: string; targetVersion: string; comparisonWindowStart?: string; comparisonWindowEnd?: string; };

/**
 * Generated from the contract source.
 */
export type B10RouteDecisionRequest = { domainCode: B10CompatDomain; desiredMode: B10ReadMode; expectedConfigVersion: number; comparisonId: string; reasonCode: "INITIAL_SHADOW" | "MATCH_CONFIRMED" | "CONTROLLED_CUTOVER" | "DEPENDENCY_DEGRADED" | "MANUAL_RECOVERY"; rollbackWindowEndsAt: string; };

/**
 * Generated from the contract source.
 */
export type B10RollbackRequest = { domainCode: B10CompatDomain; targetMode: "LEGACY_READ" | "TARGET_READ" | "FALLBACK_READ"; expectedConfigVersion: number; reasonCode: "MISMATCH_DETECTED" | "TARGET_UNAVAILABLE" | "CONTENT_PIN_UNAVAILABLE" | "DLQ_BACKLOG" | "MANUAL_RECOVERY"; comparisonId: string; };

/**
 * Generated from the contract source.
 */
export type B10RouteDecision = { domainCode: B10CompatDomain; mode: B10ReadMode; configVersion: number; fallbackAllowed: boolean; rollbackWindowEndsAt: string; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B10ReadShadowResponse = { data: B10ReadShadow; };

/**
 * Generated from the contract source.
 */
export type B10RouteDecisionResponse = { data: B10RouteDecision; };

/**
 * Generated from the contract source.
 */
export type B10Int64Id = number;

/**
 * Generated from the contract source.
 */
export type B10StateVersion = number;

/**
 * Generated from the contract source.
 */
export type B10ContentEpoch = number;

/**
 * Generated from the contract source.
 */
export type B10ProjectionVersion = number;

/**
 * Generated from the contract source.
 */
export type B10DateTime = string;

/**
 * Generated from the contract source.
 */
export type B10Sha256 = string;

/**
 * Generated from the contract source.
 */
export type B10ContentCode = string;

/**
 * Generated from the contract source.
 */
export type B10SnapshotId = string;

/**
 * Generated from the contract source.
 */
export type B10SessionId = string;

/**
 * Generated from the contract source.
 */
export type B10AttemptId = string;

/**
 * Generated from the contract source.
 */
export type B10ReportId = string;

/**
 * Generated from the contract source.
 */
export type B10QueueItemId = string;

/**
 * Content pin for a future read or a task that has not started. SAFE_FUTURE_FALLBACK may be represented only before a session or attempt starts; active session and attempt projections use B10ActiveSessionAttemptPin and never replace their pinned contentVersionId silently.
 */
export type B10ContentVersionPin = ({ contentCode: B10ContentCode; contentVersionId: B10Int64Id; contentEpoch: B10ContentEpoch; snapshotId: B10SnapshotId; snapshotHash: B10Sha256; pinStatus: "PINNED" | "UNPUBLISHED" | "RECOVERABLE" | "RECOVERED" | "UNAVAILABLE"; pinnedAt: B10DateTime; fallbackVersionId?: B10Int64Id; fallbackContentEpoch?: B10ContentEpoch; fallbackSnapshotId?: B10SnapshotId; fallbackSnapshotHash?: B10Sha256; recoveryReasonCode?: "NONE" | "CONTENT_UNPUBLISHED" | "RIGHTS_EXPIRED" | "SNAPSHOT_MISSING" | "POLICY_DENIED" | "SERVICE_DEGRADED" | "RIGHTS_REMOVED" | "SECURITY_REMOVED" | "LEGAL_REMOVED"; }) & ({ pinStatus: "PINNED"; recoveryReasonCode: "NONE"; fallbackVersionId?: never; fallbackContentEpoch?: never; fallbackSnapshotId?: never; fallbackSnapshotHash?: never; } | { pinStatus: "UNPUBLISHED"; recoveryReasonCode: "CONTENT_UNPUBLISHED"; fallbackVersionId?: never; fallbackContentEpoch?: never; fallbackSnapshotId?: never; fallbackSnapshotHash?: never; } | { pinStatus: "RECOVERABLE"; recoveryReasonCode: "CONTENT_UNPUBLISHED" | "RIGHTS_EXPIRED" | "SNAPSHOT_MISSING" | "POLICY_DENIED" | "SERVICE_DEGRADED"; fallbackVersionId?: never; fallbackContentEpoch?: never; fallbackSnapshotId?: never; fallbackSnapshotHash?: never; } | { fallbackVersionId: B10Int64Id; fallbackContentEpoch: B10ContentEpoch; fallbackSnapshotId: B10SnapshotId; fallbackSnapshotHash: B10Sha256; pinStatus: "RECOVERED"; recoveryReasonCode: "CONTENT_UNPUBLISHED" | "RIGHTS_EXPIRED" | "SNAPSHOT_MISSING" | "POLICY_DENIED" | "SERVICE_DEGRADED"; } | { pinStatus: "UNAVAILABLE"; recoveryReasonCode: "RIGHTS_REMOVED" | "SECURITY_REMOVED" | "LEGAL_REMOVED"; fallbackVersionId?: never; fallbackContentEpoch?: never; fallbackSnapshotId?: never; fallbackSnapshotHash?: never; });

/**
 * Generated from the contract source.
 */
export type B10ContentItemOption = { optionId: string; label: string; };

/**
 * Generated from the contract source.
 */
export type B10LearnerContentItem = { itemId: B10Int64Id; itemCode: string; itemType: "VOCABULARY" | "PHRASE" | "GRAMMAR" | "SENTENCE" | "READING" | "LISTENING" | "WRITING"; stem: string; options?: ReadonlyArray<B10ContentItemOption>; mediaRef?: string; displayOrder?: number; };

/**
 * Protected grading contract metadata. It is not an answer key and is never emitted in integration events.
 */
export type B10RuleContract = { ruleRef: string; answerRuleVersion: B10RuleVersion; ruleDigest: B10Sha256; evaluationMode: "DETERMINISTIC" | "MANUAL_REVIEW" | "SELF_RATING"; sealed: true; };

/**
 * Generated from the contract source.
 */
export type B10AssessmentContentItem = { itemId: B10Int64Id; itemCode: string; itemType: "VOCABULARY" | "PHRASE" | "GRAMMAR" | "SENTENCE" | "READING" | "LISTENING" | "WRITING"; stem: string; options?: ReadonlyArray<B10ContentItemOption>; mediaRef?: string; displayOrder?: number; ruleContract: B10RuleContract; };

/**
 * Generated from the contract source.
 */
export type B10LearnerContentSnapshot = { pin: B10ContentVersionPin; snapshotVersion: B10ProjectionVersion; availability: "AVAILABLE" | "STALE" | "UNAVAILABLE"; items: ReadonlyArray<B10LearnerContentItem>; generatedAt: B10DateTime; };

/**
 * Assessment-only snapshot. Content service remains the owner of question definitions and protected rule references; assessment does not maintain a content master table.
 */
export type B10AssessmentContentSnapshot = { pin: B10ContentVersionPin; snapshotVersion: B10ProjectionVersion; answerRuleSetVersion: B10RuleVersion; items: ReadonlyArray<B10AssessmentContentItem>; generatedAt: B10DateTime; };

/**
 * Future-read-only recovery decision. The route cannot be applied to an active session or attempt. SAFE_FUTURE_FALLBACK requires an explicit replacement version and snapshot and never regrades historical facts.
 */
export type B10ContentRecovery = ({ usageScope: "FUTURE_READ_ONLY"; requestedVersionId: B10Int64Id; resolvedVersionId?: B10Int64Id | null; resolvedSnapshotId?: B10SnapshotId | null; resolution: "EXACT_PIN" | "IMMUTABLE_SNAPSHOT" | "SAFE_FUTURE_FALLBACK" | "UNAVAILABLE"; contentEpoch?: B10ContentEpoch; recoveryReasonCode?: "NONE" | "CONTENT_UNPUBLISHED" | "RIGHTS_EXPIRED" | "SNAPSHOT_MISSING" | "POLICY_DENIED" | "SERVICE_DEGRADED" | "RIGHTS_REMOVED" | "SECURITY_REMOVED" | "LEGAL_REMOVED"; mustNotRegrade: true; resolvedAt: B10DateTime; }) & ({ resolvedVersionId: B10Int64Id | null; resolvedSnapshotId: B10SnapshotId | null; resolution: "EXACT_PIN"; } | { resolvedSnapshotId: B10SnapshotId | null; resolution: "IMMUTABLE_SNAPSHOT"; resolvedVersionId?: never; } | { resolvedVersionId: B10Int64Id | null; resolvedSnapshotId: B10SnapshotId | null; resolution: "SAFE_FUTURE_FALLBACK"; } | { resolution: "UNAVAILABLE"; recoveryReasonCode: "CONTENT_UNPUBLISHED" | "RIGHTS_EXPIRED" | "SNAPSHOT_MISSING" | "POLICY_DENIED" | "SERVICE_DEGRADED" | "RIGHTS_REMOVED" | "SECURITY_REMOVED" | "LEGAL_REMOVED"; resolvedVersionId?: never; resolvedSnapshotId?: never; });

/**
 * The client may request a content version but cannot provide tenant, owner, role, score or grading rule facts. An optional contentCode names the gradable content (default course-b25-basics); the server resolves rules for the named (contentCode, contentVersionId) pair and answers 410 when it is unavailable.
 */
export type B10CreateAssessmentSessionRequest = { contentCode?: B10ContentCode; contentVersionId: B10Int64Id; mode: "PRACTICE" | "REVIEW" | "PLACEMENT" | "MOCK"; itemIds?: readonly [B10Int64Id, ...Array<B10Int64Id>]; clientSessionRef?: string; };

/**
 * Session lifecycle only. Attempt and report lifecycles are distinct aggregates and cannot be inferred from this status.
 */
export type B10AssessmentSession = { sessionId: B10SessionId; status: B10SessionStatus; mode: "PRACTICE" | "REVIEW" | "PLACEMENT" | "MOCK"; pin: B10ActiveSessionAttemptPin; items: ReadonlyArray<B10LearnerContentItem>; itemRulePins: readonly [B10AssessmentItemRulePin, ...Array<B10AssessmentItemRulePin>]; answerRuleSetVersion: B10RuleVersion; completionRuleVersion: B10RuleVersion; attemptCount?: number; stateVersion: B10StateVersion; startedAt: B10DateTime; expiresAt?: B10DateTime | null; reportId?: B10ReportId | null; lastAttemptId?: B10AttemptId | null; };

/**
 * Closed protected candidate-response union. The scoring boundary receives one explicit response shape and a digest; client score/rule authority is rejected.
 */
export type B10AttemptSubmission = ({ itemId: B10Int64Id; sequence: number; responseType: "CHOICE" | "MATCHING" | "ORDERING" | "CLOZE" | "TEXT" | "UNANSWERED"; responseDigest: B10Sha256; selectedOptionIds?: readonly [string, ...Array<string>]; pairs?: readonly [B10MatchingPair, ...Array<B10MatchingPair>]; orderedTokenIds?: readonly [string, ...Array<string>]; blanks?: readonly [B10ClozeEntry, ...Array<B10ClozeEntry>]; text?: string; score?: never; scoreBucket?: never; isCorrect?: never; correct?: never; answerRule?: never; answerRuleVersion?: never; ruleDigest?: never; gradingRuleVersion?: never; }) & ({ itemId: B10Int64Id; sequence: number; responseType: "CHOICE"; responseDigest: B10Sha256; selectedOptionIds: readonly [string, ...Array<string>]; pairs?: never; orderedTokenIds?: never; blanks?: never; text?: never; } | { itemId: B10Int64Id; sequence: number; responseType: "MATCHING"; responseDigest: B10Sha256; pairs: readonly [B10MatchingPair, ...Array<B10MatchingPair>]; selectedOptionIds?: never; orderedTokenIds?: never; blanks?: never; text?: never; } | { itemId: B10Int64Id; sequence: number; responseType: "ORDERING"; responseDigest: B10Sha256; orderedTokenIds: readonly [string, ...Array<string>]; selectedOptionIds?: never; pairs?: never; blanks?: never; text?: never; } | { itemId: B10Int64Id; sequence: number; responseType: "CLOZE"; responseDigest: B10Sha256; blanks: readonly [B10ClozeEntry, ...Array<B10ClozeEntry>]; selectedOptionIds?: never; pairs?: never; orderedTokenIds?: never; text?: never; } | { itemId: B10Int64Id; sequence: number; responseType: "TEXT"; responseDigest: B10Sha256; text: string; selectedOptionIds?: never; pairs?: never; orderedTokenIds?: never; blanks?: never; } | { itemId: B10Int64Id; sequence: number; responseType: "UNANSWERED"; responseDigest: B10Sha256; selectedOptionIds?: never; pairs?: never; orderedTokenIds?: never; blanks?: never; text?: never; });

/**
 * Generated from the contract source.
 */
export type B10SubmitAttemptRequest = { expectedStateVersion: B10StateVersion; submissionId: string; submissionDigest: B10Sha256; items: readonly [B10AttemptSubmission, ...Array<B10AttemptSubmission>]; clientEventId?: string; };

/**
 * Assessment attempt lifecycle only. It does not own learning mastery, SRS, reward or progression state.
 */
export type B10Attempt = ({ attemptId: B10AttemptId; sessionId: B10SessionId; attemptVersion: number; status: B10AttemptStatus; itemCount: number; submissionDigest: B10Sha256; submissionId: string; pin: B10ActiveSessionAttemptPin; itemRulePins: readonly [B10AssessmentItemRulePin, ...Array<B10AssessmentItemRulePin>]; answerRuleSetVersion: B10RuleVersion; completionRuleVersion: B10RuleVersion; assessmentVersion?: B10RuleVersion; outcome?: B10AssessmentOutcome; createdAt: B10DateTime; assessedAt?: B10DateTime | null; reportId?: B10ReportId; rejectionCode?: string; }) & ({ status: "ACCEPTED" | "ASSESSING"; assessmentVersion?: never; outcome?: never; reportId?: never; assessedAt?: never; rejectionCode?: never; } | { assessmentVersion: B10RuleVersion; outcome: B10AssessmentOutcome; reportId: B10ReportId; status: "ASSESSED"; assessedAt: string; rejectionCode?: never; } | { rejectionCode: string; status: "REJECTED"; assessmentVersion?: never; outcome?: never; reportId?: never; assessedAt?: never; });

/**
 * Deprecated attempt-scoped checkpoint adapter request. New callers use B10AssessmentSessionCheckpointRequest.
 */
export type B10CheckpointRequest = { checkpointVersion: number; itemCursor: number; completedItemIds?: ReadonlyArray<B10Int64Id>; checkpointDigest: B10Sha256; };

/**
 * Deprecated attempt-scoped checkpoint adapter acknowledgement. It is not the canonical session checkpoint.
 */
export type B10Checkpoint = { attemptId: B10AttemptId; checkpointVersion: number; itemCursor: number; checkpointDigest: B10Sha256; savedAt: B10DateTime; };

/**
 * Versioned assessment report. It is bound to one session, attempt and submission, and never owns mastery/SRS facts.
 */
export type B10AssessmentReport = { reportId: B10ReportId; attemptId: B10AttemptId; sessionId: B10SessionId; attemptVersion: number; submissionId: string; submissionDigest: B10Sha256; reportVersion: number; reportRuleVersion: B10RuleVersion; assessmentVersion: B10RuleVersion; answerRuleSetVersion: B10RuleVersion; completionRuleVersion: B10RuleVersion; itemRulePins: readonly [B10AssessmentItemRulePin, ...Array<B10AssessmentItemRulePin>]; asOf: B10DateTime; assessmentFactWatermark: string; status: B10ReportStatus; outcome?: B10AssessmentOutcome; mistakeCodes?: ReadonlyArray<string>; pin: B10ActiveSessionAttemptPin; generatedAt: B10DateTime; replayable: true; partialReasonCodes?: readonly [string, ...Array<string>]; failureCode?: string; retryable?: boolean; } & ({ status: "GENERATING"; outcome?: never; mistakeCodes?: never; partialReasonCodes?: never; failureCode?: never; retryable?: never; } | { outcome: B10AssessmentOutcome; mistakeCodes: ReadonlyArray<string>; status: "READY"; partialReasonCodes?: never; failureCode?: never; retryable?: never; } | { outcome: B10AssessmentOutcome; partialReasonCodes: readonly [string, ...Array<string>]; status: "PARTIAL"; failureCode?: never; retryable?: never; } | { failureCode: string; retryable: boolean; status: "FAILED"; outcome?: never; mistakeCodes?: never; partialReasonCodes?: never; });

/**
 * Learning queue item. SRS stage, mistake-repair workflow state and mastery stage are independent server-owned projections.
 */
export type B10LearningQueueItem = { queueItemId: B10QueueItemId; itemId: B10Int64Id; source: "NEW" | "REVIEW" | "MISTAKE" | "RETRY"; srsStage: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; repairWorkflowState: "REVIEW_QUEUE" | "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REOPENED"; masteryStage: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; verificationStage: "IMMEDIATE_REPAIR" | "D1" | "D7"; dueAt: B10DateTime; priority: number; pin: B10ContentVersionPin; stateVersion: B10StateVersion; };

/**
 * Canonical public SRS review command. The server derives effective quality, SM2 state, repair transition and mastery projection; the client supplies only the observed review and immutable pin/concurrency facts.
 */
export type B10CompleteReviewRequest = { snapshotItemId: B10SnapshotId; sourceAssessmentAttemptId: B10AttemptId; baseStateVersion: B10StateVersion; clientEventId: string; clientSeq: number; contentPin: B10ReviewContentPin; payloadHash: B10Sha256; rawQuality: 0 | 1 | 2 | 3; clientOccurredAt: B10DateTime; responseTimeMs?: number; attemptNo?: number; };

/**
 * Learning-service mastery projection. SRS scheduling, repair verification and mastery are separate server-owned state machines.
 */
export type B10MasteryProjection = { itemId: B10Int64Id; srsStage: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; repairWorkflowState: "REVIEW_QUEUE" | "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REOPENED"; masteryStage: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; verificationStage?: "IMMEDIATE_REPAIR" | "D1" | "D7"; nextReviewAt?: B10DateTime | null; projectionVersion: B10ProjectionVersion; projectionStatus: "PENDING" | "APPLIED" | "RETRYING" | "COMPENSATED" | "MANUAL_REVIEW"; sourceAssessmentId?: B10AttemptId | null; sourceReviewEventId?: B10ReviewEventId | null; stateVersion: B10StateVersion; pin: B10ActiveSessionAttemptPin; projectedAt: B10DateTime; };

/**
 * Generated from the contract source.
 */
export type B10LearnerContentSnapshotResponse = { data: B10LearnerContentSnapshot; };

/**
 * Generated from the contract source.
 */
export type B10AssessmentContentSnapshotResponse = { data: B10AssessmentContentSnapshot; };

/**
 * Generated from the contract source.
 */
export type B10ContentRecoveryResponse = { data: B10ContentRecovery; };

/**
 * Generated from the contract source.
 */
export type B10AssessmentSessionResponse = { data: B10AssessmentSession; };

/**
 * Generated from the contract source.
 */
export type B10AttemptResponse = { data: B10Attempt; };

/**
 * Generated from the contract source.
 */
export type B10CheckpointResponse = { data: B10Checkpoint; };

/**
 * Generated from the contract source.
 */
export type B10AssessmentReportResponse = { data: B10AssessmentReport; };

/**
 * Generated from the contract source.
 */
export type B10ReviewQueueResponse = { items: ReadonlyArray<B10LearningQueueItem>; nextCursor: string | null; };

/**
 * Generated from the contract source.
 */
export type B10MasteryProjectionResponse = { data: B10MasteryProjection; };

/**
 * Compatibility error payload for existing media and notification operations. New or migrated operations use ApiError inside ApiErrorEnvelope.
 */
export type B11Error = { code: "unauthorized" | "forbidden" | "not_found" | "conflict" | "rights_revoked" | "range_invalid" | "storage_full"; message: string; retryable: boolean; };

/**
 * Generated from the contract source.
 */
export type B11CanonicalInt64Id = number;

/**
 * Generated from the contract source.
 */
export type B11Range = { start: number; endInclusive: number; totalBytes: number; };

/**
 * Generated from the contract source.
 */
export type B11MediaAsset = { assetId: string; contentVersionId: B11CanonicalInt64Id; mediaType: string; mimeType: string; checksumSha256: string; byteLength: number; durationMs?: number; assetVersion: number; rightsStatus: "PUBLISHED" | "RESTRICTED" | "EXPIRED" | "REVOKED"; storageStatus: "PROCESSING" | "READY" | "FAILED" | "REVOKED" | "DELETED"; };

/**
 * Generated from the contract source.
 */
export type B11MediaManifest = { assetId: string; assetVersion: number; manifestHash: string; contentVersionId: B11CanonicalInt64Id; items: ReadonlyArray<B11MediaManifestItem>; };

/**
 * Generated from the contract source.
 */
export type B11MediaManifestItem = { segmentId: string; renditionId: string; startMs: number; endMs: number; segmentHash: string; };

/**
 * Generated from the contract source.
 */
export type B11MediaAccessRequest = { renditionId: string; contentVersionId: B11CanonicalInt64Id; };

/**
 * Generated from the contract source.
 */
export type B11SignedMediaUrl = { assetId: string; renditionId: string; reference: string; expiresAt: string; checksumSha256: string; };

/**
 * Generated from the contract source.
 */
export type B11MediaContentRange = { assetId: string; renditionId: string; range: B11Range; reference: string; expiresAt: string; };

/**
 * Generated from the contract source.
 */
export type B11MediaRevocation = { reasonCode: string; expectedAssetVersion: number; rightsStatus: "REVOKED"; };

/**
 * Generated from the contract source.
 */
export type B11MediaMigration = { legacyManifestHash: string; targetManifestHash: string; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type B11NotificationPreference = { enabledChannels: ReadonlyArray<"IN_APP" | "EMAIL" | "PUSH">; learningReminders: boolean; marketing: boolean; version: number; expectedVersion: number; };

/**
 * Generated from the contract source.
 */
export type B11Message = { messageId: string; templateKey: string; templateVersion: string; locale: string; channel: "IN_APP" | "EMAIL" | "PUSH"; dedupeKey: string; createdAt: string; read: boolean; };

/**
 * Generated from the contract source.
 */
export type B11MessagePage = { items: ReadonlyArray<B11Message>; nextCursor: string; };

/**
 * Generated from the contract source.
 */
export type B11VectorClock = { cursor: string; vector: { [key: string]: number; }; version: number; };

/**
 * Generated from the contract source.
 */
export type B11SyncChange = { clientEventId: string; clientSeq: number; entityType: string; entityId: string; entityVersion: number; operation: "UPSERT" | "DELETE" | "APPEND"; payloadHash: string; contentVersion: string | number; occurredAt: string; };

/**
 * Generated from the contract source.
 */
export type B11SyncEnqueueRequest = { baseCursor: string; changes: ReadonlyArray<B11SyncChange>; };

/**
 * Generated from the contract source.
 */
export type B11SyncReceipt = { nextCursor: string; acceptedEventIds: ReadonlyArray<string>; conflicts: ReadonlyArray<B11SyncConflict>; };

/**
 * Generated from the contract source.
 */
export type B11SyncConflict = { conflictId: string; clientEventId: string; entityId: string; localVersion: number; serverVersion: number; resolutionCode: "SERVER_VERSION_WINS" | "CLIENT_RETRY_REQUIRED" | "MANUAL_RECOVERY"; reason: string; };

/**
 * Generated from the contract source.
 */
export type B11SyncConflictPage = { items: ReadonlyArray<B11SyncConflict>; nextCursor: string; };

/**
 * Generated from the contract source.
 */
export type B11SyncRecovery = { recoveryCode: string; retryable: boolean; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type B11RecordingMetadata = { recordingId: string; sourceSegmentId: string; durationMs: number; contentHash: string; storageMode: "LOCAL_ENCRYPTED" | "AUTHORIZED_OBJECT"; aiScoringAvailable: false; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B11MediaCompatibility = { legacyRefHash: string; targetRefHash: string; readOnly: true; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type B11OfflineCompatibility = { legacyEventHash: string; targetEventHash: string; readOnly: true; domainFactsUntouched: true; };

/**
 * Compatibility error payload for existing gamification, social and notification operations. New or migrated operations use ApiError inside ApiErrorEnvelope.
 */
export type B12Error = { code: "unauthorized" | "forbidden" | "not_found" | "conflict" | "invalid_command" | "feature_disabled" | "lease_expired" | "retry_exhausted" | "policy_denied"; retryable: boolean; requestId?: string; };

/**
 * Generated from the contract source.
 */
export type B12GrowthSummary = { subjectRef: string; level: number; serverScore: number; streakDays: number; currentSeason: string; featureEnabled: boolean; };

/**
 * Generated from the contract source.
 */
export type B12LedgerEntry = { entryId: string; kind: "SCORE" | "CURRENCY"; amount: number; ruleVersion: string; occurredAt: string; sourceEventId: string; };

/**
 * Generated from the contract source.
 */
export type B12LedgerPage = { items: ReadonlyArray<B12LedgerEntry>; nextCursor: string; conserved: boolean; };

/**
 * Generated from the contract source.
 */
export type B12RewardGrant = { grantId: string; rewardCode: string; state: "AVAILABLE" | "CLAIMED" | "EXPIRED" | "REVOKED"; probabilityVersion: string; issuedAt: string; expiresAt?: string | null; };

/**
 * Generated from the contract source.
 */
export type B12RewardPage = { items: ReadonlyArray<B12RewardGrant>; };

/**
 * Generated from the contract source.
 */
export type B12RewardProbability = { probabilityVersion: string; tiers: readonly [{ tierCode: string; basisPoints: number; }, ...Array<{ tierCode: string; basisPoints: number; }>]; disclosedAt: string; };

/**
 * Generated from the contract source.
 */
export type B12RewardClaimRequest = { commandCode: "CLAIM"; };

/**
 * Generated from the contract source.
 */
export type B12RewardClaimResult = { grantId: string; state: "CLAIMED" | "ALREADY_CLAIMED" | "REJECTED"; claimId: string; replayed: boolean; outcomeCode?: string | null; probabilityVersion?: string | null; };

/**
 * Generated from the contract source.
 */
export type B12TrustedCompletion = { sourceService: "learning-service" | "assessment-service"; eventId: string; traceId: string; schemaVersion: "v1" | "1" | "1.0" | "1.0.0"; occurredAt: string; subject: string | { id: string; }; aggregateId: string; ruleVersion: string; eventType: string; };

/**
 * Generated from the contract source.
 */
export type B12SettlementResult = { eventId: string; settlementState: "APPLIED" | "DUPLICATE" | "REJECTED"; ledgerEntryId: string; replayed: boolean; };

/**
 * Generated from the contract source.
 */
export type B12RoomCommand = { clientEpoch?: number; leaseVersion?: number; };

/**
 * Generated from the contract source.
 */
export type B12RoomState = { roomId: string; seatState: "ACTIVE" | "DISCONNECTED" | "RECOVERED" | "EXPIRED" | "LEFT"; leaseVersion: number; visibleMemberCount: number; };

/**
 * Generated from the contract source.
 */
export type B12FocusCommand = { durationMinutes?: number; focusTagCode?: "VOCABULARY" | "LISTENING" | "READING" | "GRAMMAR" | "SPEAKING" | "WRITING"; clientEventId?: string; };

/**
 * Generated from the contract source.
 */
export type B12FocusSession = { focusId: string; roomId: string; seatIndex: number; state: "FOCUSING" | "PAUSED" | "COMPLETE" | "AUTO_RELEASED" | "INVALID"; durationMinutes: number; startedAt: string; };

/**
 * Generated from the contract source.
 */
export type B12PresetInteraction = { presetCode: "CHEER_UP" | "STUDY_TOGETHER" | "CONGRATS" | "TRY_AGAIN" | "TONIGHT_20_MIN"; targetSeatIndex?: number; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B12InteractionResult = { eventId: string; roomId: string; presetCode: string; targetSeatIndex?: number; state: "DELIVERED"; deliveredAt: string; };

/**
 * Generated from the contract source.
 */
export type B12LeaderboardEntry = { rank: number; displayMode: "SELF" | "NICKNAME" | "ANONYMOUS" | "DEIDENTIFIED"; displayName?: string | null; score: number; qualifiedUnits: number; sourceWatermark?: string | null; isSelf: boolean; targetSeatIndex?: number; };

/**
 * Generated from the contract source.
 */
export type B12Leaderboard = { kind: "FOCUS_MINUTES" | "MASTERED_WORDS" | "XP"; period: "DAY" | "WEEK"; periodStart: string; periodEnd: string; timeZone: string; projectionState: "DELAYED" | "PROVISIONAL" | "PUBLISHED" | "FROZEN"; dataFreshness: "DELAYED" | "CURRENT"; delayed: boolean; asOf?: string | null; snapshotVersion: number; entries: ReadonlyArray<B12LeaderboardEntry>; me: { present: boolean; visibility: string; score?: number; qualifiedUnits?: number; }; sourceWatermark: string | null; roomId?: string; };

/**
 * Generated from the contract source.
 */
export type B12VisibilityCommand = { leaderboardVisibility?: "NICKNAME" | "ANONYMOUS" | "OPT_OUT"; roomVisibility?: "PUBLIC" | "ANONYMOUS" | "PRIVATE"; };

/**
 * Generated from the contract source.
 */
export type B12Visibility = { leaderboardVisibility: string; roomVisibility: string; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B12ReportCommand = { targetSeatIndex: number; reasonCode: "SPAM" | "HARASSMENT" | "SENSITIVE_CONTENT" | "IMPERSONATION" | "OTHER"; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B12Report = { reportId: string; roomId: string; targetSeatIndex: number; reasonCode: string; status: "RECEIVED" | "TRIAGED" | "ACTIONED" | "REJECTED" | "APPEALED" | "CLOSED"; reviewMode: "MANUAL"; createdAt: string; updatedAt: string; clientEventId: string; idempotentReplay?: boolean; };

/**
 * Generated from the contract source.
 */
export type B12TrustedSocialEvent = { eventId: string; traceId: string; schemaVersion: string; eventType: "learning.activity.v1" | "learning.focus.qualified.v1" | "learning.focus_completed.v1" | "learning.mastery.reached.v1" | "learning.mastery_reached.v1" | "gamification.xp.ledger_posted.v1" | "leaderboard.refreshed.v1" | "leaderboard.frozen.v1"; sourceService: "learning-service" | "gamification-service" | "workflow-service" | "social-workflow"; subjectId: string; occurredAt: string; payload: Record<string, never>; };

/**
 * Generated from the contract source.
 */
export type B12NotificationTrustedEvent = { eventId: string; eventName: string; schema: string; version: number; occurredAt: string; aggregateType: string; aggregateId: string; actorId: string; traceId: string; requestId: string; schemaVersion: string; dedupeKey: string; principalId: string; templateId?: string; locale?: string; channel?: "IN_APP" | "PUSH" | "EMAIL"; notBefore?: string; attributes?: { [key: string]: string; }; };

/**
 * Generated from the contract source.
 */
export type B12EventReceipt = { eventId: string; state: "ACCEPTED" | "DUPLICATE" | "REJECTED"; replayed: boolean; };

/**
 * Generated from the contract source.
 */
export type B12RetryCommand = { taskId: string; };

/**
 * Generated from the contract source.
 */
export type B12RetryResult = { taskId: string; status: "DELAYED" | "DELIVERED" | "RETRY_SCHEDULED" | "DEAD_LETTER" | "CANCELLED" | "TERMINAL"; delivery?: Record<string, never>; workflow: { taskId: string; action: string; aggregateType: string; aggregateId: string; state: string; attempt: number; maxAttempts: number; reasonCode?: string | null; nextRunAt: string; updatedAt: string; }; reasonCode?: string | null; nextAttemptAt: string | null; };

/**
 * Generated from the contract source.
 */
export type B12RecoveryCommand = { taskId: string; action: "RETRY" | "REPLAY" | "CANCEL" | "MANUAL_REVIEW"; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type B12RecoveryResult = { taskId: string; action: "RETRY" | "REPLAY" | "CANCEL" | "MANUAL_REVIEW"; state: string; reasonCode: string; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B12ModerationCommand = { commandCode: "START_REVIEW" | "RESOLVE" | "DISMISS" | "ESCALATE"; };

/**
 * Generated from the contract source.
 */
export type B12ReportPage = { items: ReadonlyArray<B12Report>; };

/**
 * Generated from the contract source.
 */
export type B12RecoveryPage = { items: ReadonlyArray<B12RecoveryResult>; };

/**
 * Generated from the contract source.
 */
export type B12NotificationPreference = { notificationType: string; channel: "IN_APP" | "PUSH" | "EMAIL"; enabled: boolean; locale: string; version: number; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B12NotificationPreferenceCommand = { enabled: boolean; locale: string; expectedVersion?: number; };

/**
 * Generated from the contract source.
 */
export type B12NotificationMessage = { messageId: string; notificationType: string; channel: "IN_APP" | "PUSH" | "EMAIL"; title: string; safeBody: string; contentVersion: string; createdAt: string; read: boolean; };

/**
 * Compatibility error payload for existing commerce, admin and analytics operations. New or migrated operations use ApiError inside ApiErrorEnvelope.
 */
export type B13Problem = { code: string; message: string; traceRef: string; };

/**
 * Generated from the contract source.
 */
export type B13Sku = { skuId: string; title: string; description: string; billingPeriod: "ONE_TIME" | "MONTH" | "QUARTER" | "YEAR"; currency: string; amountMinor: number; availability: "PUBLISHED" | "COMING_SOON" | "UNAVAILABLE"; entitlementCode: string; priceSnapshotId: string; };

/**
 * Generated from the contract source.
 */
export type B13PublicCatalog = { catalogVersion: string; uiLocale: string; contentLocale: string; plans: ReadonlyArray<B13PublicPlan>; publishedAt: string | null; checkoutPath: string; };

/**
 * Generated from the contract source.
 */
export type B13PublicPlan = { planId: string; name: string; displayPrice: string; unit: string; features: readonly [] | readonly [string] | readonly [string, string] | readonly [string, string, string] | readonly [string, string, string, string] | readonly [string, string, string, string, string] | readonly [string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string, string]; availability: "available" | "coming-soon" | "unavailable"; entitlementCode: string; };

/**
 * Generated from the contract source.
 */
export type B13Entitlement = { entitlementId: string; entitlementCode: string; state: "PENDING" | "ACTIVE" | "GRACE" | "EXPIRED" | "REVOKED"; startsAt: string; expiresAt: string; sourceRef: string; };

/**
 * Generated from the contract source.
 */
export type B13Order = { orderId: string; skuId: string; priceSnapshotId: string; state: "PENDING_PAYMENT" | "PAYMENT_PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUND_PENDING" | "REFUNDED" | "EXPIRED"; currency: string; amountMinor: number; channel: "WECHAT" | "ALIPAY" | "APPLE" | "SANDBOX"; createdAt: string; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B13OrderPage = { items: ReadonlyArray<B13Order>; nextCursor: string | null; };

/**
 * Generated from the contract source.
 */
export type B13OrderCreateRequest = { skuId: string; priceSnapshotId: string; channel: "WECHAT" | "ALIPAY" | "APPLE" | "SANDBOX"; sourcePlatform: "MOBILE" | "WEB" | "PWA"; region?: string | null; };

/**
 * Generated from the contract source.
 */
export type B13PaymentReadiness = { enabled: boolean; reasonCode: string; providers: ReadonlyArray<B13ProviderReadiness>; };

/**
 * Generated from the contract source.
 */
export type B13ProviderReadiness = { provider: string; enabled: boolean; sandbox: boolean; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type B13PaymentIntentRequest = { provider: "WECHAT" | "ALIPAY" | "APPLE" | "SANDBOX"; };

/**
 * Generated from the contract source.
 */
export type B13PaymentIntentResult = { orderId: string; state: string; provider: string; payable: boolean; reasonCode: string; intentRef?: string | null; };

/**
 * Generated from the contract source.
 */
export type B13RefundRequest = { reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type B13Refund = { refundId: string; orderId: string; state: "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "REJECTED"; reasonCode: string; createdAt: string; };

/**
 * Generated from the contract source.
 */
export type B13ActivationRedeemRequest = { code: string; };

/**
 * Generated from the contract source.
 */
export type B13ProviderCallback = { providerEventRef: string; orderRef: string; callbackState: "VERIFIED_PAID" | "VERIFIED_REFUNDED" | "REJECTED"; amountMinor: number; currency: string; occurredAt: string; verificationRef: string; };

/**
 * Generated from the contract source.
 */
export type B13CallbackResult = { providerEventRef: string; state: "ACCEPTED" | "REPLAYED" | "REJECTED"; replayed: boolean; entitlementActivated: boolean; reasonCode?: string | null; };

/**
 * Generated from the contract source.
 */
export type B13ReconciliationRequest = { batchRef: string; provider: string; windowStart: string; windowEnd: string; };

/**
 * Generated from the contract source.
 */
export type B13ReconciliationResult = { batchRef: string; state: "ACCEPTED" | "REPLAYED" | "FAILED"; replayed: boolean; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type B13AdminOrderView = { orderRef: string; state: string; amountMinor: number; currency: string; createdAt: string; redactionVersion: string; };

/**
 * Generated from the contract source.
 */
export type B13AdminOrderPage = { items: ReadonlyArray<B13AdminOrderView>; nextCursor: string | null; };

/**
 * Generated from the contract source.
 */
export type B13SupportTicketCreateRequest = { categoryCode: string; resourceRef: string; descriptionFingerprint: string; priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"; attachments?: readonly [] | readonly [B13MediaObjectRef] | readonly [B13MediaObjectRef, B13MediaObjectRef] | readonly [B13MediaObjectRef, B13MediaObjectRef, B13MediaObjectRef] | readonly [B13MediaObjectRef, B13MediaObjectRef, B13MediaObjectRef, B13MediaObjectRef] | readonly [B13MediaObjectRef, B13MediaObjectRef, B13MediaObjectRef, B13MediaObjectRef, B13MediaObjectRef]; };

/**
 * Generated from the contract source.
 */
export type B13SupportTicket = { ticketId: string; categoryCode: string; state: "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED"; priority: string; slaDueAt: string; redactionVersion: string; };

/**
 * Generated from the contract source.
 */
export type B13SupportTicketPage = { items: ReadonlyArray<B13SupportTicket>; nextCursor: string | null; };

/**
 * Generated from the contract source.
 */
export type B13AdminCommandRequest = { aggregateType: string; aggregateRef: string; actionCode: string; reasonCode: string; confirmationRef?: string | null; };

/**
 * Generated from the contract source.
 */
export type B13CommandConfirmation = { confirmationRef: string; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type B13AdminCommandResult = { commandId: string; state: "PENDING_APPROVAL" | "CONFIRMED" | "FORWARDED" | "REJECTED" | "COMPLETED"; approvalRequired: boolean; auditRef: string; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type B13MetricProjection = { metricCode: string; metricVersion: string; periodStart: string; periodEnd: string; value: number; state: "READY" | "STALE" | "RECOMPUTING" | "UNAVAILABLE"; generatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B13AnalyticsEvent = { eventId: string; eventName: string; schemaVersion: string; aggregateType: string; aggregateRef: string; occurredAt: string; redactionVersion: string; dimensions: readonly [] | readonly [B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension, B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension] | readonly [B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension, B13MetricDimension]; };

/**
 * Generated from the contract source.
 */
export type B13MetricDimension = { key: string; value: string; };

/**
 * Generated from the contract source.
 */
export type B13AnalyticsReceipt = { eventId: string; state: "ACCEPTED" | "REPLAYED" | "REJECTED"; replayed: boolean; redactionVersion: string; };

/**
 * Generated from the contract source.
 */
export type B13RecomputeRequest = { metricCode: string; metricVersion: string; windowStart: string; windowEnd: string; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type B13RecomputeJob = { jobId: string; metricCode: string; state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED"; replayed: boolean; requestedAt: string; };

/**
 * Generated from the contract source.
 */
export type B25DataEnvelope = { source?: "mysql"; data?: unknown; [key: string]: unknown; };

/**
 * Generated from the contract source.
 */
export type B25ReplayEvidence = { idempotencyKey: string; firstResult: unknown; replayResult: unknown; sameDigest?: boolean; };

/**
 * Generated from the contract source.
 */
export type B12FocusUpdateCommand = { focusId: string; action: "PAUSE" | "RESUME" | "FINISH" | "ABORT"; clientEventId?: string; };

/**
 * Generated from the contract source.
 */
export type B13MediaObjectRef = { objectRef: string; objectVersion: string; purposeCode: string; contentType: string; sizeBytes: number; };

/**
 * Generated from the contract source.
 */
export type B13CommandPreparation = { token: string; decisionId: string; action: string; resourceRef: string; expiresAt: string; };

/**
 * Generated from the contract source.
 */
export type B13AuditRecord = { auditId: string; operation: string; resourceRef: string; commandId: string; traceId: string; decisionId: string; occurredAt: string; redacted: true; };

/**
 * Generated from the contract source.
 */
export type B13AuditPage = { items: ReadonlyArray<B13AuditRecord>; redacted: true; };

/**
 * Generated from the contract source.
 */
export type B11MediaProgressRequest = { assetId: string; sessionId?: string | null; positionMs: number; durationMs: number; contentVersion: string | number; entityVersion: number; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type B11MediaProgressReceipt = { assetId: string; sessionId?: string | null; positionMs: number; durationMs: number; entityVersion: number; status: "RECORDED"; source: "mysql"; };

/**
 * Generated from the contract source.
 */
export type B11ShadowingCompletionRequest = { recordingId?: string | null; sourceSegmentId: string; contentVersion: string | number; contentVersionId?: string | number; clientEventId: string; aiScoringAvailable?: false; };

/**
 * Generated from the contract source.
 */
export type B11ShadowingCompletionReceipt = { recordingId?: string | null; sourceSegmentId: string; contentVersion: string | number; status: "RECORDED"; aiScoringAvailable: false; source: "mysql"; };

/**
 * Generated from the contract source.
 */
export type B25EnsureDailyTaskRequest = { contentCode: string; title: string; minutes?: number; };

/**
 * Generated from the contract source.
 */
export type B8RegisterRequest = { identifier: string; password: string; device: B8DeviceInput; } & (B8WebRegisterRequest | B8NativeRegisterRequest);

/**
 * Generated from the contract source.
 */
export type B8LoginRequest = { identifier: string; password: string; device: B8DeviceInput; } & (B8WebLoginRequest | B8NativeLoginRequest);

/**
 * Generated from the contract source.
 */
export type B8RefreshRequest = { refreshToken?: string; deviceId?: string; } & (B8WebRefreshRequest | B8NativeRefreshRequest);

/**
 * Generated from the contract source.
 */
export type B8LogoutRequest = { allDevices?: boolean; };

/**
 * Generated from the contract source.
 */
export type B8PasswordResetRequest = { identifier: string; };

/**
 * Generated from the contract source.
 */
export type B8PasswordResetConfirmRequest = { identifier: string; resetToken: string; newPassword: string; };

/**
 * Generated from the contract source.
 */
export type B8AuthTokenResponse = { accessToken: string; refreshToken?: string; authTransport?: "WEB_COOKIE" | "NATIVE_SECURE_STORAGE"; tokenType: "Bearer"; expiresIn: number; refreshExpiresIn: number; sessionId: string; deviceId: string; };

/**
 * Generated from the contract source.
 */
export type B8DeviceInput = { deviceId?: string; deviceType: "IOS" | "ANDROID" | "WEB" | "H5" | "IPAD"; deviceName?: string; osVersion?: string; clientVersion: string; };

/**
 * Generated from the contract source.
 */
export type B4GameCatalogItem = { gameCode: "SENTENCE_TRAIN" | "WORD_MATCH" | "WORD_DEFENSE" | "WORD_PUZZLE" | "GRAMMAR_BLASTER" | "CATCH_MEANING"; releasePhase: "P0" | "P1" | "LONG_TERM"; enabled: boolean; maxMinutes?: number; pauseLimitMinutes?: number; passAccuracyPercent?: number; passCompletionPercent?: number; };

/**
 * Mandatory response metadata for newly created or migrated public operations. requestId and traceId are also returned as response headers.
 */
export type ApiResponseMeta = { requestId: RequestId; traceId: TraceId; apiVersion: ApiVersion; schemaVersion: SemanticVersion; serverTime: DateTime; };

/**
 * Cursor pagination metadata for every active list* operation and any other active operation declaring Cursor. nextCursor is null when there is no next page; hasMore must agree with nextCursor; cursor state must not be duplicated in data.
 */
export type ApiCursorPageMeta = { requestId: RequestId; traceId: TraceId; apiVersion: ApiVersion; schemaVersion: SemanticVersion; serverTime: DateTime; nextCursor?: Cursor | null; snapshotAt?: DateTime | null; hasMore: boolean; pageSize: PageSize; };

/**
 * Generated from the contract source.
 */
export type ApiSuccessEnvelope = { data: unknown; meta: ApiResponseMeta; };

/**
 * Generated from the contract source.
 */
export type ApiCursorPageEnvelope = { data: unknown; meta: ApiCursorPageMeta; };

/**
 * Generated from the contract source.
 */
export type ApiErrorEnvelope = { error: ApiError; meta: ApiResponseMeta; };

/**
 * WEB_COOKIE request device boundary for browser Web and mobile H5. The server derives authorization facts independently of this device declaration.
 */
export type B8WebDeviceInput = B8DeviceInput & ({ deviceType: "WEB" | "H5"; });

/**
 * NATIVE_SECURE_STORAGE request device boundary for iOS, Android and native iPad runtimes. The server derives authorization facts independently of this device declaration.
 */
export type B8NativeDeviceInput = B8DeviceInput & ({ deviceType: "IOS" | "ANDROID" | "IPAD"; });

/**
 * Generated from the contract source.
 */
export type B8WebRegisterRequest = { identifier: string; password: string; device: B8WebDeviceInput; };

/**
 * Generated from the contract source.
 */
export type B8NativeRegisterRequest = { identifier: string; password: string; device: B8NativeDeviceInput; };

/**
 * Generated from the contract source.
 */
export type B8WebLoginRequest = { identifier: string; password: string; device: B8WebDeviceInput; };

/**
 * Generated from the contract source.
 */
export type B8NativeLoginRequest = { identifier: string; password: string; device: B8NativeDeviceInput; };

/**
 * WEB_COOKIE refresh input. The opaque Refresh Token is sent only by the HttpOnly; Secure; SameSite cookie; JSON must not contain refreshToken.
 */
export type B8WebRefreshRequest = Record<string, never>;

/**
 * Generated from the contract source.
 */
export type B8NativeRefreshRequest = { refreshToken: string; deviceId?: string; };

/**
 * WEB_COOKIE authentication result. Refresh Token is intentionally absent from JSON and is returned only by the HttpOnly; Secure; SameSite Set-Cookie header.
 */
export type B8WebAuthTokenResponse = { authTransport: "WEB_COOKIE"; accessToken: string; tokenType: "Bearer"; expiresIn: number; refreshExpiresIn: number; sessionId: string; deviceId: string; };

/**
 * NATIVE_SECURE_STORAGE authentication result. The explicit Refresh Token is required and may only be written to Keychain or Keystore; all ordinary storage and plaintext fallbacks are prohibited.
 */
export type B8NativeAuthTokenResponse = { authTransport: "NATIVE_SECURE_STORAGE"; accessToken: string; refreshToken: string; tokenType: "Bearer"; expiresIn: number; refreshExpiresIn: number; sessionId: string; deviceId: string; };

/**
 * Canonical ApiSuccessEnvelope with an explicitly transport-discriminated authentication data payload.
 */
export type B8AuthTokenEnvelope = ApiSuccessEnvelope & ({ data: B8WebAuthTokenResponse | B8NativeAuthTokenResponse; });

/**
 * Generated from the contract source.
 */
export type B8ServerDerivedSubject = { subjectId: string; source: "IAM_VALIDATED_JWT_AND_SESSION"; derivedAt: string; };

/**
 * Generated from the contract source.
 */
export type B8ServerDerivedTenant = { tenantId: string; provenance: "IAM_PLATFORM_TENANT" | "IAM_VALIDATED_TENANT_SCOPE"; derivedAt: string; };

/**
 * Generated from the contract source.
 */
export type B8PhaseAccessContext = { currentPhase: "P1"; learningAccess: "ELIGIBLE" | "RESTRICTED"; provenance: "IAM_SERVER_DERIVED_PHASE_GATE"; };

/**
 * Generated from the contract source.
 */
export type B8DeviceTrustContext = { deviceId: string; trustLevel: "REGISTERED" | "VERIFIED" | "RESTRICTED"; sessionStatus: "ACTIVE" | "REVOKED" | "REVOCATION_UNCERTAIN"; provenance: "IAM_SERVER_OWNED_DEVICE_AND_SESSION"; evaluatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B8PolicyVersionContext = { policyVersionId?: string; version: string; status: "ACTIVE" | "SUPERSEDED" | "REVOKED" | "EXPIRED"; effectiveAt: string; revocationState: "NOT_REVOKED" | "REVOKED" | "REVOCATION_UNCERTAIN"; provenance: "IAM_ACTIVE_POLICY_CONTROL_PLANE"; };

/**
 * Generated from the contract source.
 */
export type B8AuthorityProvenance = { authority: "IAM_SERVER_DERIVED"; derivedAt: string; jwtValidation: "VALIDATED_IAM_RS256_JWT"; tenantSource: "IAM_SERVER_DERIVED_TENANT"; rolePermissionSource: "IAM_ROLE_PERMISSION_ASSIGNMENTS"; policySource: "IAM_ACTIVE_VERSIONED_POLICY"; revocationState: "CONFIRMED_NOT_REVOKED" | "REVOKED" | "UNCERTAIN_FAIL_CLOSED"; };

/**
 * Generated from the contract source.
 */
export type B8RevalidationRequirement = { status: "CURRENT" | "REVALIDATION_REQUIRED" | "EXPIRED" | "REVOKED"; required: boolean; evaluatedAt: string; dueAt?: string; reasonCodes?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B8AdultGateEvaluationProvenance = { authority: "IAM_SERVER_DERIVED"; evaluator: "iam-service"; evidenceSource: "SERVER_RECOGNIZED_EVIDENCE" | "CLIENT_ASSERTION_PENDING_SERVER_EVALUATION" | "NO_USABLE_EVIDENCE"; evaluatedAt: string; rawEvidenceReturned: false; };

/**
 * Generated from the contract source.
 */
export type B8ConsentDocument = { version: string; digest: string; publishedAt: string; };

/**
 * Generated from the contract source.
 */
export type B8ConsentWithdrawalEffect = { effect: "NO_ACTION" | "RESTRICT_PROTECTED_CAPABILITY" | "RESTRICT_ALL_LEARNING_ACCESS" | "REVOKE_SENSITIVE_SESSION_SCOPE"; appliesAt: string; cacheInvalidationRequired: boolean; affectedCapabilities?: ReadonlyArray<"ACCOUNT" | "LEARNING" | "ANALYTICS" | "VOICE_REMOTE_PROCESS" | "VOICE_REMOTE_RECORD" | "VOICE_REMOTE_REPLAY" | "VOICE_REMOTE_UPLOAD">; sessionEffect?: "UNCHANGED" | "REVOKE_ALL_SESSIONS"; accountEffect?: "RETAINED"; historyEffect?: "RETAINED"; };

/**
 * Generated from the contract source.
 */
export type B8ConsentProvenance = { authority: "IAM_SERVER_RECORDED_CONSENT"; recordedAt: string; documentSource: "PUBLISHED_DOCUMENT_VERSION_AND_DIGEST"; policySource: "IAM_ACTIVE_POLICY_CONTROL_PLANE"; };

/**
 * Generated from the contract source.
 */
export type B8AuditLink = { auditId: string; decisionId?: string; requestId: string; traceId: string; recordedAt: string; };

/**
 * Generated from the contract source.
 */
export type B8AuthorizationEnforcement = { defaultDecision: "DENY"; failureMode: "FAIL_CLOSED"; localPepRequired: true; decisionSource: "LOCAL_PEP" | "REMOTE_PDP"; };

/**
 * Generated from the contract source.
 */
export type B8PdpPrincipalContext = { subject: B8ServerDerivedSubject; tenant: B8ServerDerivedTenant; roles: ReadonlyArray<string>; permissions: ReadonlyArray<string>; phase: B8PhaseAccessContext; adultGate: B8PdpAdultGateContext; consent: B8PdpConsentContext; deviceTrust: B8DeviceTrustContext; authorityProvenance: B8AuthorityProvenance; };

/**
 * Generated from the contract source.
 */
export type B8PdpResourceContext = { resourceType: string; resourceId: string; owner: { ownerId: string; provenance: "RESOURCE_OWNER_SERVICE"; }; tenant: B8ServerDerivedTenant; phase: "P1" | "P2" | "P3"; contentRights: "VALID" | "NOT_APPLICABLE" | "EXPIRED" | "REVOKED" | "UNCERTAIN"; provenance: { ownerService: string; resolvedAt: string; factDigest: string; }; };

/**
 * Generated from the contract source.
 */
export type B8PdpPolicyContext = { policy: B8PolicyVersionContext; bundleVersion: string; cacheState: "CURRENT" | "MISS" | "EXPIRED" | "INVALIDATED"; revocationState: "CONFIRMED_NOT_REVOKED" | "REVOKED" | "UNCERTAIN_FAIL_CLOSED"; };

/**
 * Generated from the contract source.
 */
export type B8TrustedServiceIdentityContext = { serviceId: string; credentialBinding: "VALIDATED_SERVICE_JWT_BOUND_TO_PEP"; audience: string; authenticatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B8PdpAuthorizationDecisionRequest = { invocationReason: "HIGH_RISK_OPERATION" | "DYNAMIC_POLICY" | "SECURITY_CACHE_MISS"; action: string; principal: B8PdpPrincipalContext; resource: B8PdpResourceContext; policy: B8PdpPolicyContext; serviceIdentity: B8TrustedServiceIdentityContext; };

/**
 * Generated from the contract source.
 */
export type B8AuthorizationDecisionEnvelope = ApiSuccessEnvelope & { data: B8PdpAuthorizationDecisionResponse; };

/**
 * Versioned RBAC binding. It becomes authoritative only after independent approval and activation of the containing policy version; request payloads never change the caller's current authority.
 */
export type B8RolePermissionBinding = { roleCode: string; permissions: readonly [string, ...Array<string>]; assignmentScope: "SERVER_DERIVED_PLATFORM_TENANT" | "SERVER_DERIVED_RESOURCE_TENANT"; };

/**
 * Generated from the contract source.
 */
export type B8PolicyRule = { effect: "ALLOW" | "DENY"; requiredPermissions: readonly [string, ...Array<string>]; actions: readonly [string, ...Array<string>]; resourceTypes: readonly [string, ...Array<string>]; conditions: { phases?: ReadonlyArray<"P1" | "P2" | "P3">; requiresAdultEligibility?: boolean; requiredConsentPurposes?: ReadonlyArray<string>; minimumDeviceTrust?: "REGISTERED" | "VERIFIED"; contentRights?: ReadonlyArray<"VALID" | "NOT_APPLICABLE">; ownerMatchRequired?: boolean; tenantMatchRequired?: boolean; }; };

/**
 * Generated from the contract source.
 */
export type B8PolicyDocument = { name: string; description?: string; roleBindings: readonly [B8RolePermissionBinding, ...Array<B8RolePermissionBinding>]; rules: readonly [B8PolicyRule, ...Array<B8PolicyRule>]; };

/**
 * Generated from the contract source.
 */
export type B8PolicyCacheInvalidationReceipt = { invalidationId?: string; required: boolean; status: "NOT_REQUIRED" | "PENDING" | "COMPLETED" | "FAILED"; scope: "NONE" | "POLICY_VERSION" | "AFFECTED_PEP_SECURITY_CACHES" | "REVOCATION_AND_AFFECTED_PEP_SECURITY_CACHES"; issuedAt: string; completedAt?: string; denyUntilCurrentVersionProven: true; };

/**
 * Generated from the contract source.
 */
export type B8PolicyVersion = { policyVersionId: string; version: string; status: "DRAFT" | "SUBMITTED" | "APPROVED" | "ACTIVE" | "REVOKED"; revision: number; tenant: B8ServerDerivedTenant; document: B8PolicyDocument; artifactDigest: string; createdAt: string; updatedAt: string; createdBy: B8ServerDerivedSubject; submittedBy?: B8ServerDerivedSubject; approvedBy?: B8ServerDerivedSubject; activatedBy?: B8ServerDerivedSubject; revokedBy?: B8ServerDerivedSubject; separationOfDuties: { independentApprovalRequired: true; authorMayApprove: false; submitterMayApprove: false; satisfied: boolean; }; auditLinks: readonly [B8AuditLink, ...Array<B8AuditLink>]; cacheInvalidation: B8PolicyCacheInvalidationReceipt; };

/**
 * Generated from the contract source.
 */
export type B8PolicyDraftCreateRequest = { policyDocument: B8PolicyDocument; changeReason: string; };

/**
 * Generated from the contract source.
 */
export type B8PolicyDraftUpdateRequest = { expectedRevision: number; policyDocument: B8PolicyDocument; changeReason: string; };

/**
 * Generated from the contract source.
 */
export type B8PolicySubmitRequest = { expectedRevision: number; submissionReason: string; };

/**
 * Generated from the contract source.
 */
export type B8PolicyApprovalRequest = { expectedRevision: number; approvalNote: string; };

/**
 * Generated from the contract source.
 */
export type B8PolicyActivationRequest = { expectedRevision: number; activationReason: string; };

/**
 * Generated from the contract source.
 */
export type B8PolicyRevocationRequest = { expectedRevision: number; revocationReason: string; };

/**
 * Generated from the contract source.
 */
export type B8PolicyMutationResult = { policy: B8PolicyVersion; auditLink: B8AuditLink; cacheInvalidation: B8PolicyCacheInvalidationReceipt; };

/**
 * Generated from the contract source.
 */
export type B8PolicyVersionEnvelope = ApiSuccessEnvelope & { data: B8PolicyVersion; };

/**
 * Generated from the contract source.
 */
export type B8PolicyVersionMutationEnvelope = ApiSuccessEnvelope & { data: B8PolicyMutationResult; };

/**
 * Generated from the contract source.
 */
export type B8PolicyVersionListEnvelope = ApiCursorPageEnvelope & { data: { items: ReadonlyArray<B8PolicyVersion>; }; };

/**
 * Generated from the contract source.
 */
export type B8PolicyBundle = { bundleId: string; policy: B8PolicyVersionContext; policyDocument: B8PolicyDocument; issuedAt: string; expiresAt: string; cacheMaxAgeSeconds: number; revocationState: "CONFIRMED_NOT_REVOKED" | "REVOKED" | "UNCERTAIN_FAIL_CLOSED"; provenance: "IAM_SIGNED_VERSIONED_POLICY_BUNDLE"; };

/**
 * Generated from the contract source.
 */
export type B8PolicyBundleEnvelope = ApiSuccessEnvelope & { data: B8PolicyBundle; };

/**
 * Strict server-authoritative adult context required by the new PDP. The legacy public response keeps its historical required set for additive client compatibility.
 */
export type B8PdpAdultGateContext = B8AdultGateResponse & Record<string, never>;

/**
 * Strict required-consent context used by the new PDP; absent or stale facts are denied.
 */
export type B8PdpConsentContext = B8ConsentState & Record<string, never>;

/**
 * Strict decision payload for the new PDP; compatibility clients may continue reading the legacy decision schema during migration.
 */
export type B8PdpAuthorizationDecisionResponse = B8AuthorizationDecisionResponse & Record<string, never>;

/**
 * 排期发布的乐观绑定快照。客户端只能提交版本、校验报告、双审记录和版权快照的引用及版本；content-service 必须在接收时和到期执行时重新核对 owner facts，绑定字段本身不是授权或运行时事实。
 */
export type B9PublishScheduleInput = { contentVersionId: B9ContentVersionId; contentHash: string; validationReportId: B9ContentValidationReportId; validationReportVersion: B9EvidenceVersion; firstReviewVersion: B9EvidenceVersion; finalReviewVersion: B9EvidenceVersion; rightsSnapshotId: B9RightsSnapshotId; rightsSnapshotVersion: B9EvidenceVersion; scheduledAt: B9OffsetDateTime; displayTimeZone: B9DisplayTimeZone; };

/**
 * 服务端只读的排期发布任务。客户端不能提交、伪造或推进 status，也不能把任务状态当作运行时发布证明；处理、重试、失败和恢复沿用 M1-007 recovery 契约，不在 B9 复制第二套处理状态机。
 */
export type B9ScheduledPublishTask = ({ taskId: B9ScheduledPublishTaskId; commandId: string; requestId: string; traceId: string; contentCode: B9ContentCode; contentVersionId: B9ContentVersionId; contentHash: string; validationReportId: B9ContentValidationReportId; validationReportVersion: B9EvidenceVersion; firstReviewVersion: B9EvidenceVersion; finalReviewVersion: B9EvidenceVersion; rightsSnapshotId: B9RightsSnapshotId; rightsSnapshotVersion: B9EvidenceVersion; scheduledAt: B9OffsetDateTime; displayTimeZone: B9DisplayTimeZone; stateVersion: B9StateVersion; auditId: B9AuditId; status: "SCHEDULED" | "CANCELLED" | "EXECUTED" | "INVALIDATED" | "RECOVERY_REQUIRED"; createdAt: B9DateTime; updatedAt: B9DateTime; startedAt?: B9DateTime; completedAt?: B9DateTime; failureCode?: string; recoveryTaskId?: string; }) & ({ status: "SCHEDULED"; completedAt?: never; failureCode?: never; recoveryTaskId?: never; } | { completedAt: B9DateTime; status: "CANCELLED"; recoveryTaskId?: never; } | { completedAt: B9DateTime; status: "EXECUTED"; failureCode?: never; recoveryTaskId?: never; } | { failureCode: string; completedAt: B9DateTime; status: "INVALIDATED"; recoveryTaskId?: never; } | { failureCode: string; recoveryTaskId: string; status: "RECOVERY_REQUIRED"; });

/**
 * 命令受理或后台状态中的排期任务只读引用。处理、重试和失败恢复由 M1-007 recovery 负责，不在此引用复制第二套状态机。
 */
export type B9ScheduledPublishTaskRef = { taskId: B9ScheduledPublishTaskId; contentVersionId: B9ContentVersionId; scheduledAt: B9OffsetDateTime; displayTimeZone: B9DisplayTimeZone; status: "SCHEDULED" | "CANCELLED" | "EXECUTED" | "INVALIDATED" | "RECOVERY_REQUIRED"; };

/**
 * 学习 session 对内容版本的服务端固定关系。仅表达版本引用和可用性，不返回已移除内容正文、答案或版权证据；UNAVAILABLE 时客户端不得静默回退到其他版本。
 */
export type B9SessionContentPin = ({ contentVersionId: B9ContentVersionId; versionNumber: number; status: "AVAILABLE" | "UNAVAILABLE"; pinnedAt: B9DateTime; reasonCode?: "RIGHTS_REMOVED" | "SECURITY_REMOVED" | "LEGAL_REMOVED"; alternativeAction?: "RETURN_TO_CATALOG" | "SELECT_ALTERNATIVE_TASK" | "CONTACT_SUPPORT"; alternativeContentVersionId?: B9ContentVersionId; }) & ({ status: "AVAILABLE"; reasonCode?: never; alternativeAction?: never; alternativeContentVersionId?: never; } | { reasonCode: "RIGHTS_REMOVED" | "SECURITY_REMOVED" | "LEGAL_REMOVED"; alternativeAction: "RETURN_TO_CATALOG" | "SELECT_ALTERNATIVE_TASK" | "CONTACT_SUPPORT"; status: "UNAVAILABLE"; });

/**
 * Generated from the contract source.
 */
export type B9ScheduledPublishTaskResponse = ApiSuccessEnvelope & { data: B9ScheduledPublishTask; };

/**
 * RFC3339 绝对时间；必须带 Z 或显式 UTC offset，禁止无时区的本地时间。
 */
export type B9OffsetDateTime = string;

/**
 * content-service 服务端生成的排期发布任务 ID。
 */
export type B9ScheduledPublishTaskId = string;

/**
 * IANA tz database 标识，仅用于后台展示和排期解释；实际执行以 scheduledAt 的绝对时间为准。
 */
export type B9DisplayTimeZone = string;

/**
 * 服务端生成的内容校验报告引用；客户端只能提交乐观绑定，不能把它当作授权或运行证明。
 */
export type B9ContentValidationReportId = string;

/**
 * 服务端生成的版权快照引用；客户端只能提交乐观绑定，服务端必须重新核对有效期和 owner。
 */
export type B9RightsSnapshotId = string;

/**
 * 服务端生成的不可变审计记录引用。
 */
export type B9AuditId = string;

/**
 * 校验、审核或版权快照的单调版本；不得由客户端降级或重用旧版本绕过服务端重查。
 */
export type B9EvidenceVersion = number;

/**
 * Immutable pin used after an assessment session or attempt starts. The contentVersionId/contentEpoch/snapshotId/snapshotHash identity never changes. Emergency rights, security or legal removal returns UNAVAILABLE instead of a silent fallback.
 */
export type B10ActiveSessionAttemptPin = ({ contentCode: B10ContentCode; contentVersionId: B10Int64Id; contentEpoch: B10ContentEpoch; snapshotId: B10SnapshotId; snapshotHash: B10Sha256; status: "AVAILABLE" | "UNAVAILABLE"; pinnedAt: B10DateTime; reasonCode?: "RIGHTS_REMOVED" | "SECURITY_REMOVED" | "LEGAL_REMOVED"; alternativeAction?: "RETURN_TO_CATALOG" | "SELECT_ALTERNATIVE_TASK" | "CONTACT_SUPPORT"; alternativeContentVersionId?: B10Int64Id; }) & ({ status: "AVAILABLE"; reasonCode?: never; alternativeAction?: never; alternativeContentVersionId?: never; } | { reasonCode: "RIGHTS_REMOVED" | "SECURITY_REMOVED" | "LEGAL_REMOVED"; alternativeAction: "RETURN_TO_CATALOG" | "SELECT_ALTERNATIVE_TASK" | "CONTACT_SUPPORT"; status: "UNAVAILABLE"; });

/**
 * Client declaration only. Provider/worker verification remains authoritative.
 */
export type MediaExpectedObject = { mimeType: string; sha256: string; sizeBytes: number; durationMs: number; };

/**
 * Generated from the contract source.
 */
export type MediaUploadIntentRequest = { purpose: "CONTENT_SOURCE" | "OFFICIAL_SUBTITLE_ARTIFACT"; mediaKind: "AUDIO" | "VIDEO" | "IMAGE" | "SUBTITLE"; sourceContentVersionId: string; sourceSegmentId: string; expectedObject: MediaExpectedObject; };

/**
 * Generated from the contract source.
 */
export type MediaUploadBinding = { uploadIntentId: string; assetId: string; assetVersion: number; tenantRef: string; subjectRef: string; expiresAt: string; };

/**
 * Generated from the contract source.
 */
export type MediaUploadGrant = { url: string; expiresAt: string; singleUse: true; binding: MediaUploadBinding; };

/**
 * Generated from the contract source.
 */
export type MediaUploadIntent = { uploadIntentId: string; assetId: string; status: "INTENT_CREATED"; uploadGrant: MediaUploadGrant; quotaPolicyRef: string; quotaPolicyVersion: string; expiresAt: string; };

/**
 * Opaque provider completion reference. Client object facts are not authoritative.
 */
export type MediaUploadIntentCompleteRequest = { completionRef: string; };

/**
 * Generated from the contract source.
 */
export type MediaUploadIntentCompletion = { taskId: string; assetId: string; assetVersion: number; status: "VERIFYING" | "QUEUED"; auditId: string; };

/**
 * Generated from the contract source.
 */
export type MediaProcessingTask = { taskId: string; taskVersion: number; taskType: "UPLOAD_VERIFY" | "MALWARE_SCAN" | "TRANSCODE" | "RENDITION" | "SUBTITLE_INGEST" | "DELETE_OBJECT"; assetId: string; assetVersion: number; attempt: number; dedupeKey: string; nextAttemptAt: string | null; failureClass: "NONE" | "TRANSIENT" | "CHECKSUM_MISMATCH" | "MIME_DISALLOWED" | "SIZE_EXCEEDED" | "QUOTA_EXCEEDED" | "MALWARE_INFECTED" | "CONSENT_WITHDRAWN" | "RIGHTS_REVOKED" | "DELETE_REQUESTED" | "STALE_CALLBACK" | "UNKNOWN"; status: "QUEUED" | "PROCESSING" | "RETRY_WAIT" | "SUCCEEDED" | "FAILED" | "QUARANTINED" | "CANCELLED" | "DLQ_PENDING" | "RECOVERY_REQUIRED"; auditId: string; };

/**
 * Generated from the contract source.
 */
export type MediaProcessingTaskRetryRequest = { expectedTaskVersion: number; };

/**
 * Generated from the contract source.
 */
export type MediaIntegrity = { objectVersion: string; sha256: string; sizeBytes: number; magicMimeType: string; durationMs: number; verificationStatus: "PENDING" | "VERIFIED" | "FAILED"; };

/**
 * Generated from the contract source.
 */
export type MediaAsset = { assetId: string; assetVersion: number; kind: "AUDIO" | "VIDEO" | "IMAGE" | "SUBTITLE" | "RECORDING"; status: "VERIFYING" | "QUEUED" | "PROCESSING" | "READY" | "FAILED" | "QUARANTINED" | "REVOKED" | "DELETE_REQUESTED" | "HOLD_BLOCKED" | "PURGE_PENDING" | "DELETED" | "PURGE_FAILED"; integrity: MediaIntegrity; malwareStatus: "PENDING" | "CLEAN" | "INFECTED" | "ERROR"; processingStatus: "NOT_STARTED" | "QUEUED" | "PROCESSING" | "READY" | "FAILED" | "QUARANTINED" | "CANCELLED"; sourceContentVersionId: string; rightsState: "VALID" | "EXPIRED" | "REVOKED" | "UNKNOWN_DENY"; };

/**
 * Generated from the contract source.
 */
export type MediaRendition = { renditionId: string; assetVersion: number; sourceChecksumSha256: string; outputChecksumSha256: string; objectVersion: string; mimeType: string; sizeBytes: number; status: "QUEUED" | "PROCESSING" | "READY" | "FAILED" | "QUARANTINED" | "REVOKED"; failureClass: "NONE" | "TRANSIENT" | "CHECKSUM_MISMATCH" | "MIME_DISALLOWED" | "MALWARE_INFECTED" | "RIGHTS_REVOKED" | "UNKNOWN"; };

/**
 * Artifact metadata only. Official subtitle text and review remain content-service facts.
 */
export type MediaSubtitleTrack = { subtitleTrackId: string; contentVersionId: string; rightsState: "VALID" | "EXPIRED" | "REVOKED" | "UNKNOWN_DENY"; artifactVersion: number; language: string; status: "QUEUED" | "PROCESSING" | "READY" | "FAILED" | "REVOKED"; };

/**
 * Generated from the contract source.
 */
export type MediaPlaybackCapability = { minimumRate: 0.5; maximumRate: 2; continuous: true; presets: readonly [0.5 | 0.75 | 1 | 1.25 | 1.5 | 2, 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2, 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2, 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2, 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2, 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2]; pitchPreservationRequired: true; timelineUnit: "MILLISECONDS"; fallback: "EXPLICIT_DISABLE_OR_UNSUPPORTED"; };

/**
 * Generated from the contract source.
 */
export type MediaManifest = { assetId: string; assetVersion: number; sourceContentVersionId: string; integrity: MediaIntegrity; malwareStatus: "PENDING" | "CLEAN" | "INFECTED" | "ERROR"; renditions: ReadonlyArray<MediaRendition>; subtitleTracks: ReadonlyArray<MediaSubtitleTrack>; fallbackAlternatives: readonly [MediaFallbackAlternative, MediaFallbackAlternative]; playbackCapabilities: MediaPlaybackCapability; status: "PROCESSING" | "READY" | "FAILED" | "QUARANTINED" | "REVOKED"; };

/**
 * Generated from the contract source.
 */
export type MediaSignedAccessRequest = { channel: "STREAM" | "OFFLINE_DOWNLOAD" | "SUBTITLE" | "RECORDING"; range: string; };

/**
 * Generated from the contract source.
 */
export type MediaAccessBinding = { assetId: string; assetVersion: number; tenantRef: string; subjectRef: string; channel: "STREAM" | "OFFLINE_DOWNLOAD" | "SUBTITLE" | "RECORDING"; range: string; expiry: string; revocationVersion: number; };

/**
 * Generated from the contract source.
 */
export type MediaSignedAccessGrant = { url: string; expiresAt: string; binding: MediaAccessBinding; revocationVersion: number; };

/**
 * Generated from the contract source.
 */
export type SpeakingRecordingUploadIntentRequest = { purpose: "ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY"; sourceContentVersionId: string; sourceSegmentId: string; shadowingSessionId?: string; expectedObject: MediaExpectedObject; };

/**
 * Generated from the contract source.
 */
export type SpeakingRecordingUploadIntent = { recordingId: string; status: "UPLOAD_PENDING"; uploadIntent: MediaUploadIntent; retentionPolicyRef: "P1R-M1-017"; retentionPolicyVersion: string; };

/**
 * Opaque completion reference; client integrity, malware and AI claims are prohibited.
 */
export type SpeakingRecordingCompleteRequest = { completionRef: string; };

/**
 * Generated from the contract source.
 */
export type SpeakingRecording = { recordingId: string; assetId: string; status: "VERIFYING" | "PROCESSING" | "REMOTE_READY" | "FAILED" | "QUARANTINED" | "DELETE_REQUESTED" | "HOLD_BLOCKED" | "PURGE_PENDING" | "DELETED" | "PURGE_FAILED"; malwareStatus: "PENDING" | "CLEAN" | "INFECTED" | "ERROR"; sourceContentVersionId: string; sourceSegmentId: string; retentionPolicyRef: "P1R-M1-017"; retentionPolicyVersion: string; legalHoldState: "NOT_CHECKED_DENY" | "CLEAR" | "HELD"; };

/**
 * Generated from the contract source.
 */
export type SpeakingRecordingDeleteReceipt = ({ recordingId: string; status: "DELETE_REQUESTED" | "HOLD_BLOCKED" | "PURGE_PENDING" | "DELETED" | "PURGE_FAILED"; deleteRequestId: string; legalHoldState: "NOT_CHECKED_DENY" | "CLEAR" | "HELD"; retentionPolicyRef: "P1R-M1-017"; retentionPolicyVersion: string; purgeReceiptRef?: string; auditId: string; }) & ({ status: "DELETED"; purgeReceiptRef: string; } | { status: "HOLD_BLOCKED"; purgeReceiptRef?: never; } | { status: "PURGE_FAILED"; purgeReceiptRef?: never; } | { status: "DELETE_REQUESTED" | "PURGE_PENDING"; purgeReceiptRef?: never; });

/**
 * Generated from the contract source.
 */
export type SpeakingShadowingSessionCreateRequest = { sourceContentVersionId: string; sourceSegmentId: string; };

/**
 * Generated from the contract source.
 */
export type SpeakingShadowingSession = { sessionId: string; status: "ACTIVE" | "COMPLETED" | "ABANDONED" | "RECOVERY_REQUIRED"; sourceContentVersionId: string; sourceSegmentId: string; targetGapMs: number; attemptRef: string; };

/**
 * Generated from the contract source.
 */
export type SpeakingShadowingProgressRequest = { progressMs: number; recordingId?: string; selfRating?: "NEEDS_PRACTICE" | "OK" | "CONFIDENT"; expectedSessionVersion: number; };

/**
 * Generated from the contract source.
 */
export type SpeakingShadowingCompletionRequest = { recordingId?: string; selfRating?: "NEEDS_PRACTICE" | "OK" | "CONFIDENT"; expectedSessionVersion: number; };

/**
 * Generated from the contract source.
 */
export type SpeakingShadowingCompletionReceipt = { sessionId: string; attemptId: string; status: "COMPLETED" | "RECOVERY_REQUIRED"; recordingRef: string | null; feedbackKind: "RULE_BASED_SELF_RATING"; aiScoringAvailable: false; };

/**
 * Generated from the contract source.
 */
export type MediaPublishEligibility = ({ contentVersionId: string; assetId: string; assetVersion: number; mediaStatus: "READY" | "NOT_READY"; malwareStatus: "PENDING" | "CLEAN" | "INFECTED" | "ERROR"; rightsState: "VALID" | "EXPIRED" | "REVOKED" | "UNKNOWN_DENY"; subtitleEligibility: "OFFICIAL_SUBTITLE_READY" | "TEXT_ALTERNATIVE_READY" | "MISSING" | "STALE" | "REVOKED"; decision: "ALLOW" | "DENY"; policyVersion: string; decisionRef: string; evaluatedAt: string; scheduleDueAt: string | null; recheckRequired: boolean; }) & ({ decision: "ALLOW"; mediaStatus: "READY"; malwareStatus: "CLEAN"; rightsState: "VALID"; subtitleEligibility: "OFFICIAL_SUBTITLE_READY" | "TEXT_ALTERNATIVE_READY"; recheckRequired: true; } | { decision: "DENY"; });

/**
 * Generated from the contract source.
 */
export type MediaFallbackAlternative = ({ kind: "TEXT_ALTERNATIVE" | "PRACTICE_ALTERNATIVE"; availability: "AVAILABLE" | "UNAVAILABLE"; reasonCode: "NONE" | "OFFICIAL_SUBTITLE_MISSING" | "RIGHTS_UNAVAILABLE" | "MEDIA_UNAVAILABLE" | "DEVICE_UNSUPPORTED" | "MICROPHONE_DENIED"; contentRef?: string; }) & ({ contentRef: string; availability: "AVAILABLE"; reasonCode: "NONE"; } | { availability: "UNAVAILABLE"; reasonCode: "OFFICIAL_SUBTITLE_MISSING" | "RIGHTS_UNAVAILABLE" | "MEDIA_UNAVAILABLE" | "DEVICE_UNSUPPORTED" | "MICROPHONE_DENIED"; });

/**
 * Generated from the contract source.
 */
export type B10RuleVersion = string;

/**
 * Generated from the contract source.
 */
export type B10SessionStatus = "CREATED" | "IN_PROGRESS" | "INTERRUPTED" | "SUBMITTING" | "COMPLETED" | "AUTO_SUBMITTED" | "CANCELLED" | "EXPIRED";

/**
 * Generated from the contract source.
 */
export type B10AttemptStatus = "ACCEPTED" | "ASSESSING" | "ASSESSED" | "REJECTED";

/**
 * Generated from the contract source.
 */
export type B10ReportStatus = "GENERATING" | "READY" | "PARTIAL" | "FAILED";

/**
 * Per-item immutable answer-rule metadata. The fields identify a sealed rule contract and are not answer values.
 */
export type B10AssessmentItemRulePin = { itemId: B10Int64Id; answerRuleVersion: B10RuleVersion; ruleDigest: B10Sha256; evaluationMode: "DETERMINISTIC" | "MANUAL_REVIEW" | "SELF_RATING"; };

/**
 * Learner-safe structured explanation trace. It cannot include candidate response text, an answer key or a sealed rule value.
 */
export type B10ReasonTrace = { itemId?: B10Int64Id; ruleCode: string; ruleVersion: B10RuleVersion; category: "NONE" | "CHOICE" | "MATCHING" | "ORDERING" | "CLOZE" | "TEXT" | "CONTENT" | "RULE"; reasonCode?: string; evidenceRef?: string; };

/**
 * Learner-safe deterministic objective outcome. It is an assessment fact, not a learning-service mastery or SRS fact.
 */
export type B10ObjectiveOutcome = { outcomeKind: "OBJECTIVE"; objectiveNumerator: number; objectiveDenominator: number; scoreBucket: "ZERO" | "PARTIAL" | "FULL"; errorCategory: "NONE" | "CHOICE" | "MATCHING" | "ORDERING" | "CLOZE" | "TEXT" | "CONTENT" | "RULE"; reasonTrace: ReadonlyArray<B10ReasonTrace>; outcomeDigest: B10Sha256; };

/**
 * Learner self-rating only. It deliberately has no objectiveNumerator, objectiveDenominator or scoreBucket.
 */
export type B10SelfRatingOutcome = { outcomeKind: "SELF_RATING"; selfRating: "EASY" | "NEUTRAL" | "DIFFICULT" | "UNSURE"; reasonTrace?: ReadonlyArray<B10ReasonTrace>; outcomeDigest: B10Sha256; };

/**
 * Manual-review outcome status only. A pending or subjective review cannot be represented as an objective score.
 */
export type B10ManualReviewOutcome = { outcomeKind: "MANUAL_REVIEW"; reviewStatus: "PENDING" | "PARTIAL" | "UNAVAILABLE"; reasonTrace?: ReadonlyArray<B10ReasonTrace>; outcomeDigest: B10Sha256; };

/**
 * Discriminated assessment outcome. Only the OBJECTIVE branch carries an objective score summary.
 */
export type B10AssessmentOutcome = B10ObjectiveOutcome | B10SelfRatingOutcome | B10ManualReviewOutcome;

/**
 * Generated from the contract source.
 */
export type B10ChoiceResponse = { responseType: "CHOICE"; selectedOptionIds: readonly [string, ...Array<string>]; };

/**
 * Generated from the contract source.
 */
export type B10MatchingPair = { leftId: string; rightId: string; };

/**
 * Generated from the contract source.
 */
export type B10MatchingResponse = { responseType: "MATCHING"; pairs: readonly [B10MatchingPair, ...Array<B10MatchingPair>]; };

/**
 * Generated from the contract source.
 */
export type B10OrderingResponse = { responseType: "ORDERING"; orderedTokenIds: readonly [string, ...Array<string>]; };

/**
 * Generated from the contract source.
 */
export type B10ClozeEntry = { blankId: string; text: string; };

/**
 * Generated from the contract source.
 */
export type B10ClozeResponse = { responseType: "CLOZE"; blanks: readonly [B10ClozeEntry, ...Array<B10ClozeEntry>]; };

/**
 * Generated from the contract source.
 */
export type B10TextResponse = { responseType: "TEXT"; text: string; };

/**
 * Generated from the contract source.
 */
export type B10UnansweredResponse = { responseType: "UNANSWERED"; };

/**
 * Closed candidate-response union. The protected scoring boundary accepts only these explicit response forms.
 */
export type B10CandidateResponse = B10ChoiceResponse | B10MatchingResponse | B10OrderingResponse | B10ClozeResponse | B10TextResponse | B10UnansweredResponse;

/**
 * Protected pre-submission candidate draft. It must be encrypted or equivalently protected at rest and is never emitted to Outbox, analytics or logs.
 */
export type B10ProtectedDraft = { responses: ReadonlyArray<B10AttemptSubmission>; };

/**
 * Canonical session checkpoint command. baseStateVersion, checkpointVersion and client sequence are concurrency facts; protectedDraft is not an assessment submission.
 */
export type B10AssessmentSessionCheckpointRequest = { baseStateVersion: B10StateVersion; checkpointVersion: number; clientEventId: string; clientSeq: number; checkpointDigest: B10Sha256; protectedDraft: B10ProtectedDraft; };

/**
 * Canonical session-level checkpoint acknowledgement. It is not an attempt or report fact.
 */
export type B10AssessmentCheckpoint = { sessionId: B10SessionId; checkpointVersion: number; clientEventId: string; clientSeq: number; checkpointDigest: B10Sha256; stateVersion: B10StateVersion; replayed: boolean; savedAt: B10DateTime; };

/**
 * Generated from the contract source.
 */
export type B9GoalOption = { goalCode: "FOUNDATION" | "COLLEGE_CET" | "POSTGRADUATE_ENGLISH" | "WORKPLACE_DAILY"; label: string; description?: string; targetLevels: readonly ["A1" | "A2" | "B1" | "B2" | "C1" | "C2"] | readonly ["A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2"] | readonly ["A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2"] | readonly ["A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2"] | readonly ["A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2"] | readonly ["A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2", "A1" | "A2" | "B1" | "B2" | "C1" | "C2"]; dailyQuotaMinutes: readonly [5 | 15 | 30 | 45] | readonly [5 | 15 | 30 | 45, 5 | 15 | 30 | 45] | readonly [5 | 15 | 30 | 45, 5 | 15 | 30 | 45, 5 | 15 | 30 | 45] | readonly [5 | 15 | 30 | 45, 5 | 15 | 30 | 45, 5 | 15 | 30 | 45, 5 | 15 | 30 | 45]; };

/**
 * Generated from the contract source.
 */
export type B9GoalOptions = { goalCatalogVersion: string; contentLocale: B9Locale; options: readonly [B9GoalOption, B9GoalOption, B9GoalOption, B9GoalOption]; generatedAt: B9DateTime; };

/**
 * Immutable, server-assembled planning facts. Eligibility is pinned only as a server-derived digest of adult gate, required consents, phase and policy; the placement baseline is a closed canonical result reference. Raw authority facts, placement raw answers, scores, algorithm, SRS and mastery facts are never part of this snapshot.
 */
export type B9PlanningInputSnapshot = { pinId: string; pinVersion: number; pinDigest: string; targetId: number; targetVersion: B9StateVersion; profileVersion: B9StateVersion; preferenceVersion: B9StateVersion; goalCatalogVersion: string; dailyQuotaMinutes: 5 | 15 | 30 | 45; timezone: string; weeklyStudyDays: readonly [number] | readonly [number, number] | readonly [number, number, number] | readonly [number, number, number, number] | readonly [number, number, number, number, number] | readonly [number, number, number, number, number, number] | readonly [number, number, number, number, number, number, number]; contentLocale: B9Locale; contentVersionId: B10Int64Id; contentEpoch: B9ContentEpoch; projectionVersion: B9ProjectionVersion; rightsSnapshotVersion: number; eligibilitySnapshotVersion: number; eligibilitySnapshotDigest: string; placementBaseline: B9PlacementBaseline; planningRuleVersion: string; inputFactWatermark: string; sourceEventId: string; rootEventId: string; };

/**
 * Generated from the contract source.
 */
export type B9PlanningJobRef = ({ jobId: string; status: "QUEUED" | "PROCESSING" | "RETRYABLE" | "FAILED" | "COMPLETED" | "CANCELLED"; inputPinId: string; inputPinVersion: number; inputFactWatermark: string; retryable: boolean; attemptCount: number; nextAttemptAt?: B9DateTime; lastErrorCode: "NONE" | "DEPENDENCY_UNAVAILABLE" | "CONTENT_UNAVAILABLE" | "RIGHTS_DENIED" | "STALE_INPUT" | "POLICY_DENIED" | "MANUAL_RECOVERY_REQUIRED"; createdAt: B9DateTime; updatedAt: B9DateTime; }) & ({ status: "QUEUED" | "PROCESSING" | "COMPLETED" | "CANCELLED"; retryable: false; lastErrorCode: "NONE"; } | { status: "RETRYABLE"; retryable: true; lastErrorCode: "DEPENDENCY_UNAVAILABLE" | "CONTENT_UNAVAILABLE" | "RIGHTS_DENIED" | "STALE_INPUT" | "POLICY_DENIED" | "MANUAL_RECOVERY_REQUIRED"; } | { status: "FAILED"; retryable: false; lastErrorCode: "DEPENDENCY_UNAVAILABLE" | "CONTENT_UNAVAILABLE" | "RIGHTS_DENIED" | "STALE_INPUT" | "POLICY_DENIED" | "MANUAL_RECOVERY_REQUIRED"; });

/**
 * Generated from the contract source.
 */
export type B9PlanReference = { planId: string; planVersion: number; planningInputPinId: string; planningInputPinVersion: number; planningInputDigest: string; inputFactWatermark: string; contentEpoch: B9ContentEpoch; projectionVersion: B9ProjectionVersion; generatedAt: B9DateTime; };

/**
 * Read-only subject-bound recovery projection. No retry, approve or close command is represented here.
 */
export type B9FirstDayRecovery = ({ recoveryTaskId: string; status: "QUEUED" | "PROCESSING" | "RETRYABLE" | "FAILED" | "COMPLETED" | "CANCELLED"; planningInput: B9PlanningInputSnapshot; job: B9PlanningJobRef; retryable: boolean; safeFailureCode: "NONE" | "DEPENDENCY_UNAVAILABLE" | "CONTENT_UNAVAILABLE" | "RIGHTS_DENIED" | "STALE_INPUT" | "POLICY_DENIED" | "MANUAL_RECOVERY_REQUIRED"; projectionVersion: B9ProjectionVersion; projectionWatermark: string; createdAt: B9DateTime; updatedAt: B9DateTime; }) & ({ status: "QUEUED" | "PROCESSING" | "COMPLETED" | "CANCELLED"; retryable: false; safeFailureCode: "NONE"; } | { status: "RETRYABLE"; retryable: true; safeFailureCode: "DEPENDENCY_UNAVAILABLE" | "CONTENT_UNAVAILABLE" | "RIGHTS_DENIED" | "STALE_INPUT" | "POLICY_DENIED" | "MANUAL_RECOVERY_REQUIRED"; } | { status: "FAILED"; retryable: false; safeFailureCode: "DEPENDENCY_UNAVAILABLE" | "CONTENT_UNAVAILABLE" | "RIGHTS_DENIED" | "STALE_INPUT" | "POLICY_DENIED" | "MANUAL_RECOVERY_REQUIRED"; });

/**
 * Generated from the contract source.
 */
export type B9FirstDayProjectionCommon = { state: "NOT_READY" | "PROCESSING" | "READY" | "DEGRADED"; profileReady: boolean; targetReady: boolean; placementStatus: "NOT_STARTED" | "IN_PROGRESS" | "SKIPPED" | "COMPLETED" | "UNAVAILABLE"; taskCount: number; tasks: ReadonlyArray<B9TaskRef>; contentEpoch: B9ContentEpoch; projectionVersion: B9ProjectionVersion; projectionWatermark: string; generatedAt: B9DateTime; planningInput?: B9PlanningInputSnapshot; job?: B9PlanningJobRef; plan?: B9PlanReference; blocker?: "PROFILE_INCOMPLETE" | "TARGET_INCOMPLETE" | "PLACEMENT_REQUIRED" | "CONSENT_REQUIRED" | "POLICY_DENIED"; degradedReason?: "CONTENT_PROJECTION_STALE" | "LEGACY_SHADOW_ONLY" | "DEPENDENCY_UNAVAILABLE" | "PLAN_FAILED" | "RIGHTS_DENIED" | "POLICY_DENIED"; recovery?: B9FirstDayRecovery; };

/**
 * Closed, learner-safe assessment reference assembled by learning-service from the canonical durable placement completion fact. It is a binding reference, not raw responses, scores, an algorithm, SRS or mastery input.
 */
export type B9PlacementBaseline = ({ resultKind: "ASSESSED" | "SKIPPED"; placementSessionId: B10SessionId; sessionStateVersion: B10StateVersion; sessionSnapshotDigest: B10PlacementDigest; placementResultId: string; resultVersion: number; resultDigest: B10PlacementDigest; reportId: B10ReportId; reportVersion: number; reportDigest: B10PlacementDigest; baselineConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED"; referenceLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null; requestedStartingLevel?: B10RequestedStartingLevel; completionStatus: "COMPLETED" | "SKIPPED"; manifest: B10PlacementManifestPin; contentPin: B10PlacementContentPin; answerRulePin: B10PlacementAnswerRulePin; targetPin: B10PlacementTargetPin; completedAt: B10DateTime; sourceEventId: string; rootEventId: string; placementFactWatermark: string; }) & ({ resultKind: "ASSESSED"; completionStatus: "COMPLETED"; baselineConfidence: "HIGH" | "MEDIUM" | "LOW"; referenceLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; requestedStartingLevel?: never; } | { resultKind: "SKIPPED"; completionStatus: "SKIPPED"; baselineConfidence: "UNVERIFIED"; referenceLevel: null; });

/**
 * Lowercase SHA-256 digest pinned by the assessment owner; it is not client authority.
 */
export type B10PlacementDigest = string;

/**
 * Generated from the contract source.
 */
export type B10PlacementManifestDimension = { dimension: "VOCABULARY" | "BASIC_GRAMMAR" | "READING" | "LISTENING"; weight: 25; requiredItemCount: 2 | 3; displayOrder: number; };

/**
 * Assessment-owned immutable P1_PLACEMENT_V1 manifest. It freezes the ten-item, four-dimension scoring set for one placement session.
 */
export type B10PlacementManifest = { placementManifestId: "P1_PLACEMENT_V1"; placementManifestVersion: "P1_PLACEMENT_V1"; placementManifestDigest: B10PlacementDigest; dimensionSetDigest: B10PlacementDigest; totalItemCount: 10; dimensions: readonly [B10PlacementManifestDimension, B10PlacementManifestDimension, B10PlacementManifestDimension, B10PlacementManifestDimension]; };

/**
 * Generated from the contract source.
 */
export type B10PlacementManifestPin = { placementManifestId: "P1_PLACEMENT_V1"; placementManifestVersion: "P1_PLACEMENT_V1"; placementManifestDigest: B10PlacementDigest; dimensionSetDigest: B10PlacementDigest; totalItemCount: 10; };

/**
 * Generated from the contract source.
 */
export type B10PlacementContentPin = { contentVersionId: B10Int64Id; contentEpoch: B10ContentEpoch; snapshotId: B10SnapshotId; snapshotHash: B10PlacementDigest; };

/**
 * Generated from the contract source.
 */
export type B10PlacementAnswerRulePin = { answerRuleSetVersion: B10RuleVersion; answerRuleVersion: B10RuleVersion; ruleDigest: B10PlacementDigest; completionRuleVersion: B10RuleVersion; };

/**
 * Generated from the contract source.
 */
export type B10PlacementTargetPin = { targetId: B10Int64Id; targetVersion: number; targetSnapshotDigest: B10PlacementDigest; };

/**
 * One assessment-owned placement session. B10 session status remains the only session state machine; placement result kind is a separate immutable result fact.
 */
export type B10PlacementSession = { sessionId: B10SessionId; status: B10SessionStatus; stateVersion: B10StateVersion; sessionSnapshotDigest: B10PlacementDigest; manifest: B10PlacementManifest; contentPin: B10PlacementContentPin; answerRulePin: B10PlacementAnswerRulePin; targetPin: B10PlacementTargetPin; currentItem?: B10LearnerContentItem; completedResult?: B10PlacementResult; startedAt: B10DateTime; updatedAt?: B10DateTime; };

/**
 * Closed candidate placement response. Client score, level, confidence, recommendation, pin, tenant and authority facts are rejected.
 */
export type B10PlacementResponseSubmitRequest = { expectedStateVersion: B10StateVersion; itemId: B10Int64Id; itemSequence: number; candidateResponse: B10CandidateResponse; responseDigest: B10PlacementDigest; timeSpentSec: number; };

/**
 * Generated from the contract source.
 */
export type B10PlacementDimensionSummary = { dimension: "VOCABULARY" | "BASIC_GRAMMAR" | "READING" | "LISTENING"; validItemCount: number; earnedItemCount: number; dimensionPercent: number; };

/**
 * User-selected historical fast-track hint only. It is never an assessed score, reference level or policy authority.
 */
export type B10RequestedStartingLevel = { level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; authority: "USER_SELECTED_NON_AUTHORITATIVE"; };

/**
 * Generated from the contract source.
 */
export type B10PlacementResult = ({ placementResultId: string; sessionId: B10SessionId; resultVersion: number; resultDigest: B10PlacementDigest; reportId: B10ReportId; reportVersion: number; reportDigest: B10PlacementDigest; resultKind: "ASSESSED" | "SKIPPED"; confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED"; coverageRatio: number; completionStatus: "COMPLETED" | "SKIPPED"; aggregateScore?: number | null; referenceLevel?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null; dimensionSummaries?: readonly [B10PlacementDimensionSummary, B10PlacementDimensionSummary, B10PlacementDimensionSummary, B10PlacementDimensionSummary]; requestedStartingLevel?: B10RequestedStartingLevel; manifest: B10PlacementManifestPin; contentPin: B10PlacementContentPin; answerRulePin: B10PlacementAnswerRulePin; targetPin: B10PlacementTargetPin; completedAt: B10DateTime; }) & ({ dimensionSummaries: readonly [B10PlacementDimensionSummary, B10PlacementDimensionSummary, B10PlacementDimensionSummary, B10PlacementDimensionSummary]; resultKind: "ASSESSED"; completionStatus: "COMPLETED"; confidence: "HIGH" | "MEDIUM" | "LOW"; aggregateScore: number; referenceLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; requestedStartingLevel?: never; } | { resultKind: "SKIPPED"; completionStatus: "SKIPPED"; confidence: "UNVERIFIED"; coverageRatio: 0; aggregateScore: null; referenceLevel: null; dimensionSummaries?: never; });

/**
 * Generated from the contract source.
 */
export type B10PlacementResponseReceipt = { sessionId: B10SessionId; stateVersion: B10StateVersion; status: B10SessionStatus; nextItem?: B10LearnerContentItem; finalResult?: B10PlacementResult; acceptedAt: B10DateTime; } & ({ nextItem: B10LearnerContentItem; status: "CREATED" | "IN_PROGRESS" | "INTERRUPTED"; finalResult?: never; } | { finalResult: B10PlacementResult; status: "COMPLETED" | "AUTO_SUBMITTED"; nextItem?: never; });

/**
 * Optional user-selected starting-level hint. It cannot establish a measured level, score, recommendation, owner, tenant or policy fact.
 */
export type B10PlacementSkipBaselineRequest = { requestedStartingLevel?: B10RequestedStartingLevel; };

/**
 * Immutable learner-safe placement report. It is a non-official reference and is not a learning mastery, SRS or certification fact.
 */
export type B10PlacementReport = { result: B10PlacementResult; manifest: B10PlacementManifest; contentPin: B10PlacementContentPin; answerRulePin: B10PlacementAnswerRulePin; targetPin: B10PlacementTargetPin; generatedAt: B10DateTime; };

/**
 * Generated from the contract source.
 */
export type B10ReviewEventId = string;

/**
 * Generated from the contract source.
 */
export type B10TaskId = string;

/**
 * Generated from the contract source.
 */
export type B10RepairId = string;

/**
 * Generated from the contract source.
 */
export type B10PlanId = string;

/**
 * Generated from the contract source.
 */
export type B10LearningReportType = "DAILY" | "WEEKLY" | "PHASE";

/**
 * Generated from the contract source.
 */
export type B10LearningPlanStatus = "READY" | "PROCESSING" | "DEGRADED" | "FAILED";

/**
 * Generated from the contract source.
 */
export type B10LearningTaskStatus = "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED" | "DEFERRED" | "SKIPPED";

/**
 * Immutable content identity observed by the client. The server validates it against the learning snapshot before accepting a review.
 */
export type B10ReviewContentPin = { contentCode: B10ContentCode; contentVersionId: B10Int64Id; contentEpoch: B10ContentEpoch; snapshotId: B10SnapshotId; snapshotHash: B10Sha256; };

/**
 * Accepted-fact high-water mark from one owning service. A report is not complete until all required owner watermarks are explicit.
 */
export type B10SourceWatermark = { owner: "learning-service" | "assessment-service"; watermark: string; };

/**
 * A server-planned learning task. Priority, budget, content pin and state version are authoritative projections, not client commands.
 */
export type B10LearningPlanTask = { taskId: B10TaskId; planId: B10PlanId; planVersion: B10ProjectionVersion; streamRevision: string; planningRuleVersion: "P1_DAILY_PLAN_V1"; completionRuleVersion: B10RuleVersion; candidateId: string; logicalItemId: B10Int64Id; actionAggregateId: string; candidateType: string; candidateSnapshotDigest: B10Sha256; planningInputDigest: B10Sha256; sourceFactRefs: readonly [string, ...Array<string>]; eligibilityDecision: "ELIGIBLE" | "RECOVERY_REFERENCE" | "INELIGIBLE"; sequence: number; taskType: string; priorityClass: "RECOVERY_REQUIRED" | "DELAY_VERIFICATION_DUE" | "SRS_OVERDUE_OR_DUE" | "MISTAKE_REPAIR" | "GOAL_CRITICAL" | "NEW_CORE" | "OPTIONAL"; budgetMinutes: 5 | 15 | 30 | 45; plannedMinutes: number; backlog: "NONE" | "CATCH_UP"; budgetLane: "REVIEW_REPAIR" | "GOAL_NEW" | "SKILL_ROTATION" | "OPTIONAL"; primaryReasonCode: string; secondaryReasonCodes?: ReadonlyArray<string>; reasonTrace?: ReadonlyArray<B10ReasonTrace>; status: B10LearningTaskStatus; contentPin: B10ContentVersionPin; practiceRef?: B10PracticeRef; stateVersion: B10StateVersion; };

/**
 * The canonical learning-service plan projection. It is derived from owned plan, SRS, repair and mastery facts.
 */
export type B10LearningPlan = { planId: B10PlanId; planVersion: B10ProjectionVersion; streamRevision: string; planningInputPinId: string; planningInputPinVersion: number; planningInputDigest: B10Sha256; localDate: string; timezone: string; status: B10LearningPlanStatus; algorithmVersion: "P1_DAILY_PLAN_V1"; planningRuleVersion: "P1_DAILY_PLAN_V1"; dailyBudgetMinutes: 5 | 15 | 30 | 45; budgetUsedMinutes?: number; budgetOverflowPercent?: number; contentEpoch: B10ContentEpoch; contentEligibilityDigest: B10Sha256; inputFactWatermark: string; sourceWatermarks: readonly [B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark]; sourceWatermarkDigest: B10Sha256; manualOrderOverlayVersion: number; candidateSnapshotDigest: B10Sha256; stateVersion: B10StateVersion; generatedAt: B10DateTime; tasks: ReadonlyArray<B10LearningPlanTask>; };

/**
 * The current-day view of the canonical learning plan. It carries the same server-owned plan facts and version boundary.
 */
export type B10TodayLearningPlan = B10LearningPlan;

/**
 * Client intent to reorder visible plan tasks. The server validates ownership, task membership and the base state version before applying it.
 */
export type B10PlanReorderRequest = { baseStateVersion: B10StateVersion; clientEventId: string; clientSeq: number; taskOrder: readonly [B10TaskId, ...Array<B10TaskId>]; payloadHash: B10Sha256; };

/**
 * Generated from the contract source.
 */
export type B10PlanReorderResult = { planId: B10PlanId; planVersion: B10ProjectionVersion; stateVersion: B10StateVersion; taskOrder: readonly [B10TaskId, ...Array<B10TaskId>]; replayed: boolean; updatedAt: B10DateTime; };

/**
 * Client intent to complete a planned task. Learning-service computes completion and any resulting projections; client facts cannot set outcome or mastery.
 */
export type B10TaskCompletionRequest = { baseStateVersion: B10StateVersion; clientEventId: string; clientSeq: number; completionFactRef: string; completionFactDigest: B10Sha256; payloadHash: B10Sha256; };

/**
 * Generated from the contract source.
 */
export type B10TaskCompletionResult = { taskId: B10TaskId; status: "COMPLETED"; planVersion: B10ProjectionVersion; stateVersion: B10StateVersion; replayed: boolean; completedAt: B10DateTime; };

/**
 * Learning-service repair projection. Verification timing is a repair workflow concern and is separate from the SRS and mastery stages.
 */
export type B10RepairItem = { repairId: B10RepairId; itemId: B10Int64Id; sourceAssessmentEventId: string; repairWorkflowState: "REVIEW_QUEUE" | "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REOPENED"; verificationStage: "IMMEDIATE_REPAIR" | "D1" | "D7"; srsStage: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; masteryStage: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; dueAt: B10DateTime | null; contentPin: B10ContentVersionPin; stateVersion: B10StateVersion; reasonTrace: ReadonlyArray<B10ReasonTrace>; };

/**
 * Learning-service mastery counts as of a server-owned projection watermark.
 */
export type B10MasteryOverview = { projectionVersion: B10ProjectionVersion; stateVersion: B10StateVersion; asOf: B10DateTime; newCount: number; learningCount: number; masteredCount: number; consolidatedCount: number; };

/**
 * Version pins used to build a learning report. These are input facts, not client-supplied report claims.
 */
export type B10ReportInputVersions = { planVersion: B10ProjectionVersion; streamRevision: string; srsStateVersion: B10StateVersion; masteryProjectionVersion: B10ProjectionVersion; assessmentReportVersion: number; contentEpoch: B10ContentEpoch; };

/**
 * Generated from the contract source.
 */
export type B10LearningReportMetric = ({ metricCode: string; status: "PROCESSING" | "READY" | "NOT_APPLICABLE"; numerator: number | null; denominator: number | null; value: number | null; }) & ({ metricCode: string; status: "PROCESSING"; numerator: null & (number | null); denominator: null & (number | null); value: null & (number | null); } | { metricCode: string; status: "READY"; numerator: number & (number | null); denominator: number & (number | null); value: number & (number | null); } | { metricCode: string; status: "NOT_APPLICABLE"; numerator: null & (number | null); denominator: null & (number | null); value: null & (number | null); });

/**
 * Learning-service report aggregation. Missing or late facts are visible through status, watermarks and reconciliation fields rather than silently treated as zero.
 */
export type B10LearningReport = { reportId: B10ReportId; reportVersion: number; reportType: B10LearningReportType; windowStart: B10DateTime; windowEnd: B10DateTime; asOf: B10DateTime; reportRuleVersion: "P1_REPORT_V1"; planningRuleVersion: "P1_DAILY_PLAN_V1"; srsAlgorithmVersion: "SM2_Q03_V1"; contentEpoch: B10ContentEpoch; sourceWatermarks: readonly [B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark] | readonly [B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark, B10SourceWatermark]; sourceWatermarkDigest: B10Sha256; inputVersions: B10ReportInputVersions; metricDefinitionsVersion: "P1_REPORT_V1"; sourceFactDigest: B10Sha256; status: "PROCESSING" | "READY" | "PARTIAL" | "FAILED"; metrics: ReadonlyArray<B10LearningReportMetric>; lateEventCount?: number; supersedesReportVersion?: number | null; rebuildStatus?: "NOT_REQUIRED" | "PENDING" | "REBUILT"; reconciliationStatus?: "NOT_REQUIRED" | "PENDING" | "RECONCILED" | "DISCREPANCY"; sourceTrace?: ReadonlyArray<string>; missingFacts?: ReadonlyArray<string>; generatedAt: B10DateTime; replayable: true; };

/**
 * Server receipt for the canonical public SRS review command. Derived SRS values, repair state and mastery state are response facts only.
 */
export type B10LearningReviewResult = { reviewEventId: B10ReviewEventId; eventStatus: "ACCEPTED" | "DUPLICATE" | "RISK_FILTERED" | "CONFLICT" | "REJECTED" | "EXPIRED"; riskDecision: "ALLOW" | "ACCEPT_NO_REWARD" | "THROTTLE" | "REJECT" | "REVIEW"; stateVersion: B10StateVersion; srsStage: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; repairWorkflowState: "REVIEW_QUEUE" | "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REOPENED"; masteryStage: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; verificationStage?: "IMMEDIATE_REPAIR" | "D1" | "D7"; repetitionCount: number; easeFactor: number; intervalDays: number; dueAt: B10DateTime | null; algorithmVersion: "SM2_Q03_V1"; contentPin: B10ContentVersionPin; projectionVersion: B10ProjectionVersion; projectedAt: B10DateTime; replayed: boolean; };

/**
 * Generated from the contract source.
 */
export type M1014GrowthSummary = { subjectRef: string; level: number; serverScore: number; streakDays: number; currentSeason: string; rewardCatalogVersion: string; rewardRuleVersion: string; featureEnabled: boolean; };

/**
 * Generated from the contract source.
 */
export type M1014LedgerEntry = { ledgerEntryId: string; principalId: string; tenantId: string; entryType: "CREDIT" | "DEBIT" | "COMPENSATION"; amount: number; currency: "NON_CASH_PLATFORM_CREDIT"; tupleKey: string; dedupeKey: string; lineageDigest: string; rewardRuleVersion: string; createdAt: string; auditRef: string; };

/**
 * Generated from the contract source.
 */
export type M1014RewardGrant = { grantId: string; principalRef: string; rewardCode: string; grantState: "AVAILABLE" | "CLAIMED" | "EXPIRED" | "REVOKED"; catalogVersion: string; rewardRuleVersion: string; probabilityVersion: string; drawId: string; eligibleRewardSetDigest: string; selectedRewardId: string; monetization: "FREE_NON_CASH"; drawnAt: string; expiresAt?: string | null; auditRef: string; };

/**
 * Generated from the contract source.
 */
export type M1014RewardProbability = { grantId: string; catalogVersion: string; probabilityVersion: string; tiers: readonly [{ tierCode: string; basisPoints: number; }, ...Array<{ tierCode: string; basisPoints: number; }>]; auditRef: string; disclosedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1014RewardClaimRequest = { commandCode: "CLAIM"; };

/**
 * Generated from the contract source.
 */
export type M1014RewardClaimResult = { grantId: string; claimId: string; state: "CLAIMED" | "ALREADY_CLAIMED" | "REJECTED"; catalogVersion: string; rewardRuleVersion: string; replayed: boolean; auditRef: string; };

/**
 * Generated from the contract source.
 */
export type M1014TrustedCompletion = ({ producerService: "learning-service" | "assessment-service"; eventName: "learning.task.completed.v2" | "assessment.item.assessed.v2" | "learning.mastery.projected.v2"; schemaVersion: "v2"; qualifiedPredicate: { taskStatus: "COMPLETED"; completionFact: "SERVER_SETTLED"; } | { objectiveOutcome: "CORRECT_VERIFIED"; objectiveCorrect: true; guessSignal: false; } | { masteryStageAfter: "MASTERED" | "CONSOLIDATED"; d7Gate: { result: "PASSED"; reasonCode: "D7_PASSED"; }; stateTransition: true; }; rewardRuleVersion: string; lineage: { eventId: string; traceId: string; schemaVersion: "v2"; taskId: string; completionVersion: string; rootEventId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; rulePin: { completionRuleVersion: string; ruleDigest: string; }; outcomeDigest: string; } | { eventId: string; traceId: string; schemaVersion: "v2"; itemAssessmentId: string; attemptId: string; logicalItemId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; rulePin: { answerRuleSetVersion: string; answerRuleVersion: string; ruleDigest: string; completionRuleVersion: string; assessmentVersion: string; }; objectivePolicyPin: { policyVersion: string; policyDigest: string; }; outcomeDigest: string; } | { eventId: string; traceId: string; schemaVersion: "v2"; projectionId: string; masteryEpochId: string; masteryEpochVersion: number; projectionVersion: number; sourceAssessmentEventId: string; sourceItemAssessmentId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; masteryStageBefore: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; masteryRuleVersion: string; evidenceDigest: string; }; }) & ({ rewardRuleVersion: string; producerService: "learning-service"; eventName: "learning.task.completed.v2"; schemaVersion: "v2"; qualifiedPredicate: { taskStatus: unknown; completionFact: unknown; } & ({ taskStatus: "COMPLETED"; completionFact: "SERVER_SETTLED"; } | { objectiveOutcome: "CORRECT_VERIFIED"; objectiveCorrect: true; guessSignal: false; taskStatus?: never; completionFact?: never; } | { masteryStageAfter: "MASTERED" | "CONSOLIDATED"; d7Gate: { result: "PASSED"; reasonCode: "D7_PASSED"; }; stateTransition: true; taskStatus?: never; completionFact?: never; }); lineage: { eventId: unknown; traceId: unknown; schemaVersion: unknown; taskId: unknown; completionVersion: unknown; rootEventId: unknown; contentPin: unknown; rulePin: unknown; outcomeDigest: unknown; evidenceDigest?: never; } & ({ eventId: string; traceId: string; schemaVersion: "v2"; taskId: string; completionVersion: string; rootEventId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; rulePin: { completionRuleVersion: string; ruleDigest: string; }; outcomeDigest: string; } | { eventId: string; traceId: string; schemaVersion: "v2"; itemAssessmentId: string; attemptId: string; logicalItemId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; rulePin: { answerRuleSetVersion: string; answerRuleVersion: string; ruleDigest: string; completionRuleVersion: string; assessmentVersion: string; }; objectivePolicyPin: { policyVersion: string; policyDigest: string; }; outcomeDigest: string; taskId?: never; completionVersion?: never; rootEventId?: never; } | { eventId: string; traceId: string; schemaVersion: "v2"; projectionId: string; masteryEpochId: string; masteryEpochVersion: number; projectionVersion: number; sourceAssessmentEventId: string; sourceItemAssessmentId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; masteryStageBefore: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; masteryRuleVersion: string; evidenceDigest: string; taskId?: never; completionVersion?: never; rootEventId?: never; rulePin?: never; outcomeDigest?: never; }); } | { rewardRuleVersion: string; producerService: "assessment-service"; eventName: "assessment.item.assessed.v2"; schemaVersion: "v2"; qualifiedPredicate: { objectiveOutcome: unknown; objectiveCorrect: unknown; guessSignal: unknown; } & ({ taskStatus: "COMPLETED"; completionFact: "SERVER_SETTLED"; objectiveOutcome?: never; objectiveCorrect?: never; guessSignal?: never; } | { objectiveOutcome: "CORRECT_VERIFIED"; objectiveCorrect: true; guessSignal: false; } | { masteryStageAfter: "MASTERED" | "CONSOLIDATED"; d7Gate: { result: "PASSED"; reasonCode: "D7_PASSED"; }; stateTransition: true; objectiveOutcome?: never; objectiveCorrect?: never; guessSignal?: never; }); lineage: { eventId: unknown; traceId: unknown; schemaVersion: unknown; itemAssessmentId: unknown; attemptId: unknown; logicalItemId: unknown; contentPin: unknown; rulePin: unknown; objectivePolicyPin: unknown; outcomeDigest: unknown; evidenceDigest?: never; } & ({ eventId: string; traceId: string; schemaVersion: "v2"; taskId: string; completionVersion: string; rootEventId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; rulePin: { completionRuleVersion: string; ruleDigest: string; }; outcomeDigest: string; itemAssessmentId?: never; attemptId?: never; logicalItemId?: never; objectivePolicyPin?: never; } | { eventId: string; traceId: string; schemaVersion: "v2"; itemAssessmentId: string; attemptId: string; logicalItemId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; rulePin: { answerRuleSetVersion: string; answerRuleVersion: string; ruleDigest: string; completionRuleVersion: string; assessmentVersion: string; }; objectivePolicyPin: { policyVersion: string; policyDigest: string; }; outcomeDigest: string; } | { eventId: string; traceId: string; schemaVersion: "v2"; projectionId: string; masteryEpochId: string; masteryEpochVersion: number; projectionVersion: number; sourceAssessmentEventId: string; sourceItemAssessmentId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; masteryStageBefore: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; masteryRuleVersion: string; evidenceDigest: string; itemAssessmentId?: never; attemptId?: never; logicalItemId?: never; rulePin?: never; objectivePolicyPin?: never; outcomeDigest?: never; }); } | { rewardRuleVersion: string; producerService: "learning-service"; eventName: "learning.mastery.projected.v2"; schemaVersion: "v2"; qualifiedPredicate: { masteryStageAfter: unknown; d7Gate: unknown; stateTransition: unknown; } & ({ taskStatus: "COMPLETED"; completionFact: "SERVER_SETTLED"; masteryStageAfter?: never; d7Gate?: never; stateTransition?: never; } | { objectiveOutcome: "CORRECT_VERIFIED"; objectiveCorrect: true; guessSignal: false; masteryStageAfter?: never; d7Gate?: never; stateTransition?: never; } | { masteryStageAfter: "MASTERED" | "CONSOLIDATED"; d7Gate: { result: "PASSED"; reasonCode: "D7_PASSED"; }; stateTransition: true; }); lineage: { eventId: unknown; traceId: unknown; schemaVersion: unknown; projectionId: unknown; masteryEpochId: unknown; masteryEpochVersion: unknown; projectionVersion: unknown; sourceAssessmentEventId: unknown; sourceItemAssessmentId: unknown; contentPin: unknown; masteryStageBefore: unknown; masteryRuleVersion: unknown; evidenceDigest: unknown; outcomeDigest?: never; } & ({ eventId: string; traceId: string; schemaVersion: "v2"; taskId: string; completionVersion: string; rootEventId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; rulePin: { completionRuleVersion: string; ruleDigest: string; }; outcomeDigest: string; projectionId?: never; masteryEpochId?: never; masteryEpochVersion?: never; projectionVersion?: never; sourceAssessmentEventId?: never; sourceItemAssessmentId?: never; masteryStageBefore?: never; masteryRuleVersion?: never; evidenceDigest?: never; } | { eventId: string; traceId: string; schemaVersion: "v2"; itemAssessmentId: string; attemptId: string; logicalItemId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; rulePin: { answerRuleSetVersion: string; answerRuleVersion: string; ruleDigest: string; completionRuleVersion: string; assessmentVersion: string; }; objectivePolicyPin: { policyVersion: string; policyDigest: string; }; outcomeDigest: string; projectionId?: never; masteryEpochId?: never; masteryEpochVersion?: never; projectionVersion?: never; sourceAssessmentEventId?: never; sourceItemAssessmentId?: never; masteryStageBefore?: never; masteryRuleVersion?: never; evidenceDigest?: never; } | { eventId: string; traceId: string; schemaVersion: "v2"; projectionId: string; masteryEpochId: string; masteryEpochVersion: number; projectionVersion: number; sourceAssessmentEventId: string; sourceItemAssessmentId: string; contentPin: { contentVersionId: number; contentEpoch: number; snapshotId: string; snapshotHash: string; }; masteryStageBefore: "NEW" | "LEARNING" | "MASTERED" | "CONSOLIDATED"; masteryRuleVersion: string; evidenceDigest: string; }); });

/**
 * Generated from the contract source.
 */
export type M1014SettlementResult = { tupleKey: string; dedupeKey: string; lineageDigest: string; ledgerEntryId: string; rewardRuleVersion: string; decision: "APPLIED" | "DUPLICATE" | "REJECTED" | "DENIED"; decisionReason: "QUALIFIED" | "ALREADY_SETTLED" | "NOT_QUALIFIED" | "POLICY_DENIED" | "INVALID_LINEAGE"; replayed?: boolean; };

/**
 * Generated from the contract source.
 */
export type M1014GameCatalogItem = ({ gameCode: "SENTENCE_TRAIN" | "WORD_MATCH" | "WORD_DEFENSE" | "WORD_PUZZLE" | "GRAMMAR_BLASTER" | "CATCH_MEANING"; releasePhase: "P0" | "P1" | "LONG_TERM"; enabled: boolean; catalogVersion: string; ruleVersion: string; maxMinutes?: number; passAccuracyPercent?: number; passCompletionPercent?: number; }) & ({ gameCode: "SENTENCE_TRAIN"; releasePhase: "P0"; enabled: true; } | { gameCode: "WORD_MATCH"; releasePhase: "P1"; enabled: false; } | { gameCode: "WORD_DEFENSE"; releasePhase: "P1"; enabled: false; } | { gameCode: "WORD_PUZZLE"; releasePhase: "P1"; enabled: false; } | { gameCode: "GRAMMAR_BLASTER"; releasePhase: "LONG_TERM"; enabled: false; } | { gameCode: "CATCH_MEANING"; releasePhase: "LONG_TERM"; enabled: false; });

/**
 * Generated from the contract source.
 */
export type M1014GameCatalog = { catalogVersion: string; policyVersion: "P1_GAME_CATALOG_V1"; items: readonly [] | readonly [M1014GameCatalogItem] | readonly [M1014GameCatalogItem, M1014GameCatalogItem] | readonly [M1014GameCatalogItem, M1014GameCatalogItem, M1014GameCatalogItem] | readonly [M1014GameCatalogItem, M1014GameCatalogItem, M1014GameCatalogItem, M1014GameCatalogItem] | readonly [M1014GameCatalogItem, M1014GameCatalogItem, M1014GameCatalogItem, M1014GameCatalogItem, M1014GameCatalogItem] | readonly [M1014GameCatalogItem, M1014GameCatalogItem, M1014GameCatalogItem, M1014GameCatalogItem, M1014GameCatalogItem, M1014GameCatalogItem]; };

/**
 * Generated from the contract source.
 */
export type M1014GameSessionCreateRequest = { gameCode: "SENTENCE_TRAIN"; performanceTier?: "Ultra" | "High" | "Medium" | "Performance"; };

/**
 * Generated from the contract source.
 */
export type M1014GameEventRequest = { eventId: string; seq: number; itemCode: string; responseToken: string; };

/**
 * Generated from the contract source.
 */
export type M1014GameSessionControlRequest = { expectedVersion?: number; commandReason?: "USER_COMMAND" | "CLIENT_RECOVERY" | "SYSTEM_TIMEOUT"; };

/**
 * Generated from the contract source.
 */
export type M1014GameSession = { sessionId: string; gameCode: "SENTENCE_TRAIN"; status: "CREATED" | "RUNNING" | "PAUSED" | "FINISHED" | "EXPIRED" | "REJECTED"; catalogVersion: string; ruleVersion: string; contentVersionId: number; contentEpoch: number; snapshotHash: string; sessionVersion: number; startedAt: string; expiresAt: string; challengeRefs?: ReadonlyArray<{ itemCode: string; sequence: number; responseToken: string; }>; serverScore?: number; };

/**
 * Generated from the contract source.
 */
export type M1014GameEventReceipt = { sessionId: string; eventId: string; seq: number; accepted: boolean; sessionVersion: number; serverTime: string; replayed: boolean; };

/**
 * Generated from the contract source.
 */
export type M1014GameSessionResult = { sessionId: string; status: "FINISHED" | "EXPIRED" | "REJECTED"; serverScore: number; settlementState: "APPLIED" | "DUPLICATE" | "NOT_ELIGIBLE" | "DENIED"; completedAt: string; replayed: boolean; ledgerEntryId?: string | null; rewardGrantId?: string | null; };

/**
 * Generated from the contract source.
 */
export type M1014RoomSummary = { roomId: string; spaceType: "PUBLIC_THEME_ROOM" | "INVITE_STUDY_ROOM" | "CHECKIN_GOAL_GROUP"; visibility: "PUBLIC" | "INVITE_ONLY"; membership: "THEME_TEMPLATE_MANAGED" | "OWNER_INVITED"; minCapacity: number; maxCapacity: number; occupiedSeats: number; enabled: boolean; leaseMode: "REQUIRED" | "PROHIBITED"; catalogVersion: string; policyVersion: "P1_SOCIAL_SPACE_POLICY_V1"; };

/**
 * Generated from the contract source.
 */
export type M1014RoomPage = { items: ReadonlyArray<M1014RoomSummary>; conserved: true; };

/**
 * Generated from the contract source.
 */
export type M1014RoomDetails = { roomId: string; spaceType: "PUBLIC_THEME_ROOM" | "INVITE_STUDY_ROOM" | "CHECKIN_GOAL_GROUP"; visibility: "PUBLIC" | "INVITE_ONLY"; membership: "THEME_TEMPLATE_MANAGED" | "OWNER_INVITED"; minCapacity: number; maxCapacity: number; occupiedSeats: number; enabled: boolean; leaseMode: "REQUIRED" | "PROHIBITED"; catalogVersion: string; policyVersion: "P1_SOCIAL_SPACE_POLICY_V1"; leasePolicyVersion: "P1_LEASE_POLICY_V1"; serverTime: string; visibleSeatCount?: number; };

/**
 * Generated from the contract source.
 */
export type M1014RoomJoinRequest = { preferredSeatIndex?: number; };

/**
 * Generated from the contract source.
 */
export type M1014RoomCommand = { leaseId?: string; leaseVersion?: number; expectedVersion?: number; reasonCode?: "DISCONNECT" | "RECOVER" | "RENEW" | "USER_LEFT"; };

/**
 * Generated from the contract source.
 */
export type M1014RoomState = { roomId: string; spaceType: "PUBLIC_THEME_ROOM" | "INVITE_STUDY_ROOM" | "CHECKIN_GOAL_GROUP"; roomVisibility: "PUBLIC" | "INVITE_ONLY"; seatState: "ACTIVE" | "DISCONNECTED" | "RECOVERED" | "EXPIRED" | "LEFT" | "NOT_APPLICABLE"; seatId: string | null; leaseId: string | null; leaseVersion: number; leaseExpiresAt: string | null; recoveryUntil: string | null; leasePolicyVersion: "P1_LEASE_POLICY_V1"; serverTime: string; replayed?: boolean; };

/**
 * Generated from the contract source.
 */
export type M1014FocusCommand = { durationMinutes: 25 | 45; focusKind: "FOCUS" | "REVIEW"; focusTagCode: "VOCABULARY" | "LISTENING" | "READING" | "GRAMMAR" | "SPEAKING" | "WRITING"; };

/**
 * Generated from the contract source.
 */
export type M1014FocusUpdateCommand = { focusId: string; expectedFocusVersion: number; action: "PAUSE" | "RESUME" | "FINISH" | "ABORT"; };

/**
 * Generated from the contract source.
 */
export type M1014FocusSession = ({ focusId: string; roomId: string; seatId: string; leaseId: string; leaseVersion: number; focusVersion: number; state: "FOCUSING" | "PAUSED" | "COMPLETED" | "ABORTED" | "AUTO_RELEASED"; durationMinutes: 25 | 45; creditedMinutes: 0 | 25 | 45; startedAt: string; endsAt: string; serverTime: string; }) & ({ state: "COMPLETED"; creditedMinutes: 25 | 45; } | { state: "FOCUSING" | "PAUSED" | "ABORTED" | "AUTO_RELEASED"; creditedMinutes: 0; });

/**
 * Generated from the contract source.
 */
export type M1014PresetInteraction = { presetCode: "CHEER_UP" | "STUDY_TOGETHER" | "CONGRATS" | "TRY_AGAIN" | "TONIGHT_20_MIN"; targetSeatId?: string | null; clientEventId: string; };

/**
 * Generated from the contract source.
 */
export type M1014InteractionResult = { eventId: string; roomId: string; presetCode: "CHEER_UP" | "STUDY_TOGETHER" | "CONGRATS" | "TRY_AGAIN" | "TONIGHT_20_MIN"; state: "DELIVERED"; deliveredAt: string; };

/**
 * Generated from the contract source.
 */
export type M1014LeaderboardEntry = { rank: number; displayMode: "NICKNAME" | "ANONYMOUS" | "OPT_OUT"; displayName?: string | null; score: number; isSelf: boolean; };

/**
 * Generated from the contract source.
 */
export type M1014Leaderboard = { snapshotId: string; metric: "FOCUS_MINUTES" | "MASTERED_WORDS" | "XP"; period: "DAY" | "WEEK"; timezoneId: "Asia/Shanghai"; projectionVersion: number; ruleVersion: string; tieBreakVersion: string; snapshotAt: string; watermark: string; auditRef: string; entries: ReadonlyArray<M1014LeaderboardEntry>; me: { present: boolean; visibility: "NICKNAME" | "ANONYMOUS" | "OPT_OUT"; score?: number | null; }; delayed: boolean; };

/**
 * Generated from the contract source.
 */
export type M1014VisibilityCommand = { leaderboardVisibility: "NICKNAME" | "ANONYMOUS" | "OPT_OUT"; roomVisibility: "PUBLIC" | "INVITE_ONLY"; };

/**
 * Generated from the contract source.
 */
export type M1014Visibility = { leaderboardVisibility: "NICKNAME" | "ANONYMOUS" | "OPT_OUT"; roomVisibility: "PUBLIC" | "INVITE_ONLY"; policyVersion: "P1_SOCIAL_SPACE_POLICY_V1"; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1014ReportCommand = { targetType: "SEAT" | "ROOM" | "PRESET_INTERACTION"; targetRef: string; reasonCode: "HARASSMENT" | "SPAM" | "INAPPROPRIATE_BEHAVIOR" | "SAFETY" | "IMPERSONATION"; };

/**
 * Generated from the contract source.
 */
export type M1014Report = { reportId: string; roomId: string; reporterId: string; tenantId: string; caseId: string; targetType: "SEAT" | "ROOM" | "PRESET_INTERACTION"; targetRef: string; reasonCode: "HARASSMENT" | "SPAM" | "INAPPROPRIATE_BEHAVIOR" | "SAFETY" | "IMPERSONATION"; state: "SUBMITTED" | "TRIAGED" | "RESOLVED" | "DISMISSED"; moderationPolicyVersion: "P1_MODERATION_POLICY_V1"; auditRef: string; createdAt: string; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1014TrustedSocialEvent = ({ eventId: string; eventName: "learning.mastery.projected.v2" | "gamification.xp.ledger_posted.v2"; schemaVersion: "v2"; aggregateId: string; occurredAt: string; actorId: string; traceId: string; requestId: string; dedupeKey: string; sourceService: "learning-service" | "gamification-service"; payload: M1014LeaderboardMasteryFact | M1014LeaderboardXpFact; }) & ({ sourceService: "learning-service"; eventName: "learning.mastery.projected.v2"; schemaVersion: "v2"; payload: M1014LeaderboardMasteryFact; } | { sourceService: "gamification-service"; eventName: "gamification.xp.ledger_posted.v2"; schemaVersion: "v2"; payload: M1014LeaderboardXpFact; });

/**
 * Generated from the contract source.
 */
export type M1014LeaderboardMasteryFact = { tenantId: string; principalId: string; projectionId: string; logicalItemId: string; masteryEpochId: string; masteryEpochVersion: number; projectionVersion: number; masteryStageBefore: "NEW" | "LEARNING"; masteryStageAfter: "MASTERED"; evidenceDigest: string; masteryRuleVersion: "P1_MASTERY_V1"; masteryFactWatermark: string; projectedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1014LeaderboardXpFact = { ledgerEntryId: string; principalId: string; tenantId: string; entryType: "CREDIT" | "DEBIT" | "COMPENSATION"; amount: number; currency: "NON_CASH_PLATFORM_CREDIT"; tupleKey: string; dedupeKey: string; lineageDigest: string; rewardRuleVersion: string; sourceEventId: string; sourceEventName: "learning.task.completed.v2" | "assessment.item.assessed.v2" | "learning.mastery.projected.v2"; createdAt: string; auditRef: string; };

/**
 * Generated from the contract source.
 */
export type M1015GracePolicy = ({ mode: "NONE" | "BOUNDED_ACTIVE_ONLY"; maxSeconds: number; eligibleState: "ACTIVE"; denyOn: readonly ["REFUND" | "REVOKE" | "EXPIRE" | "SECURITY" | "UNKNOWN", "REFUND" | "REVOKE" | "EXPIRE" | "SECURITY" | "UNKNOWN", "REFUND" | "REVOKE" | "EXPIRE" | "SECURITY" | "UNKNOWN", "REFUND" | "REVOKE" | "EXPIRE" | "SECURITY" | "UNKNOWN", "REFUND" | "REVOKE" | "EXPIRE" | "SECURITY" | "UNKNOWN"]; }) & ({ mode: "NONE"; maxSeconds: 0; } | { mode: "BOUNDED_ACTIVE_ONLY"; maxSeconds: number; });

/**
 * Generated from the contract source.
 */
export type M1015EntitlementTombstone = ({ present: boolean; version: number; effectiveAt: string | null; }) & ({ present: false; version: 0; effectiveAt: null; } | { present: true; version: number; effectiveAt: string; });

/**
 * Generated from the contract source.
 */
export type M1015EntitlementInvalidation = { required: true; version: number; receiptRef: string; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type M1015PublicCatalog = { catalogVersion: string; uiLocale: string; contentLocale: string; plans: ReadonlyArray<M1015PublicPlan>; publishedAt: string | null; checkoutPath: string; productionPaymentEnabled: false; autoRenewalEnabled: false; };

/**
 * Generated from the contract source.
 */
export type M1015PublicPlan = ({ planId: string; skuId: string; title: string; billingPeriod: "FREE" | "MONTH" | "QUARTER" | "YEAR" | "PERPETUAL"; currency: string; amountMinor: number; priceSnapshotId: string; availability: "PUBLISHED" | "COMING_SOON" | "UNAVAILABLE"; entitlementCode: string; }) & ({ billingPeriod: "PERPETUAL"; availability: "COMING_SOON" | "UNAVAILABLE"; } | { billingPeriod: "FREE" | "MONTH" | "QUARTER" | "YEAR"; });

/**
 * Generated from the contract source.
 */
export type M1015Sku = ({ skuId: string; title: string; description: string; billingPeriod: "FREE" | "ONE_TIME" | "MONTH" | "QUARTER" | "YEAR" | "PERPETUAL"; currency: string; amountMinor: number; availability: "PUBLISHED" | "COMING_SOON" | "UNAVAILABLE"; entitlementCode: string; priceSnapshotId: string; }) & ({ billingPeriod: "PERPETUAL"; availability: "COMING_SOON" | "UNAVAILABLE"; } | { billingPeriod: "FREE" | "ONE_TIME" | "MONTH" | "QUARTER" | "YEAR"; });

/**
 * Generated from the contract source.
 */
export type M1015Entitlement = ({ entitlementId: string; entitlementCode: string; scopeCode: string; entitlementVersion: number; state: "PENDING" | "ACTIVE" | "GRACE" | "EXPIRED" | "REVOKED"; sourceType: "VERIFIED_PAYMENT" | "REDEEMED_ACTIVATION"; sourceRef: string; sourceVersion: number; policyVersion: string; effectiveAt: string; startsAt: string; expiresAt: string | null; graceUntil?: string; graceReason?: string; gracePolicy: M1015GracePolicy; tombstone: M1015EntitlementTombstone; invalidation: M1015EntitlementInvalidation; stateVersion: number; }) & ({ state: "PENDING" | "ACTIVE"; tombstone: { present: false; version: 0; effectiveAt: null; } & ({ present: false; version: 0; effectiveAt: null; } | { present: true; version: number; effectiveAt: string; }); graceUntil?: never; graceReason?: never; } | { graceUntil: string; graceReason: string; state: "GRACE"; gracePolicy: { mode: "BOUNDED_ACTIVE_ONLY"; maxSeconds: number; } & ({ mode: "NONE"; maxSeconds: 0; } | { mode: "BOUNDED_ACTIVE_ONLY"; maxSeconds: number; }); tombstone: { present: false; version: 0; effectiveAt: null; } & ({ present: false; version: 0; effectiveAt: null; } | { present: true; version: number; effectiveAt: string; }); } | { state: "EXPIRED" | "REVOKED"; tombstone: { present: true; version: number; effectiveAt: string; } & ({ present: false; version: 0; effectiveAt: null; } | { present: true; version: number; effectiveAt: string; }); graceUntil?: never; graceReason?: never; });

/**
 * Generated from the contract source.
 */
export type M1015Order = { orderId: string; skuId: string; priceSnapshotId: string; state: "CREATED" | "PAYMENT_PENDING" | "PAID" | "REFUND_PENDING" | "REFUNDED" | "CANCELLED" | "EXPIRED"; stateVersion: number; currency: string; amountMinor: number; channel: "SANDBOX_HMAC"; environment: "SANDBOX"; createdAt: string; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1015OrderCreateRequest = { skuId: string; expectedPriceSnapshotId: string; sourcePlatform: "MOBILE" | "WEB" | "PWA"; };

/**
 * Generated from the contract source.
 */
export type M1015PaymentReadiness = { enabled: false; reasonCode: "CONTRACT_ONLY_NOT_RUNTIME_VERIFIED"; providerAllowList: readonly ["SANDBOX_HMAC"]; providers: readonly [M1015ProviderReadiness]; productionPaymentEnabled: false; autoRenewalEnabled: false; sandboxOnly: true; };

/**
 * Generated from the contract source.
 */
export type M1015ProviderReadiness = { provider: "SANDBOX_HMAC"; environment: "SANDBOX"; enabled: false; sandbox: true; productionPaymentEnabled: false; autoRenewalEnabled: false; reasonCode: "CONTRACT_ONLY_NOT_RUNTIME_VERIFIED"; };

/**
 * Generated from the contract source.
 */
export type M1015PaymentIntentRequest = { provider: "SANDBOX_HMAC"; expectedOrderStateVersion: number; };

/**
 * Generated from the contract source.
 */
export type M1015PaymentIntentResult = { orderId: string; paymentAttemptId: string; state: "PREPARED" | "AWAITING_CALLBACK" | "VERIFIED" | "REJECTED" | "EXPIRED"; stateVersion: number; provider: "SANDBOX_HMAC"; environment: "SANDBOX"; payable: boolean; reasonCode: string; productionPaymentEnabled: false; autoRenewalEnabled: false; intentRef?: string | null; };

/**
 * Generated from the contract source.
 */
export type M1015RefundRequest = { reasonCode: string; expectedStateVersion: number; };

/**
 * Generated from the contract source.
 */
export type M1015Refund = ({ refundId: string; orderId: string; refundMode: "FULL_ONLY"; state: "REQUESTED" | "REVIEW_PENDING" | "PROVIDER_PENDING" | "SETTLED" | "REJECTED" | "FAILED" | "CANCELLED"; reasonCode: string; expectedStateVersion: number; stateVersion: number; approvalState: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED"; approvalRef: string; auditRef: string; receiptRef: string; createdAt: string; updatedAt: string; postRecoveryRerunRequired: true; settlementReceiptRef?: string; entitlementRevocationReceiptRef?: string; }) & ({ settlementReceiptRef: string; entitlementRevocationReceiptRef: string; state: "SETTLED"; approvalState: "APPROVED"; } | { state: "REQUESTED" | "REVIEW_PENDING" | "PROVIDER_PENDING" | "REJECTED" | "FAILED" | "CANCELLED"; settlementReceiptRef?: never; entitlementRevocationReceiptRef?: never; });

/**
 * Generated from the contract source.
 */
export type M1015ActivationRedeemRequest = { activationCode: string; };

/**
 * Generated from the contract source.
 */
export type M1015ProviderCallbackRequest = { providerEventId: string; transactionId: string; orderId: string; paymentAttemptId: string; amountMinor: number; currency: string; result: "PAID" | "REFUNDED" | "REJECTED"; occurredAt: string; };

/**
 * Generated from the contract source.
 */
export type M1015ProviderCallbackReceipt = ({ callbackReceiptRef: string; provider: "SANDBOX_HMAC"; environment: "SANDBOX"; providerEventId: string; transactionRef: string; orderId: string; paymentAttemptId: string; amountMinor: number; currency: string; result: "PAID" | "REFUNDED" | "REJECTED"; occurredAt: string; receivedAt: string; replayed: boolean; entitlementActivated: boolean; verificationRef: string; sanitized: true; }) & ({ result: "PAID"; entitlementActivated: boolean; } | { result: "REFUNDED" | "REJECTED"; entitlementActivated: false; });

/**
 * Generated from the contract source.
 */
export type M1015ReconciliationReplayRequest = { reconciliationCaseRef: string; batchRef: string; windowStart: string; windowEnd: string; expectedStateVersion: number; expectedOrderState: string; expectedPaymentAttemptState: string; expectedEntitlementVersion: number; sourceFactDigests: readonly [string, ...Array<string>]; remediationPlanDigest: string; approvalRefs: readonly [string, string]; policyVersion: string; recoveryMode: "REPLAY_ONLY" | "CONTROLLED_RECOVERY"; recoveryReasonCode: string; };

/**
 * Replay/recovery request receipt only. It is not the post-rerun closure event; commerce.reconciliation.recovery_receipted.v2 separately records CLOSED with MATCHED_AFTER_RECOVERY.
 */
export type M1015ReconciliationRecoveryReceipt = { reconciliationCaseRef: string; batchRef: string; state: "ACCEPTED" | "REPLAYED" | "RECOVERY_PENDING" | "RECOVERED" | "REJECTED"; expectedStateVersion: number; stateVersion: number; replayReceiptRef: string; recoveryReceiptRef: string; approvalRefs: readonly [string, string]; auditRef: string; domainFactsUntouched: true; postRecoveryRerun: { required: true; state: "PENDING" | "COMPLETED" | "FAILED"; rerunRef: string; }; };

/**
 * Generated from the contract source.
 */
export type M1015EntitlementSnapshotResolveRequest = { minimumPolicyVersion: string; expectedInvalidationVersion: number; };

/**
 * Generated from the contract source.
 */
export type M1015EntitlementSnapshot = ({ snapshotRef: string; entitlementId: string; entitlementVersion: number; entitlementCode: string; scopeCode: string; state: "PENDING" | "ACTIVE" | "GRACE" | "EXPIRED" | "REVOKED"; sourceType: "VERIFIED_PAYMENT" | "REDEEMED_ACTIVATION"; sourceRef: string; sourceVersion: number; policyVersion: string; effectiveAt: string; startsAt: string; expiresAt: string | null; graceUntil?: string; graceReason?: string; gracePolicy: M1015GracePolicy; tombstone: M1015EntitlementTombstone; invalidation: M1015EntitlementInvalidation; pepDecisionAuthority: "CONSUMER_LOCAL_PEP"; }) & ({ state: "PENDING" | "ACTIVE"; tombstone: { present: false; version: 0; effectiveAt: null; } & ({ present: false; version: 0; effectiveAt: null; } | { present: true; version: number; effectiveAt: string; }); graceUntil?: never; graceReason?: never; } | { graceUntil: string; graceReason: string; state: "GRACE"; gracePolicy: { mode: "BOUNDED_ACTIVE_ONLY"; maxSeconds: number; } & ({ mode: "NONE"; maxSeconds: 0; } | { mode: "BOUNDED_ACTIVE_ONLY"; maxSeconds: number; }); tombstone: { present: false; version: 0; effectiveAt: null; } & ({ present: false; version: 0; effectiveAt: null; } | { present: true; version: number; effectiveAt: string; }); } | { state: "EXPIRED" | "REVOKED"; tombstone: { present: true; version: number; effectiveAt: string; } & ({ present: false; version: 0; effectiveAt: null; } | { present: true; version: number; effectiveAt: string; }); graceUntil?: never; graceReason?: never; });

/**
 * Generated from the contract source.
 */
export type M1015EntitlementRevokeRequest = { reasonCode: string; expectedStateVersion: number; sourceFactRef: string; approvalRef: string; };

/**
 * Generated from the contract source.
 */
export type M1015EntitlementRevokeReceipt = { entitlementId: string; previousState: "PENDING" | "ACTIVE" | "GRACE" | "EXPIRED"; state: "REVOKED"; entitlementVersion: number; expectedStateVersion: number; stateVersion: number; approvalRef: string; auditRef: string; receiptRef: string; effectiveAt: string; invalidation: M1015EntitlementInvalidation; tombstone: M1015EntitlementTombstone & { present: true; version: number; effectiveAt: string; }; postRecoveryRerunRequired: false; };

/**
 * Generated from the contract source.
 */
export type M1016SyncProtocolContext = { clientEventId: string; clientSeq: number; baseVersion: number; contentVersionId: string; payloadHash: string; entityType: string; entityId: string; operation: "UPSERT" | "DELETE" | "APPEND"; occurredAt: string; idempotencyKey: string; };

/**
 * Generated from the contract source.
 */
export type M1016SyncReceipt = { receiptId: string; context: M1016SyncProtocolContext; state: "ACCEPTED" | "APPLIED" | "REPLAYED" | "PROCESSING" | "CONFLICT" | "REJECTED"; serverVersion: number; acceptedAt: string; replayed: boolean; };

/**
 * Generated from the contract source.
 */
export type M1016SyncCursor = { cursor: string; version: number; issuedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1016SyncConflict = { conflictId: string; clientEventId: string; entityType: string; entityId: string; baseVersion: number; localVersion: number; serverVersion: number; contentVersionId: string; reasonCode: "DUPLICATE_EVENT_DIFFERENT_HASH" | "OUT_OF_ORDER" | "SEQUENCE_GAP" | "STALE_BASE_VERSION" | "FUTURE_BASE_VERSION" | "CONTENT_VERSION_MISMATCH" | "OWNER_VERSION_MISMATCH" | "PERMISSION_OR_RIGHTS_CHANGED"; safeServerReference: string; allowedResolution: "RELOAD_SERVER" | "KEEP_LOCAL_DRAFT" | "RETRY_WITH_NEW_BASE" | "CONTACT_SUPPORT" | "DISCARD_LOCAL"; recoveryTaskId: string; context?: M1016SyncProtocolContext; resolutionState?: "OPEN" | "RECOVERY_PENDING" | "RECOVERED" | "TERMINAL"; };

/**
 * Generated from the contract source.
 */
export type M1016SyncRecoveryRequest = { expectedVersion: number; action: "KEEP_SERVER_FACT" | "DISCARD_LOCAL_DRAFT" | "RETRY_CANONICAL_COMMAND"; };

/**
 * Generated from the contract source.
 */
export type M1016SyncRecoveryResult = { conflictId: string; action: "KEEP_SERVER_FACT" | "DISCARD_LOCAL_DRAFT" | "RETRY_CANONICAL_COMMAND"; state: "RECOVERED" | "RETRY_REQUIRED" | "TERMINAL" | "REJECTED"; serverVersion: number; recoveryReceiptId: string; domainFactsUntouched: true; recoveredAt: string; };

/**
 * 起止时间相同表示关闭免打扰；否则按当地时间左闭右开判断，跨午夜区间有效。
 */
export type M1016NotificationDndWindow = { startLocalTime: string; endLocalTime: string; timezone: string; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationPreference = { category: "LEARNING" | "REVIEW" | "STREAK" | "EXAM" | "CHECKPOINT" | "STUDY_ROOM" | "REWARDS" | "COURSE" | "MEMBERSHIP" | "MARKETING" | "SECURITY" | "ACCOUNT" | "PAYMENT" | "SYSTEM"; channel: "IN_APP" | "PUSH" | "EMAIL" | "SMS"; enabled: boolean; locale: "zh-CN"; consentVersion: number; dndWindow: M1016NotificationDndWindow; frequencyPolicy: "IMMEDIATE" | "DAILY_DIGEST" | "WEEKLY_DIGEST" | "DISABLED"; version: number; expectedVersion?: number; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationPreferenceCommand = { category: "LEARNING" | "REVIEW" | "STREAK" | "EXAM" | "CHECKPOINT" | "STUDY_ROOM" | "REWARDS" | "COURSE" | "MEMBERSHIP" | "MARKETING" | "SECURITY" | "ACCOUNT" | "PAYMENT" | "SYSTEM"; enabled: boolean; locale: "zh-CN"; consentVersion: number; dndWindow: { startLocalTime: string; endLocalTime: string; }; frequencyPolicy: "IMMEDIATE" | "DAILY_DIGEST" | "WEEKLY_DIGEST" | "DISABLED"; expectedVersion: number; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationMessage = { messageId: string; sourceEventId: string; requestId: string; principalId: string; notificationType: "LEARNING" | "REVIEW" | "STREAK" | "EXAM" | "CHECKPOINT" | "STUDY_ROOM" | "REWARDS" | "COURSE" | "MEMBERSHIP" | "MARKETING" | "SECURITY" | "ACCOUNT" | "PAYMENT" | "SYSTEM" | "ACCOUNT_VERIFICATION" | "SECURITY_ALERT" | "PHONE_BINDING_CHANGE" | "CRITICAL_ACCOUNT_PAYMENT"; category: "LEARNING" | "REVIEW" | "STREAK" | "EXAM" | "CHECKPOINT" | "STUDY_ROOM" | "REWARDS" | "COURSE" | "MEMBERSHIP" | "MARKETING" | "SECURITY" | "ACCOUNT" | "PAYMENT" | "SYSTEM"; channel: "IN_APP" | "PUSH" | "EMAIL" | "SMS"; templateKey: string; templateVersion: number; locale: "zh-CN"; parameterDigest: string; safeTitle?: string; safeBody?: string; deepLink?: string; dedupeKey: string; createdAt: string; pinned: boolean; readAt: string | null; expiresAt: string; deliveryStatus: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "RETRY_SCHEDULED" | "CANCELLED" | "DEAD_LETTER" | "MANUAL_RECOVERY"; contentVersionId: string; version: number; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationReadReceipt = { messageId: string; readAt: string; version: number; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationReadAllReceipt = { updatedCount: number; readAt: string; version: number; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationRetryCommand = { notificationId: string; deliveryVersion: number; expectedVersion: number; reasonCode: "TRANSIENT_PROVIDER" | "TIMEOUT" | "RATE_LIMIT" | "TEMPORARY_NETWORK"; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationRetryResult = { notificationId: string; deliveryVersion: number; state: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "RETRY_SCHEDULED" | "CANCELLED" | "DEAD_LETTER" | "MANUAL_RECOVERY"; attempt: number; maxAttempts: 5; nextAttemptAt: string | null; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationRecoveryCommand = { notificationId: string; deliveryVersion: number; expectedVersion: number; action: "SCHEDULE_RETRY" | "MOVE_TO_DLQ" | "REPLAY" | "MANUAL_RECOVERY"; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type M1016NotificationRecoveryResult = { notificationId: string; deliveryVersion: number; action: "SCHEDULE_RETRY" | "MOVE_TO_DLQ" | "REPLAY" | "MANUAL_RECOVERY"; state: "RECOVERED" | "RETRY_SCHEDULED" | "TERMINAL" | "REJECTED"; recoveryReceiptId: string; domainFactsUntouched: true; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportRestrictedContentRef = { contentRefId: string; sha256: string; redactionVersion: number; scanStatus: "PENDING" | "CLEAN" | "BLOCKED" | "ERROR"; objectVersion: number; safePreviewRef: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportAttachmentRef = { mediaAssetId: string; assetVersion: number; authorizationRef: string; scanStatus: "PENDING" | "CLEAN" | "BLOCKED" | "ERROR"; };

/**
 * Generated from the contract source.
 */
export type M1016SupportUsableContentRef = M1016SupportRestrictedContentRef & { scanStatus?: "CLEAN"; };

/**
 * Generated from the contract source.
 */
export type M1016SupportUsableAttachmentRef = M1016SupportAttachmentRef & { scanStatus?: "CLEAN"; };

/**
 * Generated from the contract source.
 */
export type M1016SupportAssignmentHistory = { assignmentVersion: number; fromQueueId: string; toQueueId: string; fromAssigneeRef: string | null; toAssigneeRef: string | null; reasonCode: string; changedAt: string; actorRef: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportAssignment = { queueId: string; assigneeRef: string | null; assignmentVersion: number; assignedAt: string | null; history: ReadonlyArray<M1016SupportAssignmentHistory>; };

/**
 * Generated from the contract source.
 */
export type M1016SupportSlaHistory = { policyRef: string; policyVersion: number; dueAt: string; status: "ON_TRACK" | "AT_RISK" | "BREACHED" | "PAUSED" | "RESOLVED"; pausedAt: string | null; resumedAt: string | null; reasonCode: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportSla = { policyRef: string; policyVersion: number; dueAt: string; status: "ON_TRACK" | "AT_RISK" | "BREACHED" | "PAUSED" | "RESOLVED"; history: ReadonlyArray<M1016SupportSlaHistory>; };

/**
 * Generated from the contract source.
 */
export type M1016SupportResolution = { resolutionCode: string; explanationContentRef: M1016SupportRestrictedContentRef; ownerResultRef: string; decidedAt: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportRetention = { retentionPolicyRef: string; retentionPolicyVersion: number; retentionUntil: string; legalHold: "CLEAR" | "HELD" | "UNKNOWN"; ownerReceiptRef: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportTicket = ({ ticketId: string; tenantId: string; requesterSubjectId: string; categoryCode: "ACCOUNT_SECURITY" | "CONTENT_CORRECTION" | "LEARNING_SYNC" | "MEDIA_DEVICE" | "ENTITLEMENT_ORDER" | "PRIVACY" | "OTHER"; resourceRef: string; priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"; descriptionContentRef: M1016SupportRestrictedContentRef; attachmentRefs?: readonly [] | readonly [M1016SupportAttachmentRef] | readonly [M1016SupportAttachmentRef, M1016SupportAttachmentRef] | readonly [M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef] | readonly [M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef] | readonly [M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef]; state: "OPEN" | "ASSIGNED" | "WAITING_USER" | "WAITING_INTERNAL" | "RESOLVED" | "CLOSED" | "REOPENED"; stateVersion: number; assignment: M1016SupportAssignment; sla: M1016SupportSla; retention: M1016SupportRetention; resolution?: M1016SupportResolution; createdAt: string; lastAuditId: string; }) & ({ state: "OPEN"; assignment: M1016SupportAssignment; resolution?: never; } | { state: "ASSIGNED" | "WAITING_USER" | "WAITING_INTERNAL" | "REOPENED"; assignment: { queueId: string; assigneeRef: string; assignmentVersion: number; assignedAt: string; history: ReadonlyArray<M1016SupportAssignmentHistory>; }; resolution?: never; } | { resolution: M1016SupportResolution; state: "RESOLVED" | "CLOSED"; assignment: { queueId: string; assigneeRef: string; assignmentVersion: number; assignedAt: string; history: ReadonlyArray<M1016SupportAssignmentHistory>; }; });

/**
 * Generated from the contract source.
 */
export type M1016SupportTicketCreateRequest = { categoryCode: "ACCOUNT_SECURITY" | "CONTENT_CORRECTION" | "LEARNING_SYNC" | "MEDIA_DEVICE" | "ENTITLEMENT_ORDER" | "PRIVACY" | "OTHER"; resourceRef: string; descriptionContentRef: M1016SupportUsableContentRef; attachmentRefs?: readonly [] | readonly [M1016SupportUsableAttachmentRef] | readonly [M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef] | readonly [M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef] | readonly [M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef] | readonly [M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef]; idempotencyKey: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportMessage = { messageId: string; ticketId: string; clientMessageRef: string; authorType: "LEARNER" | "SUPPORT_AGENT" | "SYSTEM"; bodyContentRef: M1016SupportRestrictedContentRef; bodyHash: string; redactionVersion: number; attachmentRefs?: readonly [] | readonly [M1016SupportAttachmentRef] | readonly [M1016SupportAttachmentRef, M1016SupportAttachmentRef] | readonly [M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef] | readonly [M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef] | readonly [M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef, M1016SupportAttachmentRef]; createdAt: string; messageVersion: number; lastAuditId: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportMessageCreateRequest = { clientMessageRef: string; bodyContentRef: M1016SupportUsableContentRef; attachmentRefs?: readonly [] | readonly [M1016SupportUsableAttachmentRef] | readonly [M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef] | readonly [M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef] | readonly [M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef] | readonly [M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef, M1016SupportUsableAttachmentRef]; expectedVersion: number; idempotencyKey: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportAssignCommand = { commandType: "ASSIGN"; queueId: string; assigneeRef: string; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportTransitionCommand = { commandType: "TRANSITION"; toState: "OPEN" | "ASSIGNED" | "WAITING_USER" | "WAITING_INTERNAL" | "RESOLVED" | "CLOSED" | "REOPENED"; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type M1016SupportResolveCommand = { commandType: "RESOLVE"; resolution: M1016SupportResolution; };

/**
 * Generated from the contract source.
 */
export type M1016SupportAdminCommandRequest = { command: M1016SupportAssignCommand | M1016SupportTransitionCommand | M1016SupportResolveCommand; expectedVersion: number; };

/**
 * Generated from the contract source.
 */
export type M1016SupportCommandResult = { commandId: string; ticketId: string; commandType: "ASSIGN" | "TRANSITION" | "RESOLVE"; state: "OPEN" | "ASSIGNED" | "WAITING_USER" | "WAITING_INTERNAL" | "RESOLVED" | "CLOSED" | "REOPENED"; accepted: boolean; receiptId: string; auditId: string; };

/**
 * Generated from the contract source.
 */
export type M1017AuditExportCreateRequest = { windowStart: string; windowEnd: string; scope: M1017AuditExportScope; eventFamilies: readonly [M1017AuditEventFamily] | readonly [M1017AuditEventFamily, M1017AuditEventFamily] | readonly [M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily] | readonly [M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily] | readonly [M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily] | readonly [M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily] | readonly [M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily] | readonly [M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily, M1017AuditEventFamily]; format: M1017AuditExportFormat; approvalRef: string; };

/**
 * Generated from the contract source.
 */
export type M1017AuditExportDownloadRequest = { expectedStateVersion: number; };

/**
 * Generated from the contract source.
 */
export type M1017AuditExportRecoveryRequest = { action: "RETRY" | "REBUILD_REDACTED_COPY" | "REVOKE_DOWNLOAD_GRANT"; expectedStateVersion: number; reasonCode: "OWNER_TIMEOUT" | "SOURCE_UNAVAILABLE" | "REDACTION_FAILURE" | "OPERATOR_REQUEST" | "POLICY_RECHECK"; };

/**
 * Generated from the contract source.
 */
export type M1017AuditExportScope = "TENANT" | "SUBJECT" | "PRIVACY_OPERATIONS" | "SECURITY_OPERATIONS";

/**
 * Generated from the contract source.
 */
export type M1017AuditEventFamily = "AUTH" | "ACCESS" | "ADMIN" | "PRIVACY" | "RECOVERY" | "DATA";

/**
 * Generated from the contract source.
 */
export type M1017AuditExportFormat = "JSONL" | "CSV";

/**
 * Generated from the contract source.
 */
export type M1017AuditExportState = "REQUESTED" | "PROCESSING" | "READY" | "RETRY_SCHEDULED" | "FAILED_RETRYABLE" | "FAILED_FINAL" | "EXPIRED" | "REVOKED";

/**
 * Generated from the contract source.
 */
export type M1017AuditFailureCode = "NONE" | "OWNER_TIMEOUT" | "SOURCE_UNAVAILABLE" | "REDACTION_FAILURE" | "LEGAL_HOLD" | "POLICY_DENIED" | "RETRY_BUDGET_EXHAUSTED";

/**
 * Generated from the contract source.
 */
export type M1017AuditExportCreateResponse = { exportId: M1017AuditExportIdValue; state: M1017AuditExportState; stateVersion: number; requestDigest: M1017Sha256Digest; auditId: M1017AuditId; createdAt: string; expiresAt: string; redacted: true; owner: "audit-service"; tenantScope: "server-derived"; runtimeStatus: "NOT_RUNTIME_VERIFIED"; };

/**
 * Generated from the contract source.
 */
export type M1017AuditExportStatusResponse = { exportId: M1017AuditExportIdValue; state: M1017AuditExportState; stateVersion: number; requestDigest: M1017Sha256Digest; auditId: M1017AuditId; createdAt: string; expiresAt: string; redacted: true; owner: "audit-service"; tenantScope: "server-derived"; attempt: number; retryable: boolean; lastFailureCode: M1017AuditFailureCode; recoveryReceiptRef: string; downloadAvailable: boolean; domainFactsUntouched: true; runtimeStatus: "NOT_RUNTIME_VERIFIED"; };

/**
 * Generated from the contract source.
 */
export type M1017AuditExportDownloadGrant = { exportId: M1017AuditExportIdValue; grantRef: string; contentDigest: M1017Sha256Digest; expiresAt: string; oneTime: true; redacted: true; auditId: M1017AuditId; downloadAuditId: M1017AuditId; };

/**
 * Generated from the contract source.
 */
export type M1017AuditExportRecoveryReceipt = { exportId: M1017AuditExportIdValue; action: "RETRY" | "REBUILD_REDACTED_COPY" | "REVOKE_DOWNLOAD_GRANT"; state: M1017AuditExportState; attempt: number; retryable: boolean; recoveryReceiptRef: string; auditId: M1017AuditId; occurredAt: string; redacted: true; domainFactsUntouched: true; owner: "audit-service"; workflowOwner: "workflow-service"; };

/**
 * Generated from the contract source.
 */
export type M1017AuditRecordSummary = { auditId: M1017AuditId; actorSubjectHash: M1017Sha256Digest; tenantHash: M1017Sha256Digest; action: "EXPORT_REQUEST" | "EXPORT_STATUS_READ" | "DOWNLOAD_ISSUED" | "RECOVERY_RECORDED"; resourceRef: string; decision: "ALLOW" | "DENY"; reasonCode: M1017AuditFailureCode; decisionId: string; requestId: string; traceId: string; commandId: string; eventId: string; occurredAt: string; beforeDigest: M1017Sha256Digest; afterDigest: M1017Sha256Digest; previousHash: M1017Sha256Digest; recordHash: M1017Sha256Digest; redacted: true; appendOnly: true; };

/**
 * Generated from the contract source.
 */
export type M1017AuditId = string;

/**
 * Generated from the contract source.
 */
export type M1017AuditExportIdValue = string;

/**
 * Generated from the contract source.
 */
export type M1017Sha256Digest = string;

/**
 * Generated from the contract source.
 */
export type M1017PrivacyExportRequest = { reauthenticationRef: string; scope: "ACCOUNT_AND_LEARNER_DATA"; purposeCode: "DATA_EXPORT"; };

/**
 * Generated from the contract source.
 */
export type M1017PrivacyExport = { exportId: string; status: "REQUESTED" | "COLLECTING" | "ASSEMBLING" | "READY" | "DOWNLOAD_ISSUED" | "EXPIRED" | "FAILED" | "RECOVERY_REQUIRED"; scope: "ACCOUNT_AND_LEARNER_DATA"; requestedAt: string; expiresAt: string; policyVersion: string; receiptSummary: M1017ReceiptSummary; download: M1017DownloadAvailability; recovery: M1017RecoveryStatus; };

/**
 * Generated from the contract source.
 */
export type M1017PrivacyDownloadGrant = { exportId: string; downloadUrl: string; expiresAt: string; oneTime: true; cacheControl: "no-store"; };

/**
 * Generated from the contract source.
 */
export type M1017PrivacyExportReceipt = { exportId: string; status: "READY" | "EXPIRED" | "FAILED" | "RECOVERY_REQUIRED"; aggregateDigest: string; ownerReceipts: readonly [M1017OwnerReceiptSummary, ...Array<M1017OwnerReceiptSummary>]; issuedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1017OwnerReceiptSubmission = { receiptId: string; taskVersion: number; outcome: "COLLECTED" | "NO_DATA" | "DELETED" | "ANONYMIZED" | "RETAINED_LEGAL_HOLD" | "FAILED"; artifactDigest: string; legalHoldDecision: "CLEARED" | "ACTIVE_RETAINED"; completedAt: string; failureCode?: string; };

/**
 * Generated from the contract source.
 */
export type M1017OwnerReceiptSummary = { ownerService: string; receiptId: string; taskVersion: number; outcome: "COLLECTED" | "NO_DATA" | "DELETED" | "ANONYMIZED" | "RETAINED_LEGAL_HOLD" | "FAILED"; artifactDigest: string; legalHoldDecision: "CLEARED" | "ACTIVE_RETAINED"; completedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1017ReceiptSummary = { expectedOwnerCount: number; receivedOwnerCount: number; hasFailure: boolean; legalHoldDecision: "CLEARED" | "ACTIVE_RETAINED" | "NOT_APPLICABLE"; };

/**
 * Generated from the contract source.
 */
export type M1017DownloadAvailability = { availability: "NOT_READY" | "AVAILABLE" | "EXPIRED"; oneTime: true; cacheControl: "no-store"; };

/**
 * Generated from the contract source.
 */
export type M1017RecoveryStatus = { state: "NONE" | "REQUIRED"; recoveryTaskRef?: string; };

/**
 * Generated from the contract source.
 */
export type M1017PrivacyRecoveryCommand = { action: "RETRY_FAILED_OWNER" | "RECONCILE_RECEIPTS" | "EXPIRE_INCOMPLETE_EXPORT"; recoveryReason: "OWNER_FAILURE" | "DELIVERY_TIMEOUT" | "RECONCILIATION_MISMATCH"; };

/**
 * Generated from the contract source.
 */
export type M1017AccountDeletionRequest = { reauthenticationRef: string; confirmation: "DELETE_ACCOUNT"; reasonCode: "USER_REQUEST"; };

/**
 * Generated from the contract source.
 */
export type M1017AccountDeletionCancelRequest = { reauthenticationRef: string; };

/**
 * Generated from the contract source.
 */
export type M1017AccountDeletion = { deletionRequestId: string; status: "PENDING_COOLING_OFF" | "CANCELLED" | "EXECUTING" | "RECOVERY_REQUIRED" | "ANONYMIZED"; requestedAt: string; executeAt: string; coolingOffHours: 168; sessionRevocationState: "NOT_STARTED" | "REVOKED"; receiptSummary: M1017ReceiptSummary; legalHoldSummary: "CLEARED" | "ACTIVE_RETAINED" | "NOT_APPLICABLE"; recovery: M1017RecoveryStatus; };

/**
 * Generated from the contract source.
 */
export type M1017AccountDeletionReceipt = { deletionRequestId: string; status: "RECOVERY_REQUIRED" | "ANONYMIZED"; sessionRevocationState: "REVOKED"; ownerReceipts: readonly [M1017OwnerReceiptSummary, ...Array<M1017OwnerReceiptSummary>]; issuedAt: string; };

/**
 * Generated from the contract source.
 */
export type M1017DeletionRecoveryCommand = { action: "RETRY_FAILED_OWNER" | "RECONCILE_RECEIPTS" | "ESCALATE_MANUAL_REVIEW"; recoveryReason: "OWNER_FAILURE" | "RECONCILIATION_MISMATCH" | "LEGAL_HOLD_REVIEW"; };

/**
 * Generated from the contract source.
 */
export type M1017PrivacyExportEnvelope = ApiSuccessEnvelope & { data: M1017PrivacyExport; };

/**
 * Generated from the contract source.
 */
export type M1017PrivacyDownloadGrantEnvelope = ApiSuccessEnvelope & { data: M1017PrivacyDownloadGrant; };

/**
 * Generated from the contract source.
 */
export type M1017PrivacyReceiptEnvelope = ApiSuccessEnvelope & { data: M1017PrivacyExportReceipt; };

/**
 * Generated from the contract source.
 */
export type M1017AccountDeletionEnvelope = ApiSuccessEnvelope & { data: M1017AccountDeletion; };

/**
 * Generated from the contract source.
 */
export type M1017AccountDeletionReceiptEnvelope = ApiSuccessEnvelope & { data: M1017AccountDeletionReceipt; };

/**
 * Generated from the contract source.
 */
export type M1017AnalyticsTelemetryRequest = ({ clientEventId: string; eventName: "ui.page.viewed.v1" | "ui.element.clicked.v1" | "ui.media.playback.started.v1" | "telemetry.error.v1"; eventVersion: "1.0.0"; occurredAt: string; payload: M1017UiPageViewedPayload | M1017UiElementClickedPayload | M1017UiMediaPlaybackStartedPayload | M1017TelemetryErrorPayload; }) & ({ eventName: "ui.page.viewed.v1"; payload: M1017UiPageViewedPayload; } | { eventName: "ui.element.clicked.v1"; payload: M1017UiElementClickedPayload; } | { eventName: "ui.media.playback.started.v1"; payload: M1017UiMediaPlaybackStartedPayload; } | { eventName: "telemetry.error.v1"; payload: M1017TelemetryErrorPayload; });

/**
 * Generated from the contract source.
 */
export type M1017UiPageViewedPayload = { schema: "ui.page.viewed"; pageCode: string; surfaceCode?: string; locale?: string; };

/**
 * Generated from the contract source.
 */
export type M1017UiElementClickedPayload = { schema: "ui.element.clicked"; pageCode: string; elementCode: string; interactionCode: string; };

/**
 * Generated from the contract source.
 */
export type M1017UiMediaPlaybackStartedPayload = { schema: "ui.media.playback.started"; mediaKind: "LESSON_AUDIO" | "LESSON_VIDEO" | "PRONUNCIATION"; durationBucket: "LT_10S" | "10S_60S" | "GT_60S"; contentRef?: string; };

/**
 * Generated from the contract source.
 */
export type M1017TelemetryErrorPayload = { schema: "telemetry.error"; errorCode: string; category: string; };

/**
 * Generated from the contract source.
 */
export type M1017AnalyticsTelemetryReceipt = { receiptId: string; clientEventId: string; state: "ACCEPTED" | "SUPPRESSED" | "REPLAYED" | "REJECTED"; replayed: boolean; suppressionReason?: "CONSENT_MISSING" | "CONSENT_REVOKED" | "DELETION_PENDING" | "DELETION_EXECUTED" | "TRUSTED_CONTEXT_UNAVAILABLE"; redactionVersion: "analytics-redaction-v1"; policyVersion: "1.0.0"; domainFactsUntouched: true; };

/**
 * Generated from the contract source.
 */
export type LexemeExample = { en: string; cn: string; source?: string; };

/**
 * One word sense. At least one of meaningCn (legacy Chinese gloss, retained for compatibility) or meaningLocal (generic local-language gloss) is required; server-side validation rejects a sense carrying neither.
 */
export type LexemeSense = { pos: "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "PREFIX" | "SUFFIX" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE"; meaningCn?: string; meaningLocal?: string; meaningEn?: string; examples?: readonly [] | readonly [LexemeExample] | readonly [LexemeExample, LexemeExample] | readonly [LexemeExample, LexemeExample, LexemeExample] | readonly [LexemeExample, LexemeExample, LexemeExample, LexemeExample] | readonly [LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample] | readonly [LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample] | readonly [LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample] | readonly [LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample] | readonly [LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample] | readonly [LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample, LexemeExample]; synonyms?: ReadonlyArray<string>; antonyms?: ReadonlyArray<string>; confusables?: ReadonlyArray<string>; usageNote?: string; };

/**
 * Generated from the contract source.
 */
export type LexemePronunciationInput = { pronunciationId?: string; accent: string; ipa: string; audioAssetId: string; sourceType: "HUMAN" | "TTS"; voiceName?: string; durationMs?: number; sampleRate?: number; bitrateKbps?: number; qcStatus?: "PENDING" | "READY" | "CLEAN" | "FAILED"; };

/**
 * Generated from the contract source.
 */
export type LexemePronunciation = { pronunciationId: string; accent: string; ipa: string; audioAssetId: string; sourceType: "HUMAN" | "TTS"; voiceName?: string; durationMs?: number; sampleRate?: number; bitrateKbps?: number; qcStatus: "PENDING" | "READY" | "CLEAN" | "FAILED"; qcBy?: string; qcAt?: B9DateTime; createdAt?: B9DateTime; };

/**
 * Row-level word master. Lexemes live under a vocabulary pack (contentCode, kind VOCABULARY); the pack is auto-provisioned on first LEXEME_UPSERT.
 */
export type LexemeUpsertInput = { lexemeId?: string; headword: string; language?: B9Locale; lemma?: string; pos?: readonly [] | readonly ["NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE"] | readonly ["NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE", "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE"] | readonly ["NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE", "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE", "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE"] | readonly ["NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE", "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE", "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE", "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE"] | readonly ["NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE", "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE", "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE", "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE", "NOUN" | "VERB" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "INTERJ" | "PHRASE" | "ARTICLE" | "PRONOUN" | "DETERMINER" | "PREPOSITION" | "CONJUNCTION" | "INTERJECTION" | "NUMERAL" | "PARTICLE"]; cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; difficulty?: number; syllables?: readonly [] | readonly [string] | readonly [string, string] | readonly [string, string, string] | readonly [string, string, string, string] | readonly [string, string, string, string, string] | readonly [string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string, string]; stressIndex?: number; phoneticUS?: string; phoneticUK?: string; audioUsAssetId?: string; audioUkAssetId?: string; audioSlowAssetId?: string; senses?: readonly [] | readonly [LexemeSense] | readonly [LexemeSense, LexemeSense] | readonly [LexemeSense, LexemeSense, LexemeSense] | readonly [LexemeSense, LexemeSense, LexemeSense, LexemeSense] | readonly [LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense] | readonly [LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense] | readonly [LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense] | readonly [LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense] | readonly [LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense] | readonly [LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense] | readonly [LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense] | readonly [LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense, LexemeSense]; collocations?: ReadonlyArray<{ text: string; meaningCn: string; }>; morphology?: { root?: string; prefix?: string; suffix?: string; }; gender?: "MASCULINE" | "FEMININE" | "NEUTER"; number?: "SINGULAR" | "PLURAL"; grammaticalCase?: "NOMINATIVE" | "ACCUSATIVE" | "DATIVE" | "GENITIVE" | "INSTRUMENTAL" | "PREPOSITIONAL"; conjugation?: { verbGroup?: string; irregular?: boolean; }; mnemonics?: { keyword?: string; storyCn?: string; }; examFreq?: number; tags?: ReadonlyArray<string>; sourceCode?: string; licenseCode?: string; };

/**
 * Generated from the contract source.
 */
export type LexemeRecord = { lexemeId: string; headword: string; language?: B9Locale; lemma?: string; pos?: readonly [] | readonly [string] | readonly [string, string] | readonly [string, string, string] | readonly [string, string, string, string] | readonly [string, string, string, string, string]; cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; difficulty?: number; syllables?: readonly [] | readonly [string] | readonly [string, string] | readonly [string, string, string] | readonly [string, string, string, string] | readonly [string, string, string, string, string] | readonly [string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string, string, string, string, string]; stressIndex?: number; phoneticUS?: string; phoneticUK?: string; audioUsAssetId?: string; audioUkAssetId?: string; audioSlowAssetId?: string; senses?: ReadonlyArray<LexemeSense>; collocations?: ReadonlyArray<Record<string, never>>; morphology?: Record<string, never>; gender?: "MASCULINE" | "FEMININE" | "NEUTER"; number?: "SINGULAR" | "PLURAL"; grammaticalCase?: "NOMINATIVE" | "ACCUSATIVE" | "DATIVE" | "GENITIVE" | "INSTRUMENTAL" | "PREPOSITIONAL"; conjugation?: Record<string, never>; mnemonics?: Record<string, never>; examFreq?: number; tags?: ReadonlyArray<string>; sourceCode?: string; licenseCode?: string; packCode: string; availability: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED"; stateVersion: B9StateVersion; contentVersion: number; pronunciations?: ReadonlyArray<LexemePronunciation>; createdBy?: string; updatedBy?: string; createdAt?: B9DateTime; updatedAt?: B9DateTime; publishedFields?: Record<string, never>; };

/**
 * Row-level content item (question/example/grammar/passage/exercise/dictation/shadowing) under a pack. Rich configuration travels in fields and never requires DDL.
 */
export type ContentItemUpsertInput = { itemId?: string; kind: "QUESTION" | "EXAMPLE" | "GRAMMAR_POINT" | "PASSAGE" | "EXERCISE" | "DICTATION" | "SHADOWING"; stem?: string; fields?: { [key: string]: unknown; }; sourceCode?: string; licenseCode?: string; };

/**
 * Generated from the contract source.
 */
export type ContentItemRecord = { itemId: string; kind: "QUESTION" | "EXAMPLE" | "GRAMMAR_POINT" | "PASSAGE" | "EXERCISE" | "DICTATION" | "SHADOWING"; stem?: string; packCode: string; availability: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED"; stateVersion: B9StateVersion; fields?: { [key: string]: unknown; }; sourceCode?: string; licenseCode?: string; createdBy?: string; updatedBy?: string; createdAt?: B9DateTime; updatedAt?: B9DateTime; };

/**
 * Generated from the contract source.
 */
export type AdminLearnerSubject = { subjectId: string; tenantId: string; };

/**
 * Generated from the contract source.
 */
export type AdminLearnerProfile = { subjectId: string; profile: Record<string, never>; firstDay?: Record<string, never>; };

/**
 * Generated from the contract source.
 */
export type AdminLearnerCommandRequest = { command: "SET_GOAL" | "UPDATE_PREFERENCES"; expectedStateVersion: B9StateVersion; goalType?: "FOUNDATION" | "CET_4_6" | "POSTGRADUATE" | "WORKPLACE" | "LANGUAGE_CERT"; dailyMinutes?: 5 | 15 | 30 | 45; targetDate?: string; startingLevel?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; examName?: string; language?: string; uiLocale?: string; contentLocale?: string; themeMode?: "LIGHT" | "DARK" | "SYSTEM" | "HIGH_CONTRAST"; timezone?: string; reducedMotion?: boolean; };

/**
 * Generated from the contract source.
 */
export type AdminLearnerCommandAccepted = { command: "SET_GOAL" | "UPDATE_PREFERENCES"; subjectId: string; profileVersion: B9StateVersion; replayed?: boolean; adminSubject?: string; status: "ACCEPTED"; };

/**
 * Generated from the contract source.
 */
export type AdminLearningCommandRequest = { command: "RESET_SRS_ITEM"; itemId: string; reasonCode?: string; };

/**
 * 管理审核队列的最小披露视图。房间和被举报人只返回稳定的不透明引用，原始主体标识留在 social-service。
 */
export type B12AdminReport = { reportId: string; roomRef?: string | null; targetRef: string; targetSeatIndex?: number; reasonCode: string; status: "RECEIVED" | "TRIAGED" | "ACTIONED" | "REJECTED" | "APPEALED" | "CLOSED"; reviewMode: "MANUAL"; createdAt: string; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type PlacementBankSealedSnapshotResponse = { data: PlacementBankSealedSnapshot; };

/**
 * Sealed P1 placement bank delivery. Stem, options, item code, dimension, display order and content version only. answer_rule_json stays in the owner table and is not on this route. Scoring read is left to R1-021.
 */
export type PlacementBankSealedSnapshot = { bankCode: "P1_PLACEMENT_V1"; contentVersionId: B10Int64Id; contentEpoch: B10ContentEpoch; contentStateVersion: number; snapshotId: B10SnapshotId; snapshotHash: B10Sha256; items: readonly [PlacementBankSealedItem, PlacementBankSealedItem, PlacementBankSealedItem, PlacementBankSealedItem, PlacementBankSealedItem, PlacementBankSealedItem, PlacementBankSealedItem, PlacementBankSealedItem, PlacementBankSealedItem, PlacementBankSealedItem]; };

/**
 * Generated from the contract source.
 */
export type PlacementBankSealedItem = { itemId: B10Int64Id; itemCode: string; itemType: "VOCABULARY" | "GRAMMAR" | "READING" | "LISTENING"; dimension: "VOCABULARY" | "BASIC_GRAMMAR" | "READING" | "LISTENING"; displayOrder: number; stem: string; options: readonly [B10ContentItemOption, B10ContentItemOption, ...Array<B10ContentItemOption>]; contentVersionId: B10Int64Id; };

/**
 * Server-verified placement pin. Only learning-service calls this after verifying the placement report; learners never self-pin content.
 */
export type B9TargetPinRequest = { targetId: number; contentVersionId: number; contentEpoch: number; placementReportId: string; };

/**
 * Generated from the contract source.
 */
export type B9TargetPinResult = { targetId: number; contentVersionId: number; contentEpoch: number; pinned: boolean; replayed: boolean; };

/**
 * Generated from the contract source.
 */
export type PlacementBankPlanItemsResponse = { data: PlacementBankPlanItems; };

/**
 * Answer-free plan task seeds. Identifiers and display order only; no stems, options or answer rules.
 */
export type PlacementBankPlanItems = { bankCode: "P1_PLACEMENT_V1"; contentVersionId: B10Int64Id; contentEpoch: B10ContentEpoch; contentStateVersion: number; items: readonly [PlacementBankPlanSeed, ...Array<PlacementBankPlanSeed>]; };

/**
 * Answer-free plan task seed. practiceRef is an answer-free pointer the client resolves into a B10 session; it carries no stems, options or answer rules.
 */
export type PlacementBankPlanSeed = { itemId: B10Int64Id; itemCode: string; itemType: "VOCABULARY" | "GRAMMAR" | "READING" | "LISTENING"; dimension: "VOCABULARY" | "BASIC_GRAMMAR" | "READING" | "LISTENING"; displayOrder: number; practiceRef?: B10PracticeRef; };

/**
 * The client supplies only a placement report pointer; target, placement, content and plan facts are all server-derived and verified.
 */
export type B10EnsurePlanRequest = { placementReportId: string; };

/**
 * Ensured plan with its immutable planning input. planningInput/plan are present exactly when status is ACTIVE; EMPTY carries neither (honest empty, not a plan).
 */
export type B10EnsurePlanResult = { planId: string; status: "ACTIVE" | "EMPTY"; targetMinutes: number; planVersion: number; replayed: boolean; planningInput?: B9PlanningInputSnapshot; plan?: B9PlanReference; tasks: ReadonlyArray<unknown>; };

/**
 * 绑定不可变版本与哈希的服务端校验事实；客户端只能引用其 ID 做乐观绑定，重放与发布时服务端按版本+哈希重查，旧报告不能为新版本背书。
 */
export type B9ValidationReport = { reportId: B9ContentValidationReportId; reportVersion: B9EvidenceVersion; contentVersionId: B9ContentVersionId; contentHash: string; ruleVersion: string; passed: boolean; findingCount: number; blockers: number; mediaRefs: ReadonlyArray<string>; checkedBy: string; checkedAt: B9DateTime; };

/**
 * Minimal-disclosure lockout fact. Raw identity stays in IAM; callers receive only the opaque stable subject reference plus lockout state.
 */
export type B8LockedAccount = { subjectRef: string; failedAttempts: number; lockedUntil: string; updatedAt: string; };

/**
 * Ops-owned risk coordination fact. Containment and escalation are recorded here; domain actions stay in their owner flows and are referenced, never executed by this object.
 */
export type AdminRiskCase = { caseId: string; category: "ACCOUNT_SECURITY" | "DEVICE_ANOMALY" | "PAYMENT_ANOMALY" | "ACTIVATION_ABUSE" | "EXPORT_ANOMALY" | "CONTENT_RIGHTS"; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; status: "OPEN" | "TRIAGED" | "ACTIONED" | "ESCALATED" | "CLOSED"; source: "ANALYST_FILED" | "RULE_HIT"; ruleId?: string; ruleVersion?: string; title: string; subjectRef?: string; evidenceRefs?: readonly [] | readonly [string] | readonly [string, string] | readonly [string, string, string] | readonly [string, string, string, string] | readonly [string, string, string, string, string] | readonly [string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string]; assigneeNote?: string; containmentRef?: string; escalationTarget?: "SUPPORT" | "AUDIT"; escalationRef?: string; closedReason?: string; stateVersion: number; decisions: ReadonlyArray<{ decisionId: string; command: "TRIAGE" | "ISOLATE" | "UNISOLATE" | "ESCALATE" | "CLOSE"; reason: string; decidedBy: string; decidedAt: string; }>; createdAt: string; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type AdminRiskFileRequest = { category: "ACCOUNT_SECURITY" | "DEVICE_ANOMALY" | "PAYMENT_ANOMALY" | "ACTIVATION_ABUSE" | "EXPORT_ANOMALY" | "CONTENT_RIGHTS"; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; title: string; subjectRef?: string; evidenceRefs?: readonly [] | readonly [string] | readonly [string, string] | readonly [string, string, string] | readonly [string, string, string, string] | readonly [string, string, string, string, string] | readonly [string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string] | readonly [string, string, string, string, string, string, string, string]; note?: string; };

/**
 * Generated from the contract source.
 */
export type AdminRiskDecisionRequest = { command: "TRIAGE" | "ISOLATE" | "UNISOLATE" | "ESCALATE" | "CLOSE"; reason: string; assigneeNote?: string; containmentRef?: string; escalationTarget?: "SUPPORT" | "AUDIT"; escalationRef?: string; };

/**
 * Generated from the contract source.
 */
export type AdminRiskEvaluateRequest = { rules?: readonly [] | readonly ["ACCOUNT_LOCKOUT"] | readonly ["ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT"] | readonly ["ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT"] | readonly ["ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT"] | readonly ["ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT"] | readonly ["ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT"] | readonly ["ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT"] | readonly ["ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT", "ACCOUNT_LOCKOUT"]; since?: string; };

/**
 * Generated from the contract source.
 */
export type AdminRiskEvaluateResult = { evaluatedAt: string; rulesChecked: number; casesFiled: number; caseIds: ReadonlyArray<string>; };

/**
 * Answer-free practice pointer: identifies gradable content without carrying stems, options or answer rules. The client resolves it into a B10 session; assessment fetches rules server-side.
 */
export type B10PracticeRef = { contentCode: string; contentVersionId: B10Int64Id; questionItemId: string; };

/**
 * Live learning-consent fact for a trusted PEP. GRANTED/ELIGIBLE only when every LEARNING-required consent is currently accepted against the published document.
 */
export type B8LearningConsentFact = { principalId: string; learningConsent: "GRANTED" | "WITHDRAWN"; learningAccess: "ELIGIBLE" | "RESTRICTED"; };

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
  getHealth: { method: "GET"; path: "/api/v1/health"; request: never; response: ApiSuccessEnvelope & { data: HealthData; }; idempotent: false };
  createContentEntity: { method: "POST"; path: "/api/v1/content"; request: B1CreateContentRequest; response: ApiSuccessEnvelope & { data: B1ContentVersion; }; idempotent: true };
  createContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions"; request: B1CreateVersionRequest; response: ApiSuccessEnvelope & { data: B1ContentVersion; }; idempotent: true };
  previewContentVersion: { method: "GET"; path: "/api/v1/content/{contentId}/versions/{versionId}/preview"; request: never; response: ApiSuccessEnvelope & { data: B1ContentVersion; }; idempotent: false };
  diffContentVersions: { method: "GET"; path: "/api/v1/content/{contentId}/versions/{versionId}/diff"; request: never; response: ApiSuccessEnvelope & { data: B1ContentDiff; }; idempotent: false };
  submitContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/submit"; request: B1ActorRequest; response: ApiSuccessEnvelope & { data: B1ContentVersion; }; idempotent: true };
  decideContentVersionReview: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/review"; request: B1ReviewDecisionRequest; response: ApiSuccessEnvelope & { data: B1ContentVersion; }; idempotent: true };
  publishContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/publish"; request: B1ActorRequest; response: ApiSuccessEnvelope & { data: B1ContentVersion; }; idempotent: true };
  archiveContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/archive"; request: B1ActorReasonRequest; response: ApiSuccessEnvelope & { data: B1ContentVersion; }; idempotent: true };
  restoreContentVersion: { method: "POST"; path: "/api/v1/content/{contentId}/versions/{versionId}/restore"; request: B1ActorReasonRequest; response: ApiSuccessEnvelope & { data: B1ContentVersion; }; idempotent: true };
  importContentBatch: { method: "POST"; path: "/api/v1/content/imports"; request: B1ImportRequest; response: ApiSuccessEnvelope & { data: B1ImportReport; }; idempotent: true };
  createContentMediaUploadIntent: { method: "POST"; path: "/api/v1/content/media/upload-intents"; request: B1MediaUploadRequest; response: ApiSuccessEnvelope & { data: B1MediaUploadIntent; }; idempotent: true };
  completeContentMediaUpload: { method: "POST"; path: "/api/v1/content/media/{mediaAssetId}/complete"; request: B1MediaCompleteRequest; response: ApiSuccessEnvelope & { data: B1MediaAsset; }; idempotent: true };
  signContentMediaAccess: { method: "POST"; path: "/api/v1/content/media/{mediaAssetId}/signed-access"; request: B1MediaAccessRequest; response: ApiSuccessEnvelope & { data: B1SignedMediaAccess; }; idempotent: true };
  getContentOfflineManifest: { method: "GET"; path: "/api/v1/content/offline/manifests/{manifestCode}"; request: never; response: ApiSuccessEnvelope & { data: B1OfflineManifest; }; idempotent: false };
  getPublishedContent: { method: "GET"; path: "/api/v1/content/{contentId}"; request: never; response: ApiSuccessEnvelope & { data: B1LearnerContent; }; idempotent: false };
  readPlacementSession: { method: "GET"; path: "/api/v1/assessment/placement/start"; request: never; response: ApiSuccessEnvelope & { data: B1AssessmentReadResponse; }; idempotent: false };
  startPlacementSession: { method: "POST"; path: "/api/v1/assessment/placement/start"; request: never; response: ApiSuccessEnvelope & { data: B1AssessmentStartResponse; }; idempotent: true };
  submitPlacementStep: { method: "POST"; path: "/api/v1/assessment/placement/submit-step"; request: B1AssessmentStepRequest; response: ApiSuccessEnvelope & { data: B1AssessmentStepResponse; }; idempotent: true };
  createPrivacyExport: { method: "POST"; path: "/api/v1/privacy/export"; request: B1PrivacyExportRequest; response: ApiSuccessEnvelope & { data: B1PrivacyExportResponse; }; idempotent: true };
  registerB8Account: { method: "POST"; path: "/api/v1/auth/register"; request: B8RegisterRequest; response: B8AuthTokenEnvelope; idempotent: true };
  logoutB8JwtSession: { method: "POST"; path: "/api/v1/auth/logout"; request: B8LogoutRequest; response: ApiSuccessEnvelope & { data: B8SessionRevocationResponse; }; idempotent: true };
  revokeB8JwtSession: { method: "POST"; path: "/api/v1/auth/sessions/{sessionId}/revoke"; request: never; response: ApiSuccessEnvelope & { data: B8SessionRevocationResponse; }; idempotent: true };
  getB1OnboardingOptions: { method: "GET"; path: "/api/v1/onboarding/options"; request: never; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: false };
  getB1OnboardingProfile: { method: "GET"; path: "/api/v1/onboarding/profile"; request: never; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: false };
  saveB1OnboardingProfile: { method: "POST"; path: "/api/v1/onboarding/profile"; request: B1OnboardingProfileRequest; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: true };
  patchB1OnboardingProfile: { method: "PATCH"; path: "/api/v1/onboarding/profile"; request: B1OnboardingProfileRequest; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: true };
  createB1FirstGoal: { method: "POST"; path: "/api/v1/onboarding/goals/first"; request: never; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: true };
  getB1DailyTasks: { method: "GET"; path: "/api/v1/onboarding/daily-tasks/today"; request: never; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: false };
  completeB1DailyTask: { method: "POST"; path: "/api/v1/onboarding/daily-tasks/{taskId}/complete"; request: never; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: true };
  reorderB1DailyTasks: { method: "POST"; path: "/api/v1/onboarding/daily-tasks/reorder"; request: never; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: true };
  skipB1Placement: { method: "POST"; path: "/api/v1/assessment/placement/skip"; request: B1PlacementSkipRequest; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: true };
  getB1PlacementReport: { method: "GET"; path: "/api/v1/assessment/placement/report/{sessionId}"; request: never; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: false };
  getB1ContinueContext: { method: "GET"; path: "/api/v1/learning/continue-context"; request: never; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: false };
  saveB1ContinueContext: { method: "PUT"; path: "/api/v1/learning/continue-context"; request: B1AnyData; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: true };
  saveB1LearningCheckpoint: { method: "PUT"; path: "/api/v1/sync/checkpoints/{lessonId}"; request: B1AnyData; response: ApiSuccessEnvelope & { data: B1AnyData; }; idempotent: true };
  getB2DailyStream: { method: "GET"; path: "/api/v1/assessment/daily-stream"; request: never; response: ApiSuccessEnvelope & { data: B2Session; }; idempotent: false };
  createB10AssessmentSession: { method: "POST"; path: "/api/v1/assessment/sessions"; request: B10CreateAssessmentSessionRequest; response: ApiSuccessEnvelope & { data: B10AssessmentSession; }; idempotent: true };
  getB10AssessmentSession: { method: "GET"; path: "/api/v1/assessment/sessions/{sessionId}"; request: never; response: ApiSuccessEnvelope & { data: B10AssessmentSession; }; idempotent: false };
  submitB2AssessmentAnswer: { method: "POST"; path: "/api/v1/assessment/sessions/{sessionId}/answers"; request: B2AnswerSubmissionRequest; response: ApiSuccessEnvelope & { data: B2AnswerResult; }; idempotent: true };
  putB10AssessmentSessionCheckpoint: { method: "PUT"; path: "/api/v1/assessment/sessions/{sessionId}/checkpoint"; request: B10AssessmentSessionCheckpointRequest; response: ApiSuccessEnvelope & { data: B10AssessmentCheckpoint; }; idempotent: true };
  completeB2AssessmentSession: { method: "POST"; path: "/api/v1/assessment/sessions/{sessionId}/complete"; request: never; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: true };
  listB2ExamPapers: { method: "GET"; path: "/api/v1/exam/papers"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<Record<string, never>>; }; idempotent: false };
  getB2ExamPaper: { method: "GET"; path: "/api/v1/exam/papers/{paperId}"; request: never; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: false };
  createB2ExamSession: { method: "POST"; path: "/api/v1/exam/sessions"; request: B2CreateExamSessionRequest; response: ApiSuccessEnvelope & { data: B2Session; }; idempotent: true };
  getB2ExamSession: { method: "GET"; path: "/api/v1/exam/sessions/{sessionId}"; request: never; response: ApiSuccessEnvelope & { data: B2Session; }; idempotent: false };
  b2ExamHeartbeat: { method: "POST"; path: "/api/v1/exam/sessions/{sessionId}/heartbeat"; request: B2HeartbeatRequest; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: true };
  recordB2AntiCheatEvent: { method: "POST"; path: "/api/v1/exam/sessions/{sessionId}/anti-cheat-events"; request: B2AntiCheatEventRequest; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: true };
  getB2AnswerSheet: { method: "GET"; path: "/api/v1/exam/sessions/{sessionId}/answer-sheet"; request: never; response: ApiSuccessEnvelope & { data: { page?: Record<string, never>; items?: ReadonlyArray<Record<string, never>>; }; }; idempotent: false };
  updateB2AnswerSheetMark: { method: "POST"; path: "/api/v1/exam/sessions/{sessionId}/answer-sheet/marks"; request: B2AnswerSheetMarkRequest; response: ApiSuccessEnvelope & { data: { page?: Record<string, never>; items?: ReadonlyArray<Record<string, never>>; }; }; idempotent: true };
  saveB2ExamCheckpoint: { method: "PUT"; path: "/api/v1/exam/sessions/{sessionId}/checkpoint"; request: B2CheckpointRequest; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: true };
  submitB2ExamAnswer: { method: "POST"; path: "/api/v1/exam/sessions/{sessionId}/answers"; request: B2AnswerSubmissionRequest; response: ApiSuccessEnvelope & { data: B2AnswerResult; }; idempotent: true };
  submitB2Exam: { method: "POST"; path: "/api/v1/exam/sessions/{sessionId}/submit"; request: never; response: ApiSuccessEnvelope & { data: B2Report; }; idempotent: true };
  getB2ExamReport: { method: "GET"; path: "/api/v1/exam/sessions/{sessionId}/report"; request: never; response: ApiSuccessEnvelope & { data: B2Report; }; idempotent: false };
  listB2ExamHistory: { method: "GET"; path: "/api/v1/exam/history"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<Record<string, never>>; }; idempotent: false };
  getB2MasteryOverview: { method: "GET"; path: "/api/v1/mastery/overview"; request: never; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: false };
  listB2Mistakes: { method: "GET"; path: "/api/v1/mastery/mistakes"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<Record<string, never>>; }; idempotent: false };
  getB2MistakeDetail: { method: "GET"; path: "/api/v1/mastery/mistakes/{mistakeId}"; request: never; response: ApiSuccessEnvelope & { data: B2Mistake; }; idempotent: false };
  startB2MistakeRetry: { method: "POST"; path: "/api/v1/mastery/mistakes/{mistakeId}/retry"; request: never; response: ApiSuccessEnvelope & { data: B2Verification; }; idempotent: true };
  listB2MasteryVerifications: { method: "GET"; path: "/api/v1/mastery/verifications"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<Record<string, never>>; }; idempotent: false };
  submitB2MasteryVerification: { method: "POST"; path: "/api/v1/mastery/verifications/{verificationId}/submit"; request: B2VerificationSubmission; response: ApiSuccessEnvelope & { data: B2Verification; }; idempotent: true };
  getB2DailyReport: { method: "GET"; path: "/api/v1/learning/stats/daily-report"; request: never; response: ApiSuccessEnvelope & { data: B2Report; }; idempotent: false };
  getB2WeeklyReport: { method: "GET"; path: "/api/v1/learning/stats/weekly-report"; request: never; response: ApiSuccessEnvelope & { data: B2Report; }; idempotent: false };
  createB2ShareAsset: { method: "POST"; path: "/api/v1/mastery/share-assets"; request: B2ShareAssetRequest; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: true };
  listWordbooks: { method: "GET"; path: "/api/v1/vocab/wordbooks"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<Wordbook>; }; idempotent: false };
  activateWordbook: { method: "PUT"; path: "/api/v1/vocab/wordbooks/{wordbookId}/activation"; request: { active: true; }; response: ApiSuccessEnvelope & ({ data: { activeWordbookId: number; planVersion: number; retainedStateCount?: number; firstSnapshotId?: number | null; }; }); idempotent: true };
  listWordbookItems: { method: "GET"; path: "/api/v1/vocab/wordbooks/{wordbookId}/items"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<VocabItem>; }; idempotent: false };
  getVocabDetail: { method: "GET"; path: "/api/v1/content/learner/vocabulary/{vocabularyId}"; request: never; response: ApiSuccessEnvelope & { data: VocabDetail; }; idempotent: false };
  getChunkDetail: { method: "GET"; path: "/api/v1/vocab/chunks/{chunkId}"; request: never; response: ApiSuccessEnvelope & { data: ChunkDetail; }; idempotent: false };
  getRootTopic: { method: "GET"; path: "/api/v1/vocab/roots/{rootId}"; request: never; response: ApiCursorPageEnvelope & { data: { rootId: number; titleCn: string; nodes: ReadonlyArray<Record<string, never>>; }; }; idempotent: false };
  listUserLibrary: { method: "GET"; path: "/api/v1/vocab/library"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<Record<string, never>>; }; idempotent: false };
  addLibraryEntry: { method: "POST"; path: "/api/v1/vocab/library/entries"; request: LibraryEntryCreateRequest; response: ApiSuccessEnvelope & { data: { entryId: number; item: LearningItemRef; collectionStatus?: string; }; }; idempotent: true };
  removeLibraryEntry: { method: "DELETE"; path: "/api/v1/vocab/library/entries/{entryId}"; request: never; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: true };
  listExpressions: { method: "GET"; path: "/api/v1/vocab/expressions"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<ExpressionResponse>; }; idempotent: false };
  createMinedExpression: { method: "POST"; path: "/api/v1/vocab/expressions"; request: ExpressionCreateRequest; response: ApiSuccessEnvelope & { data: ExpressionResponse; }; idempotent: true };
  updateMinedExpression: { method: "PATCH"; path: "/api/v1/vocab/expressions/{expressionId}"; request: ExpressionUpdateRequest; response: ApiSuccessEnvelope & { data: ExpressionResponse; }; idempotent: true };
  deleteMinedExpression: { method: "DELETE"; path: "/api/v1/vocab/expressions/{expressionId}"; request: never; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: true };
  getOfflineVocabularyCards: { method: "GET"; path: "/api/v1/vocab/offline/cards"; request: never; response: ApiSuccessEnvelope & { data: { manifestHash: string; contentVersion: string; cards: ReadonlyArray<OfflineCard>; answerFieldsIncluded: false; }; }; idempotent: false };
  createSrsBatch: { method: "POST"; path: "/api/v1/learning/srs/batches"; request: SrsBatchCreateRequest; response: ApiSuccessEnvelope & { data: { snapshotId: number; localDate: string; timezone?: string; status: string; algorithmVersion?: string; rulesVersion?: string; items: ReadonlyArray<SrsBatchItem>; }; }; idempotent: true };
  getSrsBatch: { method: "GET"; path: "/api/v1/learning/srs/batches/{snapshotId}"; request: never; response: ApiSuccessEnvelope & { data: { snapshotId: number; localDate: string; timezone?: string; status: string; algorithmVersion?: string; rulesVersion?: string; items: ReadonlyArray<SrsBatchItem>; }; }; idempotent: false };
  submitReviewEvent: { method: "POST"; path: "/api/v1/learning/srs/reviews"; request: ReviewEventRequest; response: ApiSuccessEnvelope & { data: ReviewEventResponse; }; idempotent: true };
  syncReviewEvents: { method: "POST"; path: "/api/v1/learning/srs/reviews:sync"; request: { events: readonly [ReviewEventRequest, ...Array<ReviewEventRequest>]; }; response: ApiSuccessEnvelope & { data: { results: ReadonlyArray<Record<string, never>>; }; }; idempotent: true };
  listSrsStates: { method: "GET"; path: "/api/v1/learning/srs/states"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<SrsState>; }; idempotent: false };
  getSrsOverview: { method: "GET"; path: "/api/v1/learning/srs/overview"; request: never; response: ApiSuccessEnvelope & { data: SrsOverview; }; idempotent: false };
  getCurrentLearningPlan: { method: "GET"; path: "/api/v1/learning/plan/current"; request: never; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: false };
  getTodayLearningStream: { method: "GET"; path: "/api/v1/learning/stream/today"; request: never; response: ApiSuccessEnvelope & { data: B2LearningStream; }; idempotent: false };
  submitLearningStreamAction: { method: "POST"; path: "/api/v1/learning/stream/action"; request: B2LearningStreamActionRequest; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: true };
  startLegacyAssessmentSession: { method: "POST"; path: "/api/v1/assessment/session/start"; request: B2CreateAssessmentSessionRequest; response: ApiSuccessEnvelope & { data: B2Session; }; idempotent: true };
  submitLegacyAssessmentAnswerItem: { method: "POST"; path: "/api/v1/assessment/session/answer-item"; request: B2LegacyAnswerItemRequest; response: ApiSuccessEnvelope & { data: B2AnswerResult; }; idempotent: true };
  submitLegacyAssessmentSession: { method: "POST"; path: "/api/v1/assessment/session/submit"; request: B2LegacySessionSubmitRequest; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: true };
  getLegacyAssessmentReport: { method: "GET"; path: "/api/v1/assessment/report/{sessionUuid}"; request: never; response: ApiSuccessEnvelope & { data: B2Report; }; idempotent: false };
  getLearningMistakeQueue: { method: "GET"; path: "/api/v1/learning/mistakes/queue"; request: never; response: ApiSuccessEnvelope & { data: { page?: Record<string, never>; items?: ReadonlyArray<Record<string, never>>; }; }; idempotent: false };
  verifyLearningMistake: { method: "POST"; path: "/api/v1/learning/mistakes/verify"; request: B2LegacyMistakeVerifyRequest; response: ApiSuccessEnvelope & { data: B2Verification; }; idempotent: true };
  getDailyLearningSummary: { method: "GET"; path: "/api/v1/learning/stats/daily-summary"; request: never; response: ApiSuccessEnvelope & { data: B2DailySummary; }; idempotent: false };
  listB3GrammarPoints: { method: "GET"; path: "/api/v1/grammar/points"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3GrammarPoint: { method: "GET"; path: "/api/v1/grammar/points/{grammarPointId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3SentenceGraph: { method: "GET"; path: "/api/v1/grammar/sentences/{sentenceId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  createB3GrammarPracticeSession: { method: "POST"; path: "/api/v1/grammar/practice/sessions"; request: B3GrammarSessionRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  submitB3GrammarAnswer: { method: "POST"; path: "/api/v1/grammar/practice/sessions/{sessionId}/answers"; request: B3GrammarAnswerRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB3WritingPrompts: { method: "GET"; path: "/api/v1/writing/prompts"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  createB3WritingSubmission: { method: "POST"; path: "/api/v1/writing/submissions"; request: B3WritingSubmissionRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB3WritingEvaluation: { method: "GET"; path: "/api/v1/writing/submissions/{submissionId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  submitB3Correction: { method: "POST"; path: "/api/v1/writing/corrections"; request: B3CorrectionRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB3ListeningMaterials: { method: "GET"; path: "/api/v1/listening/materials"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3ListeningMaterial: { method: "GET"; path: "/api/v1/listening/materials/{materialId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  createB3ListeningSession: { method: "POST"; path: "/api/v1/listening/sessions"; request: B3ListeningSessionRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  submitB3Dictation: { method: "POST"; path: "/api/v1/listening/sessions/{sessionId}/dictation"; request: B3DictationRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  updateB3ListeningProgress: { method: "PUT"; path: "/api/v1/listening/sessions/{sessionId}/progress"; request: B3ProgressRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB3ReadingArticles: { method: "GET"; path: "/api/v1/reading/articles"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3ReadingArticle: { method: "GET"; path: "/api/v1/reading/articles/{articleId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  updateB3ReadingProgress: { method: "PUT"; path: "/api/v1/reading/progress"; request: B3ProgressRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  createB3SentenceMining: { method: "POST"; path: "/api/v1/reading/mining"; request: B3MiningRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB3PhoneticsCatalog: { method: "GET"; path: "/api/v1/phonetics/catalog"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  createB3SpeakingRecording: { method: "POST"; path: "/api/v1/speaking/recordings"; request: B3RecordingRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getSpeakingRecording: { method: "GET"; path: "/api/v1/speaking/recordings/{recordingId}"; request: never; response: ApiSuccessEnvelope & { data: SpeakingRecording; }; idempotent: false };
  deleteSpeakingRecording: { method: "DELETE"; path: "/api/v1/speaking/recordings/{recordingId}"; request: never; response: ApiSuccessEnvelope & { data: SpeakingRecordingDeleteReceipt; }; idempotent: true };
  submitB3SpeakingSelfRating: { method: "POST"; path: "/api/v1/speaking/recordings/{recordingId}/self-rating"; request: B3SelfRatingRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  pushB4OfflineSync: { method: "POST"; path: "/api/v1/offline/sync/push"; request: B4SyncRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  pullB4OfflineSync: { method: "GET"; path: "/api/v1/offline/sync/pull"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3OfflineManifest: { method: "GET"; path: "/api/v1/offline/manifests/{manifestId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3GrammarTree: { method: "GET"; path: "/api/v1/grammar/tree"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB3GrammarTraps: { method: "GET"; path: "/api/v1/grammar/points/{grammarPointId}/traps"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB3GrammarExercises: { method: "GET"; path: "/api/v1/grammar/exercises"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3GrammarExercise: { method: "GET"; path: "/api/v1/grammar/exercises/{exerciseId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  submitB3GrammarAttempt: { method: "POST"; path: "/api/v1/grammar/practice/attempts"; request: B3GrammarAttemptRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB3GrammarMastery: { method: "GET"; path: "/api/v1/grammar/mastery"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3TargetedGrammarPack: { method: "GET"; path: "/api/v1/grammar/targeted-packs"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3SentenceXray: { method: "GET"; path: "/api/v1/grammar/sentences/{sentenceId}/xray"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3SentenceBlocks: { method: "GET"; path: "/api/v1/grammar/sentences/{sentenceId}/blocks"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  submitB3SentenceBlocks: { method: "POST"; path: "/api/v1/grammar/sentences/{sentenceId}/blocks"; request: B3SentenceBlockRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  submitB3SentenceImitation: { method: "POST"; path: "/api/v1/grammar/sentences/{sentenceId}/imitation"; request: B3ImitationRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB3TranslationExercises: { method: "GET"; path: "/api/v1/writing/translation/exercises"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB3WritingTemplates: { method: "GET"; path: "/api/v1/writing/templates"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB3WritingMaterials: { method: "GET"; path: "/api/v1/writing/materials"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB3ProofreadingExercises: { method: "GET"; path: "/api/v1/writing/proofreading/exercises"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB3WritingHistory: { method: "GET"; path: "/api/v1/writing/history"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3ListeningTimeline: { method: "GET"; path: "/api/v1/listening/materials/{materialId}/timeline"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB3LanguageClips: { method: "GET"; path: "/api/v1/listening/clips"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB3OfflinePackages: { method: "GET"; path: "/api/v1/listening/offline-packages"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  createB3OfflinePackage: { method: "POST"; path: "/api/v1/listening/offline-packages"; request: B3OfflinePackageRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB3OfflinePackage: { method: "GET"; path: "/api/v1/listening/offline-packages/{packageId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  downloadB3OfflineAsset: { method: "GET"; path: "/api/v1/listening/offline-packages/{packageId}/assets/{assetId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  syncB3OfflinePackage: { method: "POST"; path: "/api/v1/listening/offline-packages/{packageId}/sync"; request: B3OfflinePackageSyncRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB3ReadingDictionaryEntry: { method: "GET"; path: "/api/v1/reading/articles/{articleId}/dictionary"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB3ReadingStory: { method: "GET"; path: "/api/v1/reading/articles/{articleId}/story"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB3ReadingQuestions: { method: "GET"; path: "/api/v1/reading/questions"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  submitB3ReadingAttempt: { method: "POST"; path: "/api/v1/reading/attempts"; request: B3ReadingAttemptRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB3MinimalPairs: { method: "GET"; path: "/api/v1/phonetics/minimal-pairs"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  createSpeakingShadowingSession: { method: "POST"; path: "/api/v1/speaking/shadowing/sessions"; request: SpeakingShadowingSessionCreateRequest; response: ApiSuccessEnvelope & { data: SpeakingShadowingSession; }; idempotent: true };
  recordSpeakingShadowingProgress: { method: "POST"; path: "/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress"; request: SpeakingShadowingProgressRequest; response: ApiSuccessEnvelope & { data: SpeakingShadowingSession; }; idempotent: true };
  createB3RoleplaySession: { method: "POST"; path: "/api/v1/speaking/roleplay/sessions"; request: B3RoleplaySessionRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  submitB3RoleplayTurn: { method: "POST"; path: "/api/v1/speaking/roleplay/sessions/{roleplaySessionId}/turns"; request: B3RoleplayTurnRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB4Streak: { method: "GET"; path: "/api/v1/gamification/streak"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  updateB4StreakSettings: { method: "PUT"; path: "/api/v1/gamification/streak/settings"; request: B4StreakSettingsRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  rescueB4Streak: { method: "POST"; path: "/api/v1/gamification/streak/rescue"; request: B4RescueRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB4Quests: { method: "GET"; path: "/api/v1/gamification/quests"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  claimB4QuestReward: { method: "POST"; path: "/api/v1/gamification/quests/{questId}/claim"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB4Achievements: { method: "GET"; path: "/api/v1/gamification/achievements"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  updateB4AchievementShowcase: { method: "PUT"; path: "/api/v1/gamification/achievements/{achievementCode}/showcase"; request: B4ShowcaseRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB4Chests: { method: "GET"; path: "/api/v1/gamification/chests"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB4ChestProbability: { method: "GET"; path: "/api/v1/gamification/chests/{chestGrantId}/probability"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  openB4Chest: { method: "POST"; path: "/api/v1/gamification/chests/{chestGrantId}/open"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB4Collection: { method: "GET"; path: "/api/v1/gamification/collection"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB4Catalog: { method: "GET"; path: "/api/v1/gamification/catalog"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  redeemB4CatalogItem: { method: "POST"; path: "/api/v1/gamification/catalog/{catalogItemId}/redeem"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB4SeasonRewards: { method: "GET"; path: "/api/v1/gamification/seasons/{seasonId}/rewards"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB4AvatarProfile: { method: "GET"; path: "/api/v1/avatar/profile"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  saveB4AvatarProfile: { method: "PUT"; path: "/api/v1/avatar/profile"; request: B4AvatarRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB4AvatarItems: { method: "GET"; path: "/api/v1/avatar/items"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB4AvatarLoadouts: { method: "GET"; path: "/api/v1/avatar/loadouts"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  saveB4AvatarLoadout: { method: "PUT"; path: "/api/v1/avatar/loadouts/{loadoutId}"; request: B4LoadoutRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  equipB4AvatarLoadout: { method: "POST"; path: "/api/v1/avatar/loadouts/{loadoutId}/equip"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB4AvatarResources: { method: "GET"; path: "/api/v1/avatar/resources"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB4StudySpace: { method: "GET"; path: "/api/v1/avatar/study-space"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  saveB4StudySpace: { method: "PUT"; path: "/api/v1/avatar/study-space"; request: B4StudySpaceRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listM1014GameCatalog: { method: "GET"; path: "/api/v1/games/catalog"; request: never; response: ApiCursorPageEnvelope & { data: M1014GameCatalog; }; idempotent: false };
  createM1014GameSession: { method: "POST"; path: "/api/v1/games/sessions"; request: M1014GameSessionCreateRequest; response: ApiSuccessEnvelope & { data: M1014GameSession; }; idempotent: true };
  getM1014GameSession: { method: "GET"; path: "/api/v1/games/sessions/{sessionId}"; request: never; response: ApiSuccessEnvelope & { data: M1014GameSession; }; idempotent: false };
  submitM1014GameEvent: { method: "POST"; path: "/api/v1/games/sessions/{sessionId}/events"; request: M1014GameEventRequest; response: ApiSuccessEnvelope & { data: M1014GameEventReceipt; }; idempotent: true };
  pauseM1014GameSession: { method: "POST"; path: "/api/v1/games/sessions/{sessionId}/pause"; request: M1014GameSessionControlRequest; response: ApiSuccessEnvelope & { data: M1014GameSession; }; idempotent: true };
  resumeM1014GameSession: { method: "POST"; path: "/api/v1/games/sessions/{sessionId}/resume"; request: M1014GameSessionControlRequest; response: ApiSuccessEnvelope & { data: M1014GameSession; }; idempotent: true };
  finishM1014GameSession: { method: "POST"; path: "/api/v1/games/sessions/{sessionId}/finish"; request: M1014GameSessionControlRequest; response: ApiSuccessEnvelope & { data: M1014GameSessionResult; }; idempotent: true };
  listM1014StudyRooms: { method: "GET"; path: "/api/v1/social/rooms"; request: never; response: ApiCursorPageEnvelope & { data: M1014RoomPage; }; idempotent: false };
  getM1014StudyRoom: { method: "GET"; path: "/api/v1/social/rooms/{roomId}"; request: never; response: ApiSuccessEnvelope & { data: M1014RoomDetails; }; idempotent: false };
  joinM1014StudyRoom: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/join"; request: M1014RoomJoinRequest; response: ApiSuccessEnvelope & { data: M1014RoomState; }; idempotent: true };
  leaveM1014StudyRoom: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/leave"; request: M1014RoomCommand; response: ApiSuccessEnvelope & { data: M1014RoomState; }; idempotent: true };
  recordM1014RoomInteraction: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/interactions"; request: M1014PresetInteraction; response: ApiSuccessEnvelope & { data: M1014InteractionResult; }; idempotent: true };
  getM1014Leaderboard: { method: "GET"; path: "/api/v1/social/leaderboards"; request: never; response: ApiSuccessEnvelope & { data: M1014Leaderboard; }; idempotent: false };
  createB4SocialWsTicket: { method: "POST"; path: "/api/v1/social/ws-ticket"; request: B4WsTicketRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB4OfflinePackages: { method: "GET"; path: "/api/v1/sync/offline-packages"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  authorizeB4OfflinePackage: { method: "POST"; path: "/api/v1/sync/offline-packages/{packageId}/authorize"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  enqueueB11SyncChanges: { method: "POST"; path: "/api/v1/sync/changes"; request: B11SyncEnqueueRequest; response: ApiSuccessEnvelope & { data: B11SyncReceipt; }; idempotent: true };
  listB11SyncChanges: { method: "GET"; path: "/api/v1/sync/changes"; request: never; response: ApiCursorPageEnvelope & { data: { acceptedEventIds: ReadonlyArray<string>; conflicts: ReadonlyArray<B11SyncConflict>; }; }; idempotent: false };
  pushB4SyncEvents: { method: "POST"; path: "/api/v1/sync/events"; request: B4SyncRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  saveB4SyncCheckpoint: { method: "PUT"; path: "/api/v1/sync/checkpoints/{entityId}"; request: B4CheckpointRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  createB4ModerationReport: { method: "POST"; path: "/api/v1/social/moderation/reports"; request: B4ReportRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  createB4Block: { method: "POST"; path: "/api/v1/social/moderation/blocks"; request: B4BlockRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  createB4RoomMute: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/mutes"; request: B4MuteRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  updateB4OfflineDownload: { method: "PATCH"; path: "/api/v1/sync/offline-downloads/{downloadId}"; request: B4OfflineDownloadRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  cleanupB4OfflineDownload: { method: "POST"; path: "/api/v1/sync/offline-downloads/{downloadId}/cleanup"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  appealB4ModerationReport: { method: "POST"; path: "/api/v1/social/moderation/reports/{reportId}/appeal"; request: B4AppealRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB13CommerceSkus: { method: "GET"; path: "/api/v1/commerce/skus"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<M1015Sku>; }; idempotent: false };
  getCommerceSku: { method: "GET"; path: "/api/v1/commerce/skus/{skuId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  listB13CommerceOrders: { method: "GET"; path: "/api/v1/commerce/orders"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<M1015Order>; }; idempotent: false };
  createB13CommerceOrder: { method: "POST"; path: "/api/v1/commerce/orders"; request: M1015OrderCreateRequest; response: ApiSuccessEnvelope & { data: M1015Order; }; idempotent: true };
  getCommerceOrder: { method: "GET"; path: "/api/v1/commerce/orders/{orderId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  receiveWechatCallback: { method: "POST"; path: "/api/v1/commerce/wechat/callback"; request: B5ProviderCallbackRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  receiveAlipayNotify: { method: "POST"; path: "/api/v1/commerce/alipay/notify"; request: B5ProviderCallbackRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  verifyAppleTransaction: { method: "POST"; path: "/api/v1/commerce/apple/transactions/verify"; request: B5AppleVerificationRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  scanAppleRecovery: { method: "POST"; path: "/api/v1/commerce/apple/recovery/scan"; request: B5AppleVerificationRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  receiveAppleNotification: { method: "POST"; path: "/api/v1/commerce/apple/notifications"; request: B5ProviderCallbackRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listB13MyEntitlements: { method: "GET"; path: "/api/v1/commerce/entitlements/me"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<M1015Entitlement>; }; idempotent: false };
  createHousehold: { method: "POST"; path: "/api/v1/commerce/households"; request: B5HouseholdRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  createHouseholdInvitation: { method: "POST"; path: "/api/v1/commerce/households/{householdId}/invitations"; request: B5InvitationRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  acceptHouseholdInvitation: { method: "POST"; path: "/api/v1/commerce/households/invitations/accept"; request: B5InvitationAcceptRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  removeHouseholdMember: { method: "DELETE"; path: "/api/v1/commerce/households/{householdId}/members/{memberUserId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  redeemB13ActivationCode: { method: "POST"; path: "/api/v1/commerce/activation-codes/redeem"; request: M1015ActivationRedeemRequest; response: ApiSuccessEnvelope & { data: M1015Entitlement; }; idempotent: true };
  requestB13OrderRefund: { method: "POST"; path: "/api/v1/commerce/orders/{orderId}/refunds"; request: M1015RefundRequest; response: ApiSuccessEnvelope & { data: M1015Refund; }; idempotent: true };
  listInvoices: { method: "GET"; path: "/api/v1/commerce/invoices"; request: never; response: ApiCursorPageEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  createInvoice: { method: "POST"; path: "/api/v1/commerce/invoices"; request: B5InvoiceRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  listM1016LearnerSupportTickets: { method: "GET"; path: "/api/v1/support/tickets"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<M1016SupportTicket>; }; idempotent: false };
  createM1016SupportTicket: { method: "POST"; path: "/api/v1/support/tickets"; request: M1016SupportTicketCreateRequest; response: ApiSuccessEnvelope & { data: M1016SupportTicket; }; idempotent: true };
  getM1016LearnerSupportTicket: { method: "GET"; path: "/api/v1/support/tickets/{ticketId}"; request: never; response: ApiSuccessEnvelope & { data: M1016SupportTicket; }; idempotent: false };
  addM1016LearnerSupportTicketMessage: { method: "POST"; path: "/api/v1/support/tickets/{ticketId}/messages"; request: M1016SupportMessageCreateRequest; response: ApiSuccessEnvelope & { data: M1016SupportMessage; }; idempotent: true };
  recordB6E2ERun: { method: "POST"; path: "/api/v1/quality/e2e-runs"; request: B6E2ERunRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB6E2ERun: { method: "GET"; path: "/api/v1/quality/e2e-runs/{runId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  recordB6SecurityScan: { method: "POST"; path: "/api/v1/quality/security-scans"; request: B6SecurityScanRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB6SecurityScan: { method: "GET"; path: "/api/v1/quality/security-scans/{scanId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  recordB6ReliabilityRun: { method: "POST"; path: "/api/v1/quality/reliability-runs"; request: B6ReliabilityRunRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB6ReliabilityRun: { method: "GET"; path: "/api/v1/quality/reliability-runs/{runId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  recordB6DataReliabilityDrill: { method: "POST"; path: "/api/v1/data-reliability/drills"; request: B6DrillRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB6DataReliabilityDrill: { method: "GET"; path: "/api/v1/data-reliability/drills/{drillId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  evaluateB6ReleaseGate: { method: "POST"; path: "/api/v1/release/gates/evaluate"; request: B6ReleaseGateRequest; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: true };
  getB6ReleaseGate: { method: "GET"; path: "/api/v1/release/gates/{gateId}"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  getB8Principal: { method: "GET"; path: "/api/v1/iam/principal/me"; request: never; response: ApiSuccessEnvelope & { data: B8PrincipalResponse; }; idempotent: false };
  listB8Devices: { method: "GET"; path: "/api/v1/iam/devices"; request: never; response: ApiCursorPageEnvelope & { data: { devices: ReadonlyArray<B8Device>; }; }; idempotent: false };
  kickoutB8Device: { method: "POST"; path: "/api/v1/iam/devices/{deviceId}/kickout"; request: never; response: ApiSuccessEnvelope & { data: B8SessionRevocationResponse; }; idempotent: true };
  evaluateB8AdultGate: { method: "POST"; path: "/api/v1/iam/adult-gate"; request: B8AdultGateRequest; response: ApiSuccessEnvelope & { data: B8AdultGateResponse; }; idempotent: true };
  listB8Consents: { method: "GET"; path: "/api/v1/iam/consents"; request: never; response: ApiCursorPageEnvelope & { data: { items: ReadonlyArray<B8Consent>; }; }; idempotent: false };
  updateB8Consent: { method: "PUT"; path: "/api/v1/iam/consents"; request: B8ConsentUpdateRequest; response: ApiSuccessEnvelope & { data: B8Consent; }; idempotent: true };
  decideB8Authorization: { method: "POST"; path: "/internal/v1/iam/authorization/decisions"; request: B8AuthorizationDecisionRequest; response: B8AuthorizationDecisionResponse; idempotent: true };
  getB8Permissions: { method: "GET"; path: "/api/v1/iam/permissions"; request: never; response: ApiSuccessEnvelope & { data: B8PermissionsResponse; }; idempotent: false };
  listB9PublicContentCatalog: { method: "GET"; path: "/api/v1/public/content/catalog"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<B9PublicContentCard>; }; idempotent: false };
  getB9PublicContentProjection: { method: "GET"; path: "/api/v1/public/content/{contentCode}"; request: never; response: ApiSuccessEnvelope & { data: B9PublicContentProjection; }; idempotent: false };
  getB9OfficialSiteProjection: { method: "GET"; path: "/api/v1/public/site/projection"; request: never; response: ApiSuccessEnvelope & { data: B9PublicSiteProjection; }; idempotent: false };
  listB9LearnerContentCatalog: { method: "GET"; path: "/api/v1/content/learner/catalog"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<B9PublicContentCard>; }; idempotent: false };
  getB9LearnerContentProjection: { method: "GET"; path: "/api/v1/content/learner/{contentCode}"; request: never; response: ApiSuccessEnvelope & { data: B9LearnerContentProjection; }; idempotent: false };
  listB9AdminContentStates: { method: "GET"; path: "/api/v1/admin/content-commands"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<B9AdminContentState>; }; idempotent: false };
  submitB9ContentCommand: { method: "POST"; path: "/api/v1/admin/content-commands"; request: B9ContentCommandRequest; response: ApiSuccessEnvelope & { data: B9ContentCommandAccepted; }; idempotent: true };
  getB9AdminContentState: { method: "GET"; path: "/api/v1/admin/content-commands/{contentCode}"; request: never; response: ApiSuccessEnvelope & { data: B9AdminContentState; }; idempotent: false };
  getB9InternalPublicProjection: { method: "GET"; path: "/internal/v1/content/public-projections/{projectionKey}"; request: never; response: B9InternalPublicProjectionResponse; idempotent: false };
  getB9AssessmentContentSnapshot: { method: "GET"; path: "/internal/v1/content/versions/{contentVersionId}/assessment-snapshot"; request: never; response: B9AssessmentContentSnapshotResponse; idempotent: false };
  getB9LearnerProfile: { method: "GET"; path: "/api/v1/learner/profile"; request: never; response: ApiSuccessEnvelope & { data: B9LearnerProfile; }; idempotent: false };
  patchB9LearnerProfile: { method: "PATCH"; path: "/api/v1/learner/profile"; request: B9LearnerProfilePatch; response: ApiSuccessEnvelope & { data: B9LearnerProfile; }; idempotent: true };
  getB9LearnerTarget: { method: "GET"; path: "/api/v1/learner/targets"; request: never; response: ApiSuccessEnvelope & { data: B9LearnerTarget; }; idempotent: false };
  putB9LearnerTarget: { method: "PUT"; path: "/api/v1/learner/targets"; request: B9LearnerTargetUpsert; response: ApiSuccessEnvelope & { data: B9LearnerTarget; }; idempotent: true };
  getB9LearnerPreferences: { method: "GET"; path: "/api/v1/learner/preferences"; request: never; response: ApiSuccessEnvelope & { data: B9LearnerPreferences; }; idempotent: false };
  patchB9LearnerPreferences: { method: "PATCH"; path: "/api/v1/learner/preferences"; request: B9LearnerPreferencesPatch; response: ApiSuccessEnvelope & { data: B9LearnerPreferences; }; idempotent: true };
  getB9FirstDayProjection: { method: "GET"; path: "/api/v1/learner/first-day"; request: never; response: ApiSuccessEnvelope & { data: B9FirstDayProjection; }; idempotent: false };
  getB9LearnerHomeProjection: { method: "GET"; path: "/api/v1/learner/home"; request: never; response: ApiSuccessEnvelope & { data: B9HomeProjection; }; idempotent: false };
  getB9LegacyLearnerProfileShadow: { method: "GET"; path: "/internal/v1/learner/shadow-profile/{principalId}"; request: never; response: B9LegacyShadowProfileResponse; idempotent: false };
  getB10CompatibilityReadShadow: { method: "GET"; path: "/internal/v1/compatibility/b10/read-shadow"; request: never; response: B10ReadShadowResponse; idempotent: false };
  createB10CompatibilityReconciliation: { method: "POST"; path: "/internal/v1/compatibility/b10/reconciliations"; request: B10ReconciliationRequest; response: B10ReadShadowResponse; idempotent: true };
  createB10CompatibilityRouteDecision: { method: "POST"; path: "/internal/v1/compatibility/b10/route-decisions"; request: B10RouteDecisionRequest; response: B10RouteDecisionResponse; idempotent: true };
  createB10CompatibilityRollback: { method: "POST"; path: "/internal/v1/compatibility/b10/rollbacks"; request: B10RollbackRequest; response: B10RouteDecisionResponse; idempotent: true };
  getB10LearnerContentSnapshot: { method: "GET"; path: "/api/v1/learning/content-snapshots/{contentVersionId}"; request: never; response: ApiSuccessEnvelope & { data: B10LearnerContentSnapshot; }; idempotent: false };
  getB10AssessmentContentSnapshot: { method: "GET"; path: "/internal/v1/content/assessment-snapshots/{contentVersionId}"; request: never; response: B10AssessmentContentSnapshotResponse; idempotent: false };
  resolveB10ContentSnapshotRecovery: { method: "GET"; path: "/internal/v1/content/assessment-snapshots/{contentVersionId}/recovery"; request: never; response: B10ContentRecoveryResponse; idempotent: false };
  submitB10AssessmentAttempt: { method: "POST"; path: "/api/v1/assessment/sessions/{sessionId}/attempts"; request: B10SubmitAttemptRequest; response: ApiSuccessEnvelope & { data: B10Attempt; }; idempotent: true };
  putB10AssessmentCheckpoint: { method: "PUT"; path: "/api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint"; request: B10CheckpointRequest; response: ApiSuccessEnvelope & { data: B10Checkpoint; }; idempotent: true };
  getB10AssessmentReport: { method: "GET"; path: "/api/v1/assessment/reports/{reportId}"; request: never; response: ApiSuccessEnvelope & { data: B10AssessmentReport; }; idempotent: false };
  listB10LearningReviewQueue: { method: "GET"; path: "/api/v1/learning/review-queue"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<B10LearningQueueItem>; }; idempotent: false };
  completeB10LearningReview: { method: "POST"; path: "/api/v1/learning/review-queue/{queueItemId}/complete"; request: B10CompleteReviewRequest; response: ApiSuccessEnvelope & { data: B10LearningReviewResult; }; idempotent: true };
  getB10LearningMasteryProjection: { method: "GET"; path: "/api/v1/learning/mastery/{itemId}"; request: never; response: ApiSuccessEnvelope & { data: B10MasteryProjection; }; idempotent: false };
  getMediaAsset: { method: "GET"; path: "/api/v1/media/assets/{assetId}"; request: never; response: ApiSuccessEnvelope & { data: MediaAsset; }; idempotent: false };
  getMediaAssetManifest: { method: "GET"; path: "/api/v1/media/assets/{assetId}/manifest"; request: never; response: ApiSuccessEnvelope & { data: MediaManifest; }; idempotent: false };
  streamB11MediaContent: { method: "GET"; path: "/api/v1/media/assets/{assetId}/content"; request: never; response: ApiSuccessEnvelope & { data: B11MediaContentRange; }; idempotent: false };
  revokeB11MediaAsset: { method: "POST"; path: "/internal/v1/media/assets/{assetId}/revoke"; request: B11MediaRevocation; response: unknown; idempotent: true };
  getB11MediaCompatibility: { method: "GET"; path: "/internal/v1/compatibility/b11/media-assets/{assetId}"; request: never; response: B11MediaCompatibility; idempotent: false };
  createB11MediaReconciliation: { method: "POST"; path: "/internal/v1/compatibility/b11/media-assets/reconciliations"; request: B11MediaCompatibility; response: unknown; idempotent: true };
  createB11MediaMigration: { method: "POST"; path: "/internal/v1/compatibility/b11/media-assets/{assetId}/migrations"; request: B11MediaMigration; response: unknown; idempotent: true };
  getB11NotificationPreference: { method: "GET"; path: "/api/v1/settings/notifications"; request: never; response: ApiSuccessEnvelope & { data: B11NotificationPreference; }; idempotent: false };
  updateB11NotificationPreference: { method: "PUT"; path: "/api/v1/settings/notifications"; request: B11NotificationPreference; response: ApiSuccessEnvelope & { data: B11NotificationPreference; }; idempotent: true };
  listB11Messages: { method: "GET"; path: "/api/v1/messages"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<B11Message>; }; idempotent: false };
  markB11MessageRead: { method: "POST"; path: "/api/v1/messages/{messageId}/read"; request: never; response: unknown; idempotent: true };
  getB11SyncCursor: { method: "GET"; path: "/api/v1/sync/cursor"; request: never; response: ApiSuccessEnvelope & { data: B11VectorClock; }; idempotent: false };
  updateB11SyncCursor: { method: "PUT"; path: "/api/v1/sync/cursor"; request: B11VectorClock; response: ApiSuccessEnvelope & { data: B11VectorClock; }; idempotent: true };
  listB11SyncConflicts: { method: "GET"; path: "/api/v1/sync/conflicts"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<B11SyncConflict>; }; idempotent: false };
  recoverB11SyncConflict: { method: "POST"; path: "/api/v1/sync/conflicts/{conflictId}/recovery"; request: B11SyncRecovery; response: unknown; idempotent: true };
  createB11OfflineCompatibility: { method: "POST"; path: "/internal/v1/compatibility/b11/offline"; request: B11OfflineCompatibility; response: unknown; idempotent: true };
  createB11Recording: { method: "POST"; path: "/api/v1/multimodal/recordings"; request: B11RecordingMetadata; response: ApiSuccessEnvelope & { data: B11RecordingMetadata; }; idempotent: true };
  getM1014GamificationSummary: { method: "GET"; path: "/api/v1/gamification/me/summary"; request: never; response: ApiSuccessEnvelope & { data: M1014GrowthSummary; }; idempotent: false };
  listM1014GamificationLedger: { method: "GET"; path: "/api/v1/gamification/me/ledger"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<M1014LedgerEntry>; }; idempotent: false };
  listM1014RewardGrants: { method: "GET"; path: "/api/v1/gamification/me/rewards"; request: never; response: ApiCursorPageEnvelope & { data: { items: ReadonlyArray<M1014RewardGrant>; }; }; idempotent: false };
  getM1014RewardProbability: { method: "GET"; path: "/api/v1/gamification/me/rewards/{grantId}/probability"; request: never; response: ApiSuccessEnvelope & { data: M1014RewardProbability; }; idempotent: false };
  claimM1014Reward: { method: "POST"; path: "/api/v1/gamification/me/rewards/{grantId}/claim"; request: M1014RewardClaimRequest; response: ApiSuccessEnvelope & { data: M1014RewardClaimResult; }; idempotent: true };
  settleM1014TrustedCompletion: { method: "POST"; path: "/internal/v1/gamification/trusted-events/completions"; request: M1014TrustedCompletion; response: M1014SettlementResult; idempotent: true };
  disconnectM1014StudyRoom: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/disconnect"; request: M1014RoomCommand; response: ApiSuccessEnvelope & { data: M1014RoomState; }; idempotent: true };
  recoverM1014StudyRoomSeat: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/recover"; request: M1014RoomCommand; response: ApiSuccessEnvelope & { data: M1014RoomState; }; idempotent: true };
  renewM1014StudyRoomLease: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/lease/renew"; request: M1014RoomCommand; response: ApiSuccessEnvelope & { data: M1014RoomState; }; idempotent: true };
  startM1014RoomFocus: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/focus"; request: M1014FocusCommand; response: ApiSuccessEnvelope & { data: M1014FocusSession; }; idempotent: true };
  updateM1014RoomFocus: { method: "PATCH"; path: "/api/v1/social/rooms/{roomId}/focus"; request: M1014FocusUpdateCommand; response: ApiSuccessEnvelope & { data: M1014FocusSession; }; idempotent: true };
  updateM1014SocialVisibility: { method: "PATCH"; path: "/api/v1/social/me/visibility"; request: M1014VisibilityCommand; response: ApiSuccessEnvelope & { data: M1014Visibility; }; idempotent: true };
  createM1014SocialReport: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/reports"; request: M1014ReportCommand; response: ApiSuccessEnvelope & { data: M1014Report; }; idempotent: true };
  getM1014SocialReport: { method: "GET"; path: "/api/v1/social/reports/{reportId}"; request: never; response: ApiSuccessEnvelope & { data: M1014Report; }; idempotent: false };
  consumeM1014SocialTrustedEvent: { method: "POST"; path: "/internal/v1/social/trusted-events"; request: M1014TrustedSocialEvent; response: B12EventReceipt; idempotent: true };
  consumeB12NotificationTrustedEvent: { method: "POST"; path: "/internal/v1/notifications/trusted-events"; request: B12NotificationTrustedEvent; response: B12EventReceipt; idempotent: true };
  retryM1016NotificationDelivery: { method: "POST"; path: "/internal/v1/notifications/retry"; request: M1016NotificationRetryCommand; response: M1016NotificationRetryResult; idempotent: true };
  recoverM1016NotificationDelivery: { method: "POST"; path: "/internal/v1/notifications/recovery"; request: M1016NotificationRecoveryCommand; response: M1016NotificationRecoveryResult; idempotent: true };
  listB12ModerationReports: { method: "GET"; path: "/api/v1/admin/moderation/reports"; request: never; response: ApiCursorPageEnvelope & { data: { items: ReadonlyArray<B12AdminReport>; }; }; idempotent: false };
  executeB12ModerationCommand: { method: "POST"; path: "/api/v1/admin/moderation/reports/{reportId}/commands"; request: B12ModerationCommand; response: ApiSuccessEnvelope & { data: B12Report; }; idempotent: true };
  listB12RecoveryTasks: { method: "GET"; path: "/api/v1/admin/recovery/tasks"; request: never; response: ApiCursorPageEnvelope & { data: { items: ReadonlyArray<B12RecoveryResult>; }; }; idempotent: false };
  executeB12RecoveryCommand: { method: "POST"; path: "/api/v1/admin/recovery/tasks/{taskId}/commands"; request: B12RecoveryCommand; response: ApiSuccessEnvelope & { data: B12RecoveryResult; }; idempotent: true };
  listM1016NotificationPreferences: { method: "GET"; path: "/api/v1/notifications/preferences"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<M1016NotificationPreference>; }; idempotent: false };
  updateM1016NotificationPreference: { method: "PUT"; path: "/api/v1/notifications/preferences/{notificationType}/{channel}"; request: M1016NotificationPreferenceCommand; response: ApiSuccessEnvelope & { data: M1016NotificationPreference; }; idempotent: true };
  listM1016NotificationMessages: { method: "GET"; path: "/api/v1/notifications/messages"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<M1016NotificationMessage>; }; idempotent: false };
  getB13PublicCommerceCatalog: { method: "GET"; path: "/api/v1/public/commerce/catalog"; request: never; response: ApiSuccessEnvelope & { data: M1015PublicCatalog; }; idempotent: false };
  getB13CommerceReadiness: { method: "GET"; path: "/api/v1/commerce/readiness"; request: never; response: ApiSuccessEnvelope & { data: M1015PaymentReadiness; }; idempotent: false };
  prepareB13PaymentIntent: { method: "POST"; path: "/api/v1/commerce/orders/{orderId}/payment-intents"; request: M1015PaymentIntentRequest; response: ApiSuccessEnvelope & { data: M1015PaymentIntentResult; }; idempotent: true };
  consumeB13PaymentProviderCallback: { method: "POST"; path: "/internal/v1/commerce/providers/{provider}/callbacks"; request: M1015ProviderCallbackRequest; response: M1015ProviderCallbackReceipt; idempotent: true };
  replayB13CommerceReconciliation: { method: "POST"; path: "/internal/v1/commerce/reconciliation/replay"; request: M1015ReconciliationReplayRequest; response: M1015ReconciliationRecoveryReceipt; idempotent: true };
  listB13AdminCommerceOrders: { method: "GET"; path: "/api/v1/admin/ops/commerce/orders"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<B13AdminOrderView>; }; idempotent: false };
  listM1016AdminSupportTickets: { method: "GET"; path: "/api/v1/admin/ops/tickets"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<M1016SupportTicket>; }; idempotent: false };
  createB13SupportTicket: { method: "POST"; path: "/api/v1/admin/ops/tickets"; request: M1016SupportTicketCreateRequest; response: ApiSuccessEnvelope & { data: B13SupportTicket; }; idempotent: true };
  submitB13AdminCommand: { method: "POST"; path: "/api/v1/admin/ops/commands"; request: B13AdminCommandRequest; response: ApiSuccessEnvelope & { data: B13AdminCommandResult; }; idempotent: true };
  listB13AdminMetrics: { method: "GET"; path: "/api/v1/admin/ops/metrics"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<B13MetricProjection>; }; idempotent: false };
  ingestB13AnalyticsEvent: { method: "POST"; path: "/internal/v1/analytics/events"; request: B13AnalyticsEvent; response: B13AnalyticsReceipt; idempotent: true };
  requestB13AnalyticsRecompute: { method: "POST"; path: "/internal/v1/analytics/recompute"; request: B13RecomputeRequest; response: B13RecomputeJob; idempotent: true };
  b25ReadLearnerProfile: { method: "GET"; path: "/internal/v1/learner/profile"; request: never; response: unknown; idempotent: false };
  b25UpdateLearnerProfile: { method: "PATCH"; path: "/internal/v1/learner/profile"; request: never; response: unknown; idempotent: true };
  b25ReadLearnerGoal: { method: "GET"; path: "/internal/v1/learner/targets"; request: never; response: unknown; idempotent: false };
  b25UpdateLearnerGoal: { method: "PUT"; path: "/internal/v1/learner/targets"; request: never; response: unknown; idempotent: true };
  b25ReadLearnerPreferences: { method: "GET"; path: "/internal/v1/learner/preferences"; request: never; response: unknown; idempotent: false };
  b25UpdateLearnerPreferences: { method: "PATCH"; path: "/internal/v1/learner/preferences"; request: never; response: unknown; idempotent: true };
  b25ReadFirstDayProjection: { method: "GET"; path: "/internal/v1/learner/first-day"; request: never; response: unknown; idempotent: false };
  b25ReadLearnerHome: { method: "GET"; path: "/internal/v1/learner/home"; request: never; response: unknown; idempotent: false };
  b25CompleteDailyTask: { method: "POST"; path: "/internal/v1/learner/onboarding/daily-tasks/{taskId}/complete"; request: never; response: unknown; idempotent: true };
  b25ReadPublishedCatalog: { method: "GET"; path: "/internal/v1/content/learner/catalog"; request: never; response: unknown; idempotent: false };
  b25ReadPublishedContent: { method: "GET"; path: "/internal/v1/content/learner/{contentCode}"; request: never; response: unknown; idempotent: false };
  b25ReadLearningPlan: { method: "GET"; path: "/internal/v1/learning/plan/current"; request: never; response: unknown; idempotent: false };
  b25ReadSrsBatch: { method: "GET"; path: "/internal/v1/learning/srs/batches"; request: never; response: unknown; idempotent: false };
  b25CreateSrsBatch: { method: "POST"; path: "/internal/v1/learning/srs/batches"; request: never; response: unknown; idempotent: true };
  b25SubmitSrsReview: { method: "POST"; path: "/internal/v1/learning/srs/reviews"; request: never; response: unknown; idempotent: true };
  b25SyncSrsReviews: { method: "POST"; path: "/internal/v1/learning/srs/reviews:sync"; request: never; response: unknown; idempotent: true };
  b25ReadSrsOverview: { method: "GET"; path: "/internal/v1/learning/srs/overview"; request: never; response: unknown; idempotent: false };
  b25ReadPlacement: { method: "GET"; path: "/internal/v1/assessment/placement/start"; request: never; response: unknown; idempotent: false };
  b25StartPlacement: { method: "POST"; path: "/internal/v1/assessment/placement/start"; request: never; response: unknown; idempotent: true };
  b25SubmitPlacementStep: { method: "POST"; path: "/internal/v1/assessment/placement/submit-step"; request: never; response: unknown; idempotent: true };
  b25SkipPlacement: { method: "POST"; path: "/internal/v1/assessment/placement/skip"; request: never; response: unknown; idempotent: true };
  b25ReadPlacementReport: { method: "GET"; path: "/internal/v1/assessment/placement/report/{sessionId}"; request: never; response: unknown; idempotent: false };
  b25ReadNotificationPreferences: { method: "GET"; path: "/internal/v1/notifications/preferences"; request: never; response: unknown; idempotent: false };
  b25UpdateNotificationPreference: { method: "PUT"; path: "/internal/v1/notifications/preferences/{notificationType}/{channel}"; request: never; response: unknown; idempotent: true };
  b25EnsureDailyTask: { method: "POST"; path: "/internal/v1/learner/onboarding/daily-tasks/ensure"; request: B25EnsureDailyTaskRequest; response: unknown; idempotent: true };
  markM1016NotificationMessageRead: { method: "PUT"; path: "/api/v1/notifications/messages/{messageId}/read"; request: never; response: ApiSuccessEnvelope & { data: M1016NotificationReadReceipt; }; idempotent: true };
  markAllM1016NotificationMessagesRead: { method: "PUT"; path: "/api/v1/notifications/messages/read-all"; request: never; response: ApiSuccessEnvelope & { data: M1016NotificationReadAllReceipt; }; idempotent: true };
  createB11MediaAccess: { method: "POST"; path: "/api/v1/media/assets/{assetId}/signed-url"; request: B11MediaAccessRequest; response: ApiSuccessEnvelope & { data: B11SignedMediaUrl; }; idempotent: true };
  getB4Season: { method: "GET"; path: "/api/v1/gamification/season"; request: never; response: ApiSuccessEnvelope & { data: { [key: string]: unknown; }; }; idempotent: false };
  prepareB13AdminCommand: { method: "POST"; path: "/api/v1/admin/ops/commands/prepare"; request: B13AdminCommandRequest; response: ApiSuccessEnvelope & { data: B13CommandPreparation; }; idempotent: true };
  listB13AdminAudit: { method: "GET"; path: "/api/v1/admin/ops/audit"; request: never; response: ApiCursorPageEnvelope & { data: { items: ReadonlyArray<B13AuditRecord>; redacted: true; }; }; idempotent: false };
  updateB11MediaProgress: { method: "PUT"; path: "/api/v1/learning/media-progress"; request: B11MediaProgressRequest; response: ApiSuccessEnvelope & { data: B11MediaProgressReceipt; }; idempotent: true };
  updateB11ShadowingCompletion: { method: "POST"; path: "/api/v1/speaking/shadowing/completions"; request: B11ShadowingCompletionRequest; response: ApiSuccessEnvelope & { data: B11ShadowingCompletionReceipt; }; idempotent: true };
  b25EnsureDailyTaskPublic: { method: "POST"; path: "/api/v1/onboarding/daily-tasks/ensure"; request: B25EnsureDailyTaskRequest; response: ApiSuccessEnvelope & { data: unknown; }; idempotent: true };
  loginB8Account: { method: "POST"; path: "/api/v1/auth/login"; request: B8LoginRequest; response: B8AuthTokenEnvelope; idempotent: true };
  refreshB8JwtSession: { method: "POST"; path: "/api/v1/auth/token/refresh"; request: B8RefreshRequest; response: B8AuthTokenEnvelope; idempotent: true };
  getB8JwtJwks: { method: "GET"; path: "/api/v1/auth/jwks"; request: never; response: ApiSuccessEnvelope & { data: B8JwksResponse; }; idempotent: false };
  requestB8PasswordReset: { method: "POST"; path: "/api/v1/auth/password-reset/request"; request: B8PasswordResetRequest; response: ApiSuccessEnvelope & { data: { accepted: true; }; }; idempotent: true };
  confirmB8PasswordReset: { method: "POST"; path: "/api/v1/auth/password-reset/confirm"; request: B8PasswordResetConfirmRequest; response: unknown; idempotent: true };
  listB8PolicyVersions: { method: "GET"; path: "/api/v1/iam/policy-versions"; request: never; response: unknown; idempotent: false };
  createB8PolicyDraft: { method: "POST"; path: "/api/v1/iam/policy-versions"; request: B8PolicyDraftCreateRequest; response: unknown; idempotent: true };
  getB8PolicyVersion: { method: "GET"; path: "/api/v1/iam/policy-versions/{policyVersionId}"; request: never; response: unknown; idempotent: false };
  updateB8PolicyDraft: { method: "PUT"; path: "/api/v1/iam/policy-versions/{policyVersionId}"; request: B8PolicyDraftUpdateRequest; response: unknown; idempotent: true };
  submitB8PolicyVersion: { method: "POST"; path: "/api/v1/iam/policy-versions/{policyVersionId}/submit"; request: B8PolicySubmitRequest; response: unknown; idempotent: true };
  approveB8PolicyVersion: { method: "POST"; path: "/api/v1/iam/policy-versions/{policyVersionId}/approvals"; request: B8PolicyApprovalRequest; response: unknown; idempotent: true };
  activateB8PolicyVersion: { method: "POST"; path: "/api/v1/iam/policy-versions/{policyVersionId}/activate"; request: B8PolicyActivationRequest; response: unknown; idempotent: true };
  revokeB8PolicyVersion: { method: "POST"; path: "/api/v1/iam/policy-versions/{policyVersionId}/revoke"; request: B8PolicyRevocationRequest; response: unknown; idempotent: true };
  getB8ActivePolicyBundle: { method: "GET"; path: "/internal/v1/iam/policy-bundles/active"; request: never; response: unknown; idempotent: false };
  evaluateB8PdpDecision: { method: "POST"; path: "/internal/v1/iam/pdp/decisions"; request: B8PdpAuthorizationDecisionRequest; response: unknown; idempotent: true };
  getB9ScheduledPublishTask: { method: "GET"; path: "/api/v1/admin/content-publish-tasks/{taskId}"; request: never; response: B9ScheduledPublishTaskResponse; idempotent: false };
  createMediaUploadIntent: { method: "POST"; path: "/api/v1/media/upload-intents"; request: MediaUploadIntentRequest; response: ApiSuccessEnvelope & { data: MediaUploadIntent; }; idempotent: true };
  completeMediaUploadIntent: { method: "POST"; path: "/api/v1/media/upload-intents/{uploadIntentId}/complete"; request: MediaUploadIntentCompleteRequest; response: ApiSuccessEnvelope & { data: MediaUploadIntentCompletion; }; idempotent: true };
  getMediaProcessingTask: { method: "GET"; path: "/api/v1/media/processing-tasks/{taskId}"; request: never; response: ApiSuccessEnvelope & { data: MediaProcessingTask; }; idempotent: false };
  retryMediaProcessingTask: { method: "POST"; path: "/api/v1/media/processing-tasks/{taskId}/retry"; request: MediaProcessingTaskRetryRequest; response: ApiSuccessEnvelope & { data: MediaProcessingTask; }; idempotent: true };
  createMediaAssetSignedAccess: { method: "POST"; path: "/api/v1/media/assets/{assetId}/signed-access"; request: MediaSignedAccessRequest; response: ApiSuccessEnvelope & { data: MediaSignedAccessGrant; }; idempotent: true };
  createSpeakingRecordingUploadIntent: { method: "POST"; path: "/api/v1/speaking/recordings/upload-intents"; request: SpeakingRecordingUploadIntentRequest; response: ApiSuccessEnvelope & { data: SpeakingRecordingUploadIntent; }; idempotent: true };
  completeSpeakingRecording: { method: "POST"; path: "/api/v1/speaking/recordings/{recordingId}/complete"; request: SpeakingRecordingCompleteRequest; response: ApiSuccessEnvelope & { data: SpeakingRecording; }; idempotent: true };
  completeSpeakingShadowingSession: { method: "POST"; path: "/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/complete"; request: SpeakingShadowingCompletionRequest; response: ApiSuccessEnvelope & { data: SpeakingShadowingCompletionReceipt; }; idempotent: true };
  getB9LearnerGoalOptions: { method: "GET"; path: "/api/v1/learner/goal-options"; request: never; response: ApiSuccessEnvelope & { data: B9GoalOptions; }; idempotent: false };
  getB9FirstDayRecovery: { method: "GET"; path: "/api/v1/learner/first-day/recovery/{recoveryTaskId}"; request: never; response: ApiSuccessEnvelope & { data: B9FirstDayRecovery; }; idempotent: false };
  createB10PlacementSession: { method: "POST"; path: "/api/v1/assessment/placement/sessions"; request: never; response: ApiSuccessEnvelope & { data: B10PlacementSession; }; idempotent: true };
  getB10PlacementSession: { method: "GET"; path: "/api/v1/assessment/placement/sessions/{sessionId}"; request: never; response: ApiSuccessEnvelope & { data: B10PlacementSession; }; idempotent: false };
  submitB10PlacementResponse: { method: "POST"; path: "/api/v1/assessment/placement/sessions/{sessionId}/responses"; request: B10PlacementResponseSubmitRequest; response: ApiSuccessEnvelope & { data: B10PlacementResponseReceipt; }; idempotent: true };
  createB10PlacementSkipBaseline: { method: "POST"; path: "/api/v1/assessment/placement/baselines/skip"; request: B10PlacementSkipBaselineRequest; response: ApiSuccessEnvelope & { data: B10PlacementResult; }; idempotent: true };
  getB10PlacementReport: { method: "GET"; path: "/api/v1/assessment/placement/reports/{reportId}"; request: never; response: ApiSuccessEnvelope & { data: B10PlacementReport; }; idempotent: false };
  getB10LearningPlan: { method: "GET"; path: "/api/v1/learning/plans/current"; request: never; response: ApiSuccessEnvelope & { data: B10LearningPlan; }; idempotent: false };
  getB10LearningToday: { method: "GET"; path: "/api/v1/learning/today"; request: never; response: ApiSuccessEnvelope & { data: B10TodayLearningPlan; }; idempotent: false };
  reorderB10LearningPlan: { method: "POST"; path: "/api/v1/learning/plans/reorder"; request: B10PlanReorderRequest; response: ApiSuccessEnvelope & { data: B10PlanReorderResult; }; idempotent: true };
  completeB10LearningTask: { method: "POST"; path: "/api/v1/learning/tasks/{taskId}/complete"; request: B10TaskCompletionRequest; response: ApiSuccessEnvelope & { data: B10TaskCompletionResult; }; idempotent: true };
  listB10LearningRepairs: { method: "GET"; path: "/api/v1/learning/repairs"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<B10RepairItem>; }; idempotent: false };
  getB10LearningRepair: { method: "GET"; path: "/api/v1/learning/repairs/{repairId}"; request: never; response: ApiSuccessEnvelope & { data: B10RepairItem; }; idempotent: false };
  getB10LearningMasteryOverview: { method: "GET"; path: "/api/v1/learning/mastery"; request: never; response: ApiSuccessEnvelope & { data: B10MasteryOverview; }; idempotent: false };
  getB10LearningReport: { method: "GET"; path: "/api/v1/learning/reports/{reportType}"; request: never; response: ApiSuccessEnvelope & { data: B10LearningReport; }; idempotent: false };
  resolveM1015CommerceEntitlementSnapshot: { method: "POST"; path: "/internal/v1/commerce/entitlements/{entitlementId}/snapshot"; request: M1015EntitlementSnapshotResolveRequest; response: M1015EntitlementSnapshot; idempotent: true };
  revokeM1015CommerceEntitlement: { method: "POST"; path: "/internal/v1/commerce/entitlements/{entitlementId}/revoke"; request: M1015EntitlementRevokeRequest; response: M1015EntitlementRevokeReceipt; idempotent: true };
  listM1016LearningSyncReceipts: { method: "GET"; path: "/api/v1/learning/sync/receipts"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<M1016SyncReceipt>; }; idempotent: false };
  getM1016LearningSyncCursor: { method: "GET"; path: "/api/v1/learning/sync/cursor"; request: never; response: ApiSuccessEnvelope & { data: M1016SyncCursor; }; idempotent: false };
  listM1016LearningSyncConflicts: { method: "GET"; path: "/api/v1/learning/sync/conflicts"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<M1016SyncConflict>; }; idempotent: false };
  recoverM1016LearningSyncConflict: { method: "POST"; path: "/api/v1/learning/sync/conflicts/{conflictId}/recovery"; request: M1016SyncRecoveryRequest; response: ApiSuccessEnvelope & { data: M1016SyncRecoveryResult; }; idempotent: true };
  getM1016AdminSupportTicket: { method: "GET"; path: "/api/v1/admin/ops/tickets/{ticketId}"; request: never; response: ApiSuccessEnvelope & { data: M1016SupportTicket; }; idempotent: false };
  addM1016AdminSupportTicketMessage: { method: "POST"; path: "/api/v1/admin/ops/tickets/{ticketId}/messages"; request: M1016SupportMessageCreateRequest; response: ApiSuccessEnvelope & { data: M1016SupportMessage; }; idempotent: true };
  submitM1016SupportTicketCommand: { method: "POST"; path: "/api/v1/admin/ops/tickets/{ticketId}/commands"; request: M1016SupportAdminCommandRequest; response: ApiSuccessEnvelope & { data: M1016SupportCommandResult; }; idempotent: true };
  createM1017AuditExport: { method: "POST"; path: "/internal/v1/audit/exports"; request: M1017AuditExportCreateRequest; response: ApiSuccessEnvelope & { data: M1017AuditExportCreateResponse; }; idempotent: true };
  getM1017AuditExport: { method: "GET"; path: "/internal/v1/audit/exports/{exportId}"; request: never; response: ApiSuccessEnvelope & { data: M1017AuditExportStatusResponse; }; idempotent: false };
  requestM1017AuditExportDownload: { method: "POST"; path: "/internal/v1/audit/exports/{exportId}/download"; request: M1017AuditExportDownloadRequest; response: ApiSuccessEnvelope & { data: M1017AuditExportDownloadGrant; }; idempotent: true };
  recoverM1017AuditExport: { method: "POST"; path: "/internal/v1/audit/exports/{exportId}/recovery"; request: M1017AuditExportRecoveryRequest; response: ApiSuccessEnvelope & { data: M1017AuditExportRecoveryReceipt; }; idempotent: true };
  createM1017PrivacyExport: { method: "POST"; path: "/api/v1/privacy/exports"; request: M1017PrivacyExportRequest; response: M1017PrivacyExportEnvelope; idempotent: true };
  getM1017PrivacyExportStatus: { method: "GET"; path: "/api/v1/privacy/exports/{exportId}"; request: never; response: M1017PrivacyExportEnvelope; idempotent: false };
  createM1017PrivacyExportDownloadGrant: { method: "POST"; path: "/api/v1/privacy/exports/{exportId}/download"; request: never; response: M1017PrivacyDownloadGrantEnvelope; idempotent: true };
  getM1017PrivacyExportReceipt: { method: "GET"; path: "/api/v1/privacy/exports/{exportId}/receipt"; request: never; response: M1017PrivacyReceiptEnvelope; idempotent: false };
  recordM1017PrivacyExportOwnerReceipt: { method: "POST"; path: "/internal/v1/privacy/exports/{exportId}/owner-receipts"; request: M1017OwnerReceiptSubmission; response: M1017PrivacyExportEnvelope; idempotent: true };
  recoverM1017PrivacyExport: { method: "POST"; path: "/internal/v1/privacy/exports/{exportId}/recovery"; request: M1017PrivacyRecoveryCommand; response: M1017PrivacyExportEnvelope; idempotent: true };
  createM1017AccountDeletionRequest: { method: "POST"; path: "/api/v1/iam/account-deletions"; request: M1017AccountDeletionRequest; response: M1017AccountDeletionEnvelope; idempotent: true };
  getM1017AccountDeletionStatus: { method: "GET"; path: "/api/v1/iam/account-deletions/{deletionRequestId}"; request: never; response: M1017AccountDeletionEnvelope; idempotent: false };
  cancelM1017AccountDeletionRequest: { method: "POST"; path: "/api/v1/iam/account-deletions/{deletionRequestId}/cancel"; request: M1017AccountDeletionCancelRequest; response: M1017AccountDeletionEnvelope; idempotent: true };
  executeM1017AccountDeletion: { method: "POST"; path: "/internal/v1/iam/account-deletions/{deletionRequestId}/execute"; request: never; response: M1017AccountDeletionEnvelope; idempotent: true };
  recordM1017AccountDeletionOwnerReceipt: { method: "POST"; path: "/internal/v1/iam/account-deletions/{deletionRequestId}/owner-receipts"; request: M1017OwnerReceiptSubmission; response: M1017AccountDeletionEnvelope; idempotent: true };
  recoverM1017AccountDeletion: { method: "POST"; path: "/internal/v1/iam/account-deletions/{deletionRequestId}/recovery"; request: M1017DeletionRecoveryCommand; response: M1017AccountDeletionEnvelope; idempotent: true };
  ingestM1017AnalyticsTelemetry: { method: "POST"; path: "/api/v1/analytics/telemetry"; request: M1017AnalyticsTelemetryRequest; response: ApiSuccessEnvelope & { data: M1017AnalyticsTelemetryReceipt; }; idempotent: true };
  resolveB9LearnerContentSubstitute: { method: "GET"; path: "/api/v1/content/learner/substitute"; request: never; response: { data: { unavailableCode: string; reasonCode: string; alternativeAction: string; substitute: { contentCode: string; contentVersionId: number; kind?: string; targetLevel?: string; title?: string; }; }; }; idempotent: false };
  requestWorkflowRecovery: { method: "POST"; path: "/api/v1/admin/recovery/recoveries"; request: { subjectType: string; subjectId: string; action: string; reason: string; }; response: Record<string, never>; idempotent: true };
  approveWorkflowRecovery: { method: "POST"; path: "/api/v1/admin/recovery/recoveries/{recoveryId}/approve"; request: Record<string, never>; response: Record<string, never>; idempotent: true };
  rejectWorkflowRecovery: { method: "POST"; path: "/api/v1/admin/recovery/recoveries/{recoveryId}/reject"; request: { reason?: string; }; response: Record<string, never>; idempotent: true };
  executeWorkflowRecovery: { method: "POST"; path: "/api/v1/admin/recovery/recoveries/{recoveryId}/execute"; request: Record<string, never>; response: Record<string, never>; idempotent: true };
  listUnfinishedSagas: { method: "GET"; path: "/api/v1/admin/recovery/sagas/unfinished"; request: never; response: ReadonlyArray<string>; idempotent: false };
  readWorkflowSaga: { method: "GET"; path: "/api/v1/admin/recovery/sagas/{sagaId}"; request: never; response: Record<string, never>; idempotent: false };
  compensateWorkflowSaga: { method: "POST"; path: "/api/v1/admin/recovery/sagas/{sagaId}/compensate"; request: Record<string, never>; response: Record<string, never>; idempotent: true };
  importB9ContentBatch: { method: "POST"; path: "/api/v1/admin/content-commands/import/batch"; request: { items: ReadonlyArray<Record<string, never>>; }; response: unknown; idempotent: true };
  validateB9ContentAuto: { method: "POST"; path: "/api/v1/admin/content-commands/validate/auto"; request: { contentCode?: string; content?: Record<string, never>; }; response: unknown; idempotent: true };
  registerMediaAsset: { method: "POST"; path: "/api/v1/media/assets"; request: Record<string, never>; response: unknown; idempotent: true };
  readMediaAssetTasks: { method: "GET"; path: "/api/v1/media/assets/{assetId}/tasks"; request: never; response: unknown; idempotent: false };
  retryMediaAsset: { method: "POST"; path: "/api/v1/media/assets/{assetId}/retry"; request: never; response: unknown; idempotent: true };
  upsertMediaSubtitle: { method: "POST"; path: "/api/v1/media/assets/{assetId}/subtitles"; request: Record<string, never>; response: unknown; idempotent: true };
  mintMediaUploadUrl: { method: "POST"; path: "/api/v1/media/assets/{assetId}/upload-url"; request: never; response: unknown; idempotent: true };
  activateMediaAsset: { method: "PUT"; path: "/api/v1/media/assets/{assetId}/active"; request: { verifiedChecksumSha256: string; verifiedSizeBytes: number; }; response: unknown; idempotent: true };
  listAssessmentMistakes: { method: "GET"; path: "/api/v1/assessment/mistakes"; request: never; response: unknown; idempotent: false };
  verifyAssessmentMistake: { method: "POST"; path: "/api/v1/assessment/mistakes/{mistakeId}/verify"; request: { outcome: "CORRECT" | "WRONG"; }; response: unknown; idempotent: true };
  issueAssessmentVariant: { method: "POST"; path: "/api/v1/assessment/mistakes/{mistakeId}/variant"; request: { variantItemId: number; }; response: unknown; idempotent: true };
  readPrivacyExportStatus: { method: "GET"; path: "/api/v1/privacy/export/{exportId}"; request: never; response: unknown; idempotent: false };
  readPrivacyExportDownload: { method: "GET"; path: "/api/v1/privacy/export/{exportId}/download"; request: never; response: unknown; idempotent: false };
  listAdminLearnerSubjects: { method: "GET"; path: "/api/v1/admin/learners/search"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<AdminLearnerSubject>; }; idempotent: false };
  getAdminLearnerProfile: { method: "GET"; path: "/api/v1/admin/learners/{subjectId}/profile"; request: never; response: ApiSuccessEnvelope & { data: AdminLearnerProfile; }; idempotent: false };
  sendAdminLearnerCommand: { method: "POST"; path: "/api/v1/admin/learners/{subjectId}/commands"; request: AdminLearnerCommandRequest; response: ApiSuccessEnvelope & { data: AdminLearnerCommandAccepted; }; idempotent: true };
  getAdminLearnerPlans: { method: "GET"; path: "/api/v1/admin/learners/{subjectId}/plans"; request: never; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: false };
  getAdminLearnerSrs: { method: "GET"; path: "/api/v1/admin/learners/{subjectId}/srs"; request: never; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: false };
  sendAdminLearningCommand: { method: "POST"; path: "/api/v1/admin/learners/{subjectId}/learning-commands"; request: AdminLearningCommandRequest; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: true };
  getAdminLearnerAssessments: { method: "GET"; path: "/api/v1/admin/learners/{subjectId}/assessments"; request: never; response: ApiSuccessEnvelope & { data: Record<string, never>; }; idempotent: false };
  getPlacementBankSealedSnapshot: { method: "GET"; path: "/internal/v1/content/placement-bank/sealed"; request: never; response: PlacementBankSealedSnapshotResponse; idempotent: false };
  pinB9LearnerTargetContent: { method: "PUT"; path: "/internal/v1/learner/targets/pin"; request: B9TargetPinRequest; response: B9TargetPinResult; idempotent: true };
  getB10LearningPlanView: { method: "GET"; path: "/internal/v1/learning/plans/current-view"; request: never; response: B10EnsurePlanResult; idempotent: false };
  getPlacementBankPlanItems: { method: "GET"; path: "/internal/v1/content/placement-bank/plan-items"; request: never; response: PlacementBankPlanItemsResponse; idempotent: false };
  ensureB10LearningPlan: { method: "POST"; path: "/api/v1/learning/plans:ensure"; request: B10EnsurePlanRequest; response: ApiSuccessEnvelope & { data: B10EnsurePlanResult; }; idempotent: true };
  listB8LockedAccounts: { method: "GET"; path: "/api/v1/iam/accounts/locked"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<B8LockedAccount>; }; idempotent: false };
  listAdminRiskCases: { method: "GET"; path: "/api/v1/admin/ops/risk/cases"; request: never; response: ApiCursorPageEnvelope & { data: ReadonlyArray<AdminRiskCase>; }; idempotent: false };
  fileAdminRiskCase: { method: "POST"; path: "/api/v1/admin/ops/risk/cases"; request: AdminRiskFileRequest; response: { data: AdminRiskCase; }; idempotent: true };
  decideAdminRiskCase: { method: "POST"; path: "/api/v1/admin/ops/risk/cases/{caseId}/commands"; request: AdminRiskDecisionRequest; response: { data: AdminRiskCase; }; idempotent: true };
  evaluateAdminRiskRules: { method: "POST"; path: "/api/v1/admin/ops/risk/rules:evaluate"; request: AdminRiskEvaluateRequest; response: { data: AdminRiskEvaluateResult; }; idempotent: true };
  getIamLearningConsentFact: { method: "GET"; path: "/internal/v1/iam/principals/{principalId}/learning-consent"; request: never; response: { data: B8LearningConsentFact; }; idempotent: false };
  retestB10PlacementSession: { method: "POST"; path: "/api/v1/assessment/placement/sessions/{sessionId}/retest"; request: never; response: ApiSuccessEnvelope & { data: B10PlacementSession; }; idempotent: true };
}

export type ApiOperationId = keyof ApiOperationRegistry;
