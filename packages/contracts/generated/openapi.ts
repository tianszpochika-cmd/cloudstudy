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
export type B2VerificationSubmission = B2AnswerSubmissionRequest & { stage: "D0" | "D1" | "D7"; };

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
 * Generated from the contract source.
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
 * Generated from the contract source.
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
export type B3SentenceBlockRequest = { blockOrder: ReadonlyArray<string>; clientEventId: string; contentVersionId: B3Id; };

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
export type B3OfflinePackageRequest = { contentVersionId: B3Id; materialIds: ReadonlyArray<B3Id>; deviceId: string; };

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
 * Generated from the contract source.
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
export type B5ContentDraftRequest = { contentCode: string; contentType: "COURSE" | "UNIT" | "VOCABULARY" | "QUESTION" | "MEDIA"; title: string; contentHash: string; sourceCode?: string; licenseCode?: string; payload?: { [key: string]: unknown; }; };

/**
 * Generated from the contract source.
 */
export type B5ContentSaveRequest = { contentHash: string; payload?: { [key: string]: unknown; }; targetVersionId?: string; reasonCode?: string; };

/**
 * Generated from the contract source.
 */
export type B5ReviewDecisionRequest = { stage: "FIRST" | "FINAL"; decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reasonCode?: string; };

/**
 * Generated from the contract source.
 */
export type B5ImportJobRequest = { targetType: "COURSE" | "UNIT" | "VOCABULARY" | "QUESTION" | "MEDIA"; sourceHash: string; rows?: ReadonlyArray<{ [key: string]: unknown; }>; };

/**
 * Generated from the contract source.
 */
export type B5CorrectionResolveRequest = { decisionCode: "FIXED" | "REJECTED" | "DUPLICATE" | "NO_ACTION"; resolutionRef?: string; };

/**
 * Generated from the contract source.
 */
export type B5RiskActionRequest = { actionCode: "FREEZE_LOGIN" | "FREEZE_PAYMENT" | "RATE_LIMIT" | "UNFREEZE"; ttlSeconds?: number; };

/**
 * Generated from the contract source.
 */
export type B5ReconciliationImportRequest = { channelCode: "WECHAT" | "ALIPAY" | "APPLE"; sourceHash: string; items: ReadonlyArray<{ channelTradeNo: string; orderId: string; amountMinor: number; }>; };

/**
 * Generated from the contract source.
 */
export type B5ReconciliationResolveRequest = { decisionCode: "MATCHED" | "REFUND_REQUIRED" | "MANUAL_CREDIT" | "IGNORE"; reasonCode?: string; };

/**
 * Generated from the contract source.
 */
export type B5FlagUpdateRequest = { enabled?: boolean; rolloutPercent?: number; ruleVersion?: string; allowedPlatforms?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B5SupportTicketRequest = { ticketType: "CONTENT_CORRECTION" | "PAYMENT" | "ACCOUNT" | "OTHER"; resourceRef: string; descriptionHash: string; attachmentRefs?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B5SupportMessageRequest = { messageHash: string; clientMessageRef: string; };

/**
 * Generated from the contract source.
 */
export type B5ActivationBatchRequest = { skuId: string; count: number; expiresAt: string; };

/**
 * Generated from the contract source.
 */
export type B5OrderAdjustmentRequest = { actionCode: "GRANT_ENTITLEMENT" | "REVOKE_ENTITLEMENT" | "REFUND_MARK" | "CHARGEBACK_MARK"; reasonCode: string; };

/**
 * Generated from the contract source.
 */
export type B6Envelope = { requestId: string; data: { [key: string]: unknown; }; };

/**
 * Generated from the contract source.
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
export type B6ReleaseGateRequest = { releaseVersion: string; candidateBuildIds: ReadonlyArray<string>; requiredChecks: ReadonlyArray<"COMPATIBILITY" | "E2E" | "SECURITY" | "RELIABILITY" | "BACKUP">; privacyStatus: "PASS" | "FAIL" | "PENDING"; copyrightStatus: "PASS" | "FAIL" | "PENDING"; merchantStatus: "PASS" | "FAIL" | "PENDING"; platformReviewStatus: "PASS" | "FAIL" | "PENDING" | "NOT_REQUIRED"; rollbackPlanRef: string; };

/**
 * Generated from the contract source.
 */
export type B8ErrorEnvelope = { requestId: string; traceId: string; error: B8Error; };

/**
 * Generated from the contract source.
 */
export type B8Error = { code: "invalid_request" | "unauthorized" | "forbidden" | "adult_gate_required" | "consent_required" | "session_revoked" | "policy_denied" | "idp_unavailable" | "conflict" | "not_found" | "rate_limited"; message: string; retryable: boolean; policyVersion?: string; details?: Record<string, never>; };

/**
 * Generated from the contract source.
 */
export type B8AuthorizationStartResponse = { authorizationUrl: string; transactionId: string; provider: string; expiresAt: string; };

/**
 * Generated from the contract source.
 */
export type B8OidcCallbackRequest = { code: string; state: string; redirectUri: string; };

/**
 * Generated from the contract source.
 */
export type B8OidcCallbackResponse = { session: B8SessionTokenResponse; principal: B8PrincipalResponse; adultGate: B8AdultGateResponse; consentState: B8ConsentState; };

/**
 * Generated from the contract source.
 */
export type B8SessionRefreshRequest = { refreshToken: string; };

/**
 * Generated from the contract source.
 */
export type B8SessionTokenResponse = { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number; deviceId?: B8DeviceId; sessionId: B8SessionId; tokenType?: "Bearer"; };

/**
 * Generated from the contract source.
 */
export type B8SessionRevocationResponse = { sessionId: B8SessionId; status: "REVOKED"; revokedAt: string; };

/**
 * Generated from the contract source.
 */
export type B8PrincipalResponse = { principalId: string; subjectType: "ADULT_LEARNER"; provider: string; status: "ACTIVE" | "RESTRICTED" | "REVOKED"; adultGate: B8AdultGateResponse; consentState: B8ConsentState; policyVersion?: string; };

/**
 * Generated from the contract source.
 */
export type B8Device = { deviceId: B8DeviceId; sessionId: B8SessionId; platform: "ANDROID" | "IOS" | "WEB" | "PWA" | "MINIAPP"; status: "ACTIVE" | "REVOKED" | "RISK_REVIEW"; lastActiveAt: string; current: boolean; };

/**
 * Generated from the contract source.
 */
export type B8DeviceListResponse = { items: ReadonlyArray<B8Device>; total: number; };

/**
 * Generated from the contract source.
 */
export type B8AdultGateRequest = { birthYear: number; policyVersion: string; adultDeclaration: true; };

/**
 * Generated from the contract source.
 */
export type B8AdultGateResponse = { status: "PENDING" | "APPROVED" | "REJECTED"; policyVersion: string; evaluatedAt: string; retryAllowed?: boolean; };

/**
 * Generated from the contract source.
 */
export type B8Consent = { consentType: "TERMS" | "PRIVACY" | "ADULT_LEARNING" | "PRODUCT_ANALYTICS"; consentVersion: string; decision: "ACCEPTED" | "WITHDRAWN"; updatedAt: string; };

/**
 * Generated from the contract source.
 */
export type B8ConsentState = { required: boolean; accepted: boolean; version: string; };

/**
 * Generated from the contract source.
 */
export type B8ConsentListResponse = { items: ReadonlyArray<B8Consent>; };

/**
 * Generated from the contract source.
 */
export type B8ConsentUpdateRequest = { consentType: "TERMS" | "PRIVACY" | "ADULT_LEARNING" | "PRODUCT_ANALYTICS"; consentVersion: string; decision: "ACCEPTED" | "WITHDRAWN"; };

/**
 * Generated from the contract source.
 */
export type B8OidcProviderMetadata = { issuer: string; authorizationEndpoint: string; jwksUri: string; codeChallengeMethods: ReadonlyArray<"S256">; scopes?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B8JwksResponse = { keys: ReadonlyArray<{ kid: string; kty: "RSA"; use: "sig"; alg: "RS256" | "RS384" | "RS512"; n: string; e: string; }>; };

/**
 * 只提交待判定的动作和资源上下文；subject、tenant、owner、role、permission 和 consent 事实由验证后的 workload/principal 与服务端事实派生。
 */
export type B8AuthorizationDecisionRequest = { action: string; resourceType: string; resourceId: string; phase: "P1" | "P2" | "P3"; contentRights?: "PUBLISHED" | "LICENSED" | "INTERNAL" | "UNKNOWN"; deviceTrust?: "TRUSTED" | "STANDARD" | "RISK_REVIEW" | "UNKNOWN"; consentRequirement?: "NONE" | "TERMS" | "PRIVACY" | "ADULT_LEARNING" | "PRODUCT_ANALYTICS"; };

/**
 * Generated from the contract source.
 */
export type B8AuthorizationDecisionResponse = { decisionId: string; decision: "ALLOW" | "DENY"; reasonCode: "ALLOWED" | "POLICY_DENIED" | "ADULT_GATE_REQUIRED" | "CONSENT_REQUIRED" | "SESSION_REVOKED" | "CONTEXT_MISSING" | "POLICY_UNAVAILABLE"; policyVersion: string; evaluatedAt: string; cacheUntil?: string; };

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
export type B8PermissionsResponse = { principalId: string; roles: ReadonlyArray<string>; permissions: ReadonlyArray<string>; adultGate: B8AdultGateResponse; policyVersion?: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentVersionSummary = { contentVersionId: B9ContentVersionId; versionNumber: number; status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "UNPUBLISHED" | "ROLLED_BACK" | "ARCHIVED"; contentHash: string; sourceCode?: string; licenseCode?: string; createdAt: B9DateTime; publishedAt?: B9DateTime; };

/**
 * Generated from the contract source.
 */
export type B9ContentItemDefinition = { itemCode: string; itemType: B9ContentItemType; displayOrder: number; stimulusRef: string; displayText?: string; definition: { [key: string]: unknown; }; answerRuleVersion?: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentDraftInput = { contentType: B9ContentType; title: string; summary?: string; contentLocale: B9Locale; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; sourceCode: string; licenseCode: string; contentHash: string; items: ReadonlyArray<B9ContentItemDefinition>; };

/**
 * 命令只表达意图和资源版本；actor、tenant、owner、role、permission、reviewer 和版权事实均由服务端从已验证上下文与内容记录派生。
 */
export type B9ContentCommandRequest = { command: "CREATE_DRAFT" | "SAVE_DRAFT" | "VALIDATE_DRAFT" | "SUBMIT_REVIEW" | "REVIEW_FIRST" | "REVIEW_FINAL" | "PUBLISH" | "UNPUBLISH" | "ROLLBACK"; contentCode: B9ContentCode; expectedStateVersion: B9ExpectedStateVersion; targetVersionNumber?: number; reasonCode?: string; content?: B9ContentDraftInput; reviewDecision?: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; reviewNote?: string; };

/**
 * Generated from the contract source.
 */
export type B9ContentCommandAccepted = { commandId: string; command: string; contentCode: B9ContentCode; contentVersionId?: B9ContentVersionId; status: B9CommandStatus; stateVersion: B9StateVersion; outboxEventId?: string; acceptedAt: B9DateTime; };

/**
 * Generated from the contract source.
 */
export type B9PublicContentItem = { itemCode: string; itemType: B9ContentItemType; displayOrder: number; stimulusRef: string; displayText?: string; mediaRefs?: ReadonlyArray<string>; };

/**
 * Generated from the contract source.
 */
export type B9PublicContentProjection = { projectionKey: B9ProjectionKey; contentCode: B9ContentCode; contentType: B9ContentType; title: string; summary?: string; contentLocale: B9Locale; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; contentVersionId: B9ContentVersionId; versionNumber: number; projectionVersion: B9ProjectionVersion; contentEpoch: B9ContentEpoch; availability: "PUBLISHED"; items: ReadonlyArray<B9PublicContentItem>; publishedAt: B9DateTime; cacheTag: string; };

/**
 * Generated from the contract source.
 */
export type B9LearnerContentProjection = { content: B9PublicContentProjection; learnerAccess: { available: boolean; offlineAllowed: boolean; reasonCode: "ALLOWED" | "PHASE_RESTRICTED" | "RIGHTS_RESTRICTED" | "DEVICE_RESTRICTED" | "POLICY_DENIED"; }; contentEpoch: B9ContentEpoch; };

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
export type B9DownloadChannel = { platform: "WEB" | "IOS" | "ANDROID" | "IPAD" | "WECHAT_MINI_PROGRAM" | "WINDOWS"; channel: string; status: "AVAILABLE" | "UNAVAILABLE" | "COMING_SOON"; downloadUrl?: string; version?: string; };

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
 * Generated from the contract source.
 */
export type B9PublicProjectionState = { availability: B9ContentAvailability; projectionVersion: B9ProjectionVersion; contentEpoch: B9ContentEpoch; lastPublishedAt?: B9DateTime; cacheTag?: string; };

/**
 * Generated from the contract source.
 */
export type B9AdminContentState = { contentCode: B9ContentCode; contentType: B9ContentType; title: string; authorSubject?: string; stateVersion: B9StateVersion; latestStatus: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "UNPUBLISHED" | "ROLLED_BACK" | "ARCHIVED"; versions: ReadonlyArray<B9ContentVersionSummary>; publicProjection: B9PublicProjectionState; rightsStatus: "PENDING" | "VALID" | "EXPIRED" | "REVOKED"; reviewStages?: ReadonlyArray<"FIRST_PENDING" | "FIRST_APPROVED" | "FINAL_PENDING" | "FINAL_APPROVED" | "REJECTED">; };

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
export type B9LearnerProfile = { principalId: B9PrincipalId; tenantId: "platform"; status: "ONBOARDING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED"; uiLocale: B9Locale; contentLocale: B9Locale; timezone: string; targetGoal?: string; proficiencyLevel?: "UNKNOWN" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; stateVersion: B9StateVersion; updatedAt: B9DateTime; };

/**
 * 只提交可由学习者修改的字段；principalId、tenantId、role、owner 和权限事实由服务端派生。
 */
export type B9LearnerProfilePatch = { expectedStateVersion: B9ExpectedStateVersion; uiLocale?: B9Locale; contentLocale?: B9Locale; timezone?: string; targetGoal?: string; proficiencyLevel?: "UNKNOWN" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; };

/**
 * Generated from the contract source.
 */
export type B9LearnerTarget = { targetId: number; goalCode: string; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; examCode?: string; dailyQuotaMinutes: 5 | 15 | 30 | 45 | 60; targetDate?: string; status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED"; stateVersion: B9StateVersion; updatedAt: B9DateTime; };

/**
 * 目标命令不接受 tenantId 或 owner/principal 字段；目标始终绑定到已验证主体。
 */
export type B9LearnerTargetUpsert = { expectedStateVersion: B9ExpectedStateVersion; goalCode: string; targetLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"; examCode?: string; dailyQuotaMinutes: 5 | 15 | 30 | 45 | 60; targetDate?: string; status?: "ACTIVE" | "PAUSED"; };

/**
 * Generated from the contract source.
 */
export type B9LearnerPreferences = { uiLocale: B9Locale; contentLocale: B9Locale; timezone: string; themeMode: "LIGHT" | "DARK" | "SYSTEM"; highContrast: boolean; motionMode: "FULL" | "REDUCED" | "OFF"; stateVersion: B9StateVersion; updatedAt: B9DateTime; };

/**
 * UI locale、content locale、主题和无障碍设置分开持久化；contentLocale 不得覆盖 UI locale。
 */
export type B9LearnerPreferencesPatch = { expectedStateVersion: B9ExpectedStateVersion; uiLocale?: B9Locale; contentLocale?: B9Locale; timezone?: string; themeMode?: "LIGHT" | "DARK" | "SYSTEM"; highContrast?: boolean; motionMode?: "FULL" | "REDUCED" | "OFF"; };

/**
 * Generated from the contract source.
 */
export type B9TaskRef = { taskId: string; taskType: "GOAL_SETUP" | "PLACEMENT" | "LESSON" | "REVIEW" | "CONTENT_RECOVERY"; status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED" | "UNAVAILABLE"; contentCode?: B9ContentCode; contentVersionPin?: B9ContentVersionId; position: number; unavailableReason?: "NONE" | "CONTENT_UNPUBLISHED" | "RIGHTS_EXPIRED" | "POLICY_DENIED" | "SERVICE_DEGRADED"; };

/**
 * Generated from the contract source.
 */
export type B9FirstDayProjection = { state: "NOT_READY" | "READY" | "DEGRADED"; profileReady: boolean; targetReady: boolean; placementStatus: "NOT_STARTED" | "IN_PROGRESS" | "SKIPPED" | "COMPLETED" | "UNAVAILABLE"; taskCount: number; tasks: ReadonlyArray<B9TaskRef>; contentEpoch: B9ContentEpoch; projectionVersion: B9ProjectionVersion; generatedAt: B9DateTime; degradedReason?: "NONE" | "CONTENT_PROJECTION_STALE" | "LEGACY_SHADOW_ONLY" | "DEPENDENCY_UNAVAILABLE"; };

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
 * Generated from the contract source.
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
 * Generated from the contract source.
 */
export type B10ContentVersionPin = { contentCode: B10ContentCode; contentVersionId: B10Int64Id; contentEpoch: B10ContentEpoch; snapshotId: B10SnapshotId; snapshotHash: B10Sha256; pinStatus: "PINNED" | "UNPUBLISHED" | "RECOVERABLE" | "RECOVERED" | "UNAVAILABLE"; pinnedAt: B10DateTime; fallbackVersionId?: B10Int64Id | null; recoveryReasonCode?: "NONE" | "CONTENT_UNPUBLISHED" | "RIGHTS_EXPIRED" | "SNAPSHOT_MISSING" | "POLICY_DENIED" | "SERVICE_DEGRADED"; };

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
export type B10RuleContract = { ruleRef: string; ruleVersion: string; ruleDigest: B10Sha256; evaluationMode: "DETERMINISTIC" | "MANUAL_REVIEW" | "SELF_RATING"; sealed: true; };

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
export type B10AssessmentContentSnapshot = { pin: B10ContentVersionPin; snapshotVersion: B10ProjectionVersion; gradingRuleSetVersion: string; items: ReadonlyArray<B10AssessmentContentItem>; generatedAt: B10DateTime; };

/**
 * Generated from the contract source.
 */
export type B10ContentRecovery = { requestedVersionId: B10Int64Id; resolvedVersionId?: B10Int64Id | null; resolvedSnapshotId?: B10SnapshotId | null; resolution: "EXACT_PIN" | "IMMUTABLE_SNAPSHOT" | "SAFE_FUTURE_FALLBACK" | "UNAVAILABLE"; contentEpoch?: B10ContentEpoch; recoveryReasonCode?: "NONE" | "CONTENT_UNPUBLISHED" | "RIGHTS_EXPIRED" | "SNAPSHOT_MISSING" | "POLICY_DENIED" | "SERVICE_DEGRADED"; mustNotRegrade: true; resolvedAt: B10DateTime; };

/**
 * The client may request a content version but cannot provide tenant, owner, role, score or grading rule facts.
 */
export type B10CreateAssessmentSessionRequest = { contentVersionId: B10Int64Id; mode: "PRACTICE" | "REVIEW" | "PLACEMENT" | "MOCK"; itemIds?: ReadonlyArray<B10Int64Id>; clientSessionRef?: string; };

/**
 * Generated from the contract source.
 */
export type B10AssessmentSession = { sessionId: B10SessionId; status: "IN_PROGRESS" | "SUBMITTED" | "ASSESSED" | "EXPIRED" | "CANCELLED"; mode: "PRACTICE" | "REVIEW" | "PLACEMENT" | "MOCK"; pin: B10ContentVersionPin; items: ReadonlyArray<B10LearnerContentItem>; attemptCount?: number; stateVersion: B10StateVersion; startedAt: B10DateTime; expiresAt?: B10DateTime | null; };

/**
 * Generated from the contract source.
 */
export type B10AttemptSubmission = { itemId: B10Int64Id; sequence: number; response: Record<string, never>; clientSubmissionId?: string; };

/**
 * Generated from the contract source.
 */
export type B10SubmitAttemptRequest = { expectedStateVersion: B10StateVersion; submissionId: string; items: ReadonlyArray<B10AttemptSubmission>; clientEventId?: string; };

/**
 * Generated from the contract source.
 */
export type B10Attempt = { attemptId: B10AttemptId; sessionId: B10SessionId; attemptVersion: number; status: "ACCEPTED" | "ASSESSING" | "ASSESSED" | "REJECTED" | "COMPENSATED"; itemCount: number; submissionDigest: B10Sha256; pin: B10ContentVersionPin; assessmentVersion?: string; scoreBucket?: "UNASSESSED" | "ZERO" | "PARTIAL" | "FULL" | "PENDING_REVIEW"; createdAt: B10DateTime; assessedAt?: B10DateTime | null; };

/**
 * Generated from the contract source.
 */
export type B10CheckpointRequest = { checkpointVersion: number; itemCursor: number; completedItemIds?: ReadonlyArray<B10Int64Id>; checkpointDigest: B10Sha256; };

/**
 * Generated from the contract source.
 */
export type B10Checkpoint = { attemptId: B10AttemptId; checkpointVersion: number; itemCursor: number; checkpointDigest: B10Sha256; savedAt: B10DateTime; };

/**
 * Generated from the contract source.
 */
export type B10AssessmentReport = { reportId: B10ReportId; attemptId: B10AttemptId; reportVersion: number; status: "READY" | "PARTIAL" | "FAILED" | "COMPENSATED"; scoreBucket: "ZERO" | "PARTIAL" | "FULL" | "PENDING_REVIEW"; mistakeCodes: ReadonlyArray<string>; masterySignal?: "NO_SIGNAL" | "WEAK" | "STABLE" | "MASTERED" | "RETRY"; pin: B10ContentVersionPin; generatedAt: B10DateTime; replayable: true; };

/**
 * Generated from the contract source.
 */
export type B10LearningQueueItem = { queueItemId: B10QueueItemId; itemId: B10Int64Id; source: "NEW" | "REVIEW" | "MISTAKE" | "RETRY"; state: "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REVIEW_QUEUE" | "REOPENED"; dueAt: B10DateTime; priority: number; pin: B10ContentVersionPin; stateVersion: B10StateVersion; };

/**
 * Generated from the contract source.
 */
export type B10CompleteReviewRequest = { expectedStateVersion: B10StateVersion; verificationStage: "D0" | "D1" | "D7"; result: "PASS" | "FAIL" | "SKIPPED"; clientEventId?: string; };

/**
 * Generated from the contract source.
 */
export type B10MasteryProjection = { itemId: B10Int64Id; fromState: "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REVIEW_QUEUE" | "REOPENED" | "NONE"; toState: "LEARNING" | "DELAY_VERIFY_D1" | "DELAY_VERIFY_D7" | "MASTERED" | "REVIEW_QUEUE" | "REOPENED"; srsStage?: "NEW" | "D0" | "D1" | "D7" | "MASTERED"; nextReviewAt?: B10DateTime | null; projectionVersion: B10ProjectionVersion; projectionStatus: "PENDING" | "APPLIED" | "RETRYING" | "COMPENSATED" | "MANUAL_REVIEW"; sourceAssessmentId: B10AttemptId; pin: B10ContentVersionPin; projectedAt: B10DateTime; };

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
 * Generated from the contract source.
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
 * Generated from the contract source.
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
export type B12RewardProbability = { probabilityVersion: string; tiers: ReadonlyArray<{ tierCode: string; basisPoints: number; }>; disclosedAt: string; };

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
export type B12NotificationMessage = { messageId: string; notificationType: string; channel: "IN_APP" | "PUSH" | "EMAIL"; title: string; safeBody: string; contentVersion: string; createdAt: string; };

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
  listB4Notifications: { method: "GET"; path: "/api/v1/user/notifications"; request: never; response: unknown; idempotent: false };
  kickB1UserDevice: { method: "POST"; path: "/api/v1/user/devices/{devicePublicId}/kick"; request: never; response: B1AnyData; idempotent: true };
  listB1LoginAlerts: { method: "GET"; path: "/api/v1/user/login-alerts"; request: never; response: B1AnyData; idempotent: false };
  getB1DeletionStatus: { method: "GET"; path: "/api/v1/user/deletion"; request: never; response: B1AnyData; idempotent: false };
  requestB1Deletion: { method: "POST"; path: "/api/v1/user/deletion"; request: B1AnyData; response: B1AnyData; idempotent: true };
  cancelB1Deletion: { method: "DELETE"; path: "/api/v1/user/deletion"; request: never; response: B1AnyData; idempotent: true };
  getB2DailyStream: { method: "GET"; path: "/api/v1/assessment/daily-stream"; request: never; response: unknown; idempotent: false };
  createB10AssessmentSession: { method: "POST"; path: "/api/v1/assessment/sessions"; request: B10CreateAssessmentSessionRequest; response: B10AssessmentSessionResponse; idempotent: true };
  getB10AssessmentSession: { method: "GET"; path: "/api/v1/assessment/sessions/{sessionId}"; request: never; response: B10AssessmentSessionResponse; idempotent: false };
  submitB2AssessmentAnswer: { method: "POST"; path: "/api/v1/assessment/sessions/{sessionId}/answers"; request: B2AnswerSubmissionRequest; response: unknown; idempotent: true };
  saveB2AssessmentCheckpoint: { method: "PUT"; path: "/api/v1/assessment/sessions/{sessionId}/checkpoint"; request: B2CheckpointRequest; response: unknown; idempotent: true };
  completeB2AssessmentSession: { method: "POST"; path: "/api/v1/assessment/sessions/{sessionId}/complete"; request: never; response: unknown; idempotent: true };
  listB2ExamPapers: { method: "GET"; path: "/api/v1/exam/papers"; request: never; response: unknown; idempotent: false };
  getB2ExamPaper: { method: "GET"; path: "/api/v1/exam/papers/{paperId}"; request: never; response: unknown; idempotent: false };
  createB2ExamSession: { method: "POST"; path: "/api/v1/exam/sessions"; request: B2CreateExamSessionRequest; response: unknown; idempotent: true };
  getB2ExamSession: { method: "GET"; path: "/api/v1/exam/sessions/{sessionId}"; request: never; response: unknown; idempotent: false };
  b2ExamHeartbeat: { method: "POST"; path: "/api/v1/exam/sessions/{sessionId}/heartbeat"; request: B2HeartbeatRequest; response: unknown; idempotent: true };
  recordB2AntiCheatEvent: { method: "POST"; path: "/api/v1/exam/sessions/{sessionId}/anti-cheat-events"; request: B2AntiCheatEventRequest; response: unknown; idempotent: true };
  getB2AnswerSheet: { method: "GET"; path: "/api/v1/exam/sessions/{sessionId}/answer-sheet"; request: never; response: unknown; idempotent: false };
  updateB2AnswerSheetMark: { method: "POST"; path: "/api/v1/exam/sessions/{sessionId}/answer-sheet/marks"; request: B2AnswerSheetMarkRequest; response: unknown; idempotent: true };
  saveB2ExamCheckpoint: { method: "PUT"; path: "/api/v1/exam/sessions/{sessionId}/checkpoint"; request: B2CheckpointRequest; response: unknown; idempotent: true };
  submitB2ExamAnswer: { method: "POST"; path: "/api/v1/exam/sessions/{sessionId}/answers"; request: B2AnswerSubmissionRequest; response: unknown; idempotent: true };
  submitB2Exam: { method: "POST"; path: "/api/v1/exam/sessions/{sessionId}/submit"; request: never; response: unknown; idempotent: true };
  getB2ExamReport: { method: "GET"; path: "/api/v1/exam/sessions/{sessionId}/report"; request: never; response: unknown; idempotent: false };
  listB2ExamHistory: { method: "GET"; path: "/api/v1/exam/history"; request: never; response: unknown; idempotent: false };
  getB2MasteryOverview: { method: "GET"; path: "/api/v1/mastery/overview"; request: never; response: unknown; idempotent: false };
  listB2Mistakes: { method: "GET"; path: "/api/v1/mastery/mistakes"; request: never; response: unknown; idempotent: false };
  getB2MistakeDetail: { method: "GET"; path: "/api/v1/mastery/mistakes/{mistakeId}"; request: never; response: unknown; idempotent: false };
  startB2MistakeRetry: { method: "POST"; path: "/api/v1/mastery/mistakes/{mistakeId}/retry"; request: never; response: unknown; idempotent: true };
  listB2MasteryVerifications: { method: "GET"; path: "/api/v1/mastery/verifications"; request: never; response: unknown; idempotent: false };
  submitB2MasteryVerification: { method: "POST"; path: "/api/v1/mastery/verifications/{verificationId}/submit"; request: B2VerificationSubmission; response: unknown; idempotent: true };
  getB2DailyReport: { method: "GET"; path: "/api/v1/mastery/reports/daily"; request: never; response: unknown; idempotent: false };
  getB2WeeklyReport: { method: "GET"; path: "/api/v1/mastery/reports/weekly"; request: never; response: unknown; idempotent: false };
  createB2ShareAsset: { method: "POST"; path: "/api/v1/mastery/share-assets"; request: B2ShareAssetRequest; response: unknown; idempotent: true };
  listWordbooks: { method: "GET"; path: "/api/v1/vocab/wordbooks"; request: never; response: unknown; idempotent: false };
  activateWordbook: { method: "PUT"; path: "/api/v1/vocab/wordbooks/{wordbookId}/activation"; request: { active: true; }; response: unknown; idempotent: true };
  listWordbookItems: { method: "GET"; path: "/api/v1/vocab/wordbooks/{wordbookId}/items"; request: never; response: unknown; idempotent: false };
  getVocabDetail: { method: "GET"; path: "/api/v1/vocab/items/{vocabId}"; request: never; response: unknown; idempotent: false };
  getChunkDetail: { method: "GET"; path: "/api/v1/vocab/chunks/{chunkId}"; request: never; response: unknown; idempotent: false };
  getRootTopic: { method: "GET"; path: "/api/v1/vocab/roots/{rootId}"; request: never; response: unknown; idempotent: false };
  listUserLibrary: { method: "GET"; path: "/api/v1/vocab/library"; request: never; response: unknown; idempotent: false };
  addLibraryEntry: { method: "POST"; path: "/api/v1/vocab/library/entries"; request: LibraryEntryCreateRequest; response: unknown; idempotent: true };
  removeLibraryEntry: { method: "DELETE"; path: "/api/v1/vocab/library/entries/{entryId}"; request: never; response: unknown; idempotent: true };
  listExpressions: { method: "GET"; path: "/api/v1/vocab/expressions"; request: never; response: unknown; idempotent: false };
  createMinedExpression: { method: "POST"; path: "/api/v1/vocab/expressions"; request: ExpressionCreateRequest; response: unknown; idempotent: true };
  updateMinedExpression: { method: "PATCH"; path: "/api/v1/vocab/expressions/{expressionId}"; request: ExpressionUpdateRequest; response: unknown; idempotent: true };
  deleteMinedExpression: { method: "DELETE"; path: "/api/v1/vocab/expressions/{expressionId}"; request: never; response: unknown; idempotent: true };
  getOfflineVocabularyCards: { method: "GET"; path: "/api/v1/vocab/offline/cards"; request: never; response: unknown; idempotent: false };
  createSrsBatch: { method: "POST"; path: "/api/v1/learning/srs/batches"; request: SrsBatchCreateRequest; response: unknown; idempotent: true };
  getSrsBatch: { method: "GET"; path: "/api/v1/learning/srs/batches/{snapshotId}"; request: never; response: unknown; idempotent: false };
  submitReviewEvent: { method: "POST"; path: "/api/v1/learning/srs/reviews"; request: ReviewEventRequest; response: unknown; idempotent: true };
  syncReviewEvents: { method: "POST"; path: "/api/v1/learning/srs/reviews:sync"; request: { events: ReadonlyArray<ReviewEventRequest>; }; response: unknown; idempotent: true };
  listSrsStates: { method: "GET"; path: "/api/v1/learning/srs/states"; request: never; response: unknown; idempotent: false };
  getSrsOverview: { method: "GET"; path: "/api/v1/learning/srs/overview"; request: never; response: unknown; idempotent: false };
  getCurrentLearningPlan: { method: "GET"; path: "/api/v1/learning/plan/current"; request: never; response: unknown; idempotent: false };
  getTodayLearningStream: { method: "GET"; path: "/api/v1/learning/stream/today"; request: never; response: unknown; idempotent: false };
  submitLearningStreamAction: { method: "POST"; path: "/api/v1/learning/stream/action"; request: B2LearningStreamActionRequest; response: unknown; idempotent: true };
  startLegacyAssessmentSession: { method: "POST"; path: "/api/v1/assessment/session/start"; request: B2CreateAssessmentSessionRequest; response: unknown; idempotent: true };
  submitLegacyAssessmentAnswerItem: { method: "POST"; path: "/api/v1/assessment/session/answer-item"; request: B2LegacyAnswerItemRequest; response: unknown; idempotent: true };
  submitLegacyAssessmentSession: { method: "POST"; path: "/api/v1/assessment/session/submit"; request: B2LegacySessionSubmitRequest; response: unknown; idempotent: true };
  getLegacyAssessmentReport: { method: "GET"; path: "/api/v1/assessment/report/{sessionUuid}"; request: never; response: unknown; idempotent: false };
  getLearningMistakeQueue: { method: "GET"; path: "/api/v1/learning/mistakes/queue"; request: never; response: unknown; idempotent: false };
  verifyLearningMistake: { method: "POST"; path: "/api/v1/learning/mistakes/verify"; request: B2LegacyMistakeVerifyRequest; response: unknown; idempotent: true };
  getDailyLearningSummary: { method: "GET"; path: "/api/v1/learning/stats/daily-summary"; request: never; response: unknown; idempotent: false };
  listLearningNotifications: { method: "GET"; path: "/api/v1/notifications"; request: never; response: unknown; idempotent: false };
  listB3GrammarPoints: { method: "GET"; path: "/api/v1/grammar/points"; request: never; response: unknown; idempotent: false };
  getB3GrammarPoint: { method: "GET"; path: "/api/v1/grammar/points/{grammarPointId}"; request: never; response: unknown; idempotent: false };
  getB3SentenceGraph: { method: "GET"; path: "/api/v1/grammar/sentences/{sentenceId}"; request: never; response: unknown; idempotent: false };
  createB3GrammarPracticeSession: { method: "POST"; path: "/api/v1/grammar/practice/sessions"; request: B3GrammarSessionRequest; response: unknown; idempotent: true };
  submitB3GrammarAnswer: { method: "POST"; path: "/api/v1/grammar/practice/sessions/{sessionId}/answers"; request: B3GrammarAnswerRequest; response: unknown; idempotent: true };
  listB3WritingPrompts: { method: "GET"; path: "/api/v1/writing/prompts"; request: never; response: unknown; idempotent: false };
  createB3WritingSubmission: { method: "POST"; path: "/api/v1/writing/submissions"; request: B3WritingSubmissionRequest; response: unknown; idempotent: true };
  getB3WritingEvaluation: { method: "GET"; path: "/api/v1/writing/submissions/{submissionId}"; request: never; response: unknown; idempotent: false };
  submitB3Correction: { method: "POST"; path: "/api/v1/writing/corrections"; request: B3CorrectionRequest; response: unknown; idempotent: true };
  listB3ListeningMaterials: { method: "GET"; path: "/api/v1/listening/materials"; request: never; response: unknown; idempotent: false };
  getB3ListeningMaterial: { method: "GET"; path: "/api/v1/listening/materials/{materialId}"; request: never; response: unknown; idempotent: false };
  createB3ListeningSession: { method: "POST"; path: "/api/v1/listening/sessions"; request: B3ListeningSessionRequest; response: unknown; idempotent: true };
  submitB3Dictation: { method: "POST"; path: "/api/v1/listening/sessions/{sessionId}/dictation"; request: B3DictationRequest; response: unknown; idempotent: true };
  updateB3ListeningProgress: { method: "PUT"; path: "/api/v1/listening/sessions/{sessionId}/progress"; request: B3ProgressRequest; response: unknown; idempotent: true };
  listB3ReadingArticles: { method: "GET"; path: "/api/v1/reading/articles"; request: never; response: unknown; idempotent: false };
  getB3ReadingArticle: { method: "GET"; path: "/api/v1/reading/articles/{articleId}"; request: never; response: unknown; idempotent: false };
  updateB3ReadingProgress: { method: "PUT"; path: "/api/v1/reading/progress"; request: B3ProgressRequest; response: unknown; idempotent: true };
  createB3SentenceMining: { method: "POST"; path: "/api/v1/reading/mining"; request: B3MiningRequest; response: unknown; idempotent: true };
  getB3PhoneticsCatalog: { method: "GET"; path: "/api/v1/phonetics/catalog"; request: never; response: unknown; idempotent: false };
  createB3SpeakingRecording: { method: "POST"; path: "/api/v1/speaking/recordings"; request: B3RecordingRequest; response: unknown; idempotent: true };
  getB3SpeakingRecording: { method: "GET"; path: "/api/v1/speaking/recordings/{recordingId}"; request: never; response: unknown; idempotent: false };
  deleteB3SpeakingRecording: { method: "DELETE"; path: "/api/v1/speaking/recordings/{recordingId}"; request: never; response: unknown; idempotent: true };
  submitB3SpeakingSelfRating: { method: "POST"; path: "/api/v1/speaking/recordings/{recordingId}/self-rating"; request: B3SelfRatingRequest; response: unknown; idempotent: true };
  pushB4OfflineSync: { method: "POST"; path: "/api/v1/offline/sync/push"; request: B4SyncRequest; response: unknown; idempotent: true };
  pullB4OfflineSync: { method: "GET"; path: "/api/v1/offline/sync/pull"; request: never; response: unknown; idempotent: false };
  getB3OfflineManifest: { method: "GET"; path: "/api/v1/offline/manifests/{manifestId}"; request: never; response: unknown; idempotent: false };
  getB3GrammarTree: { method: "GET"; path: "/api/v1/grammar/tree"; request: never; response: unknown; idempotent: false };
  listB3GrammarTraps: { method: "GET"; path: "/api/v1/grammar/points/{grammarPointId}/traps"; request: never; response: unknown; idempotent: false };
  listB3GrammarExercises: { method: "GET"; path: "/api/v1/grammar/exercises"; request: never; response: unknown; idempotent: false };
  getB3GrammarExercise: { method: "GET"; path: "/api/v1/grammar/exercises/{exerciseId}"; request: never; response: unknown; idempotent: false };
  submitB3GrammarAttempt: { method: "POST"; path: "/api/v1/grammar/practice/attempts"; request: B3GrammarAttemptRequest; response: unknown; idempotent: true };
  getB3GrammarMastery: { method: "GET"; path: "/api/v1/grammar/mastery"; request: never; response: unknown; idempotent: false };
  getB3TargetedGrammarPack: { method: "GET"; path: "/api/v1/grammar/targeted-packs"; request: never; response: unknown; idempotent: false };
  getB3SentenceXray: { method: "GET"; path: "/api/v1/grammar/sentences/{sentenceId}/xray"; request: never; response: unknown; idempotent: false };
  getB3SentenceBlocks: { method: "GET"; path: "/api/v1/grammar/sentences/{sentenceId}/blocks"; request: never; response: unknown; idempotent: false };
  submitB3SentenceBlocks: { method: "POST"; path: "/api/v1/grammar/sentences/{sentenceId}/blocks"; request: B3SentenceBlockRequest; response: unknown; idempotent: true };
  submitB3SentenceImitation: { method: "POST"; path: "/api/v1/grammar/sentences/{sentenceId}/imitation"; request: B3ImitationRequest; response: unknown; idempotent: true };
  listB3TranslationExercises: { method: "GET"; path: "/api/v1/writing/translation/exercises"; request: never; response: unknown; idempotent: false };
  listB3WritingTemplates: { method: "GET"; path: "/api/v1/writing/templates"; request: never; response: unknown; idempotent: false };
  listB3WritingMaterials: { method: "GET"; path: "/api/v1/writing/materials"; request: never; response: unknown; idempotent: false };
  listB3ProofreadingExercises: { method: "GET"; path: "/api/v1/writing/proofreading/exercises"; request: never; response: unknown; idempotent: false };
  listB3WritingHistory: { method: "GET"; path: "/api/v1/writing/history"; request: never; response: unknown; idempotent: false };
  getB3ListeningTimeline: { method: "GET"; path: "/api/v1/listening/materials/{materialId}/timeline"; request: never; response: unknown; idempotent: false };
  listB3LanguageClips: { method: "GET"; path: "/api/v1/listening/clips"; request: never; response: unknown; idempotent: false };
  listB3OfflinePackages: { method: "GET"; path: "/api/v1/listening/offline-packages"; request: never; response: unknown; idempotent: false };
  createB3OfflinePackage: { method: "POST"; path: "/api/v1/listening/offline-packages"; request: B3OfflinePackageRequest; response: unknown; idempotent: true };
  getB3OfflinePackage: { method: "GET"; path: "/api/v1/listening/offline-packages/{packageId}"; request: never; response: unknown; idempotent: false };
  downloadB3OfflineAsset: { method: "GET"; path: "/api/v1/listening/offline-packages/{packageId}/assets/{assetId}"; request: never; response: unknown; idempotent: false };
  syncB3OfflinePackage: { method: "POST"; path: "/api/v1/listening/offline-packages/{packageId}/sync"; request: B3OfflinePackageSyncRequest; response: unknown; idempotent: true };
  getB3ReadingDictionaryEntry: { method: "GET"; path: "/api/v1/reading/articles/{articleId}/dictionary"; request: never; response: unknown; idempotent: false };
  getB3ReadingStory: { method: "GET"; path: "/api/v1/reading/articles/{articleId}/story"; request: never; response: unknown; idempotent: false };
  listB3ReadingQuestions: { method: "GET"; path: "/api/v1/reading/questions"; request: never; response: unknown; idempotent: false };
  submitB3ReadingAttempt: { method: "POST"; path: "/api/v1/reading/attempts"; request: B3ReadingAttemptRequest; response: unknown; idempotent: true };
  listB3MinimalPairs: { method: "GET"; path: "/api/v1/phonetics/minimal-pairs"; request: never; response: unknown; idempotent: false };
  createB3ShadowingSession: { method: "POST"; path: "/api/v1/speaking/shadowing/sessions"; request: B3ShadowingSessionRequest; response: unknown; idempotent: true };
  updateB3ShadowingProgress: { method: "POST"; path: "/api/v1/speaking/shadowing/sessions/{shadowingSessionId}/progress"; request: B3ShadowingProgressRequest; response: unknown; idempotent: true };
  createB3RoleplaySession: { method: "POST"; path: "/api/v1/speaking/roleplay/sessions"; request: B3RoleplaySessionRequest; response: unknown; idempotent: true };
  submitB3RoleplayTurn: { method: "POST"; path: "/api/v1/speaking/roleplay/sessions/{roleplaySessionId}/turns"; request: B3RoleplayTurnRequest; response: unknown; idempotent: true };
  getB4GamificationProfile: { method: "GET"; path: "/api/v1/gamification/profile"; request: never; response: unknown; idempotent: false };
  listB4GamificationLedger: { method: "GET"; path: "/api/v1/gamification/ledger"; request: never; response: unknown; idempotent: false };
  settleB4LearningEvent: { method: "POST"; path: "/api/v1/gamification/events"; request: B4LearningEventRequest; response: unknown; idempotent: true };
  getB4Streak: { method: "GET"; path: "/api/v1/gamification/streak"; request: never; response: unknown; idempotent: false };
  updateB4StreakSettings: { method: "PUT"; path: "/api/v1/gamification/streak/settings"; request: B4StreakSettingsRequest; response: unknown; idempotent: true };
  rescueB4Streak: { method: "POST"; path: "/api/v1/gamification/streak/rescue"; request: B4RescueRequest; response: unknown; idempotent: true };
  listB4Quests: { method: "GET"; path: "/api/v1/gamification/quests"; request: never; response: unknown; idempotent: false };
  claimB4QuestReward: { method: "POST"; path: "/api/v1/gamification/quests/{questId}/claim"; request: never; response: unknown; idempotent: true };
  listB4Achievements: { method: "GET"; path: "/api/v1/gamification/achievements"; request: never; response: unknown; idempotent: false };
  updateB4AchievementShowcase: { method: "PUT"; path: "/api/v1/gamification/achievements/{achievementCode}/showcase"; request: B4ShowcaseRequest; response: unknown; idempotent: true };
  listB4Chests: { method: "GET"; path: "/api/v1/gamification/chests"; request: never; response: unknown; idempotent: false };
  getB4ChestProbability: { method: "GET"; path: "/api/v1/gamification/chests/{chestGrantId}/probability"; request: never; response: unknown; idempotent: false };
  openB4Chest: { method: "POST"; path: "/api/v1/gamification/chests/{chestGrantId}/open"; request: never; response: unknown; idempotent: true };
  getB4Collection: { method: "GET"; path: "/api/v1/gamification/collection"; request: never; response: unknown; idempotent: false };
  listB4Catalog: { method: "GET"; path: "/api/v1/gamification/catalog"; request: never; response: unknown; idempotent: false };
  redeemB4CatalogItem: { method: "POST"; path: "/api/v1/gamification/catalog/{catalogItemId}/redeem"; request: never; response: unknown; idempotent: true };
  getB4CurrentSeason: { method: "GET"; path: "/api/v1/gamification/seasons/current"; request: never; response: unknown; idempotent: false };
  listB4SeasonRewards: { method: "GET"; path: "/api/v1/gamification/seasons/{seasonId}/rewards"; request: never; response: unknown; idempotent: false };
  getB4AvatarProfile: { method: "GET"; path: "/api/v1/avatar/profile"; request: never; response: unknown; idempotent: false };
  saveB4AvatarProfile: { method: "PUT"; path: "/api/v1/avatar/profile"; request: B4AvatarRequest; response: unknown; idempotent: true };
  listB4AvatarItems: { method: "GET"; path: "/api/v1/avatar/items"; request: never; response: unknown; idempotent: false };
  listB4AvatarLoadouts: { method: "GET"; path: "/api/v1/avatar/loadouts"; request: never; response: unknown; idempotent: false };
  saveB4AvatarLoadout: { method: "PUT"; path: "/api/v1/avatar/loadouts/{loadoutId}"; request: B4LoadoutRequest; response: unknown; idempotent: true };
  equipB4AvatarLoadout: { method: "POST"; path: "/api/v1/avatar/loadouts/{loadoutId}/equip"; request: never; response: unknown; idempotent: true };
  getB4AvatarResources: { method: "GET"; path: "/api/v1/avatar/resources"; request: never; response: unknown; idempotent: false };
  getB4StudySpace: { method: "GET"; path: "/api/v1/avatar/study-space"; request: never; response: unknown; idempotent: false };
  saveB4StudySpace: { method: "PUT"; path: "/api/v1/avatar/study-space"; request: B4StudySpaceRequest; response: unknown; idempotent: true };
  listB4Games: { method: "GET"; path: "/api/v1/games/catalog"; request: never; response: unknown; idempotent: false };
  createB4GameSession: { method: "POST"; path: "/api/v1/games/sessions"; request: B4GameSessionRequest; response: unknown; idempotent: true };
  getB4GameSession: { method: "GET"; path: "/api/v1/games/sessions/{sessionId}"; request: never; response: unknown; idempotent: false };
  submitB4GameEvent: { method: "POST"; path: "/api/v1/games/sessions/{sessionId}/events"; request: B4GameEventRequest; response: unknown; idempotent: true };
  pauseB4GameSession: { method: "POST"; path: "/api/v1/games/sessions/{sessionId}/pause"; request: never; response: unknown; idempotent: true };
  resumeB4GameSession: { method: "POST"; path: "/api/v1/games/sessions/{sessionId}/resume"; request: never; response: unknown; idempotent: true };
  finishB4GameSession: { method: "POST"; path: "/api/v1/games/sessions/{sessionId}/finish"; request: never; response: unknown; idempotent: true };
  listB4SocialRooms: { method: "GET"; path: "/api/v1/social/rooms"; request: never; response: unknown; idempotent: false };
  getB4SocialRoom: { method: "GET"; path: "/api/v1/social/rooms/{roomId}"; request: never; response: unknown; idempotent: false };
  joinB4SocialRoom: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/join"; request: B4JoinRoomRequest; response: unknown; idempotent: true };
  leaveB4SocialRoom: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/leave"; request: never; response: unknown; idempotent: true };
  startB4FocusSession: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/focus-sessions"; request: B4FocusRequest; response: unknown; idempotent: true };
  updateB4FocusSession: { method: "PATCH"; path: "/api/v1/social/focus-sessions/{sessionId}"; request: B4FocusRequest; response: unknown; idempotent: true };
  recordB12RoomInteraction: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/interactions"; request: B12PresetInteraction; response: B12InteractionResult; idempotent: true };
  getB12Leaderboard: { method: "GET"; path: "/api/v1/social/leaderboards"; request: never; response: B12Leaderboard; idempotent: false };
  createB4SocialWsTicket: { method: "POST"; path: "/api/v1/social/ws-ticket"; request: B4WsTicketRequest; response: unknown; idempotent: true };
  listB4OfflinePackages: { method: "GET"; path: "/api/v1/sync/offline-packages"; request: never; response: unknown; idempotent: false };
  authorizeB4OfflinePackage: { method: "POST"; path: "/api/v1/sync/offline-packages/{packageId}/authorize"; request: never; response: unknown; idempotent: true };
  enqueueB11SyncChanges: { method: "POST"; path: "/api/v1/sync/changes"; request: B11SyncEnqueueRequest; response: B11SyncReceipt; idempotent: true };
  listB11SyncChanges: { method: "GET"; path: "/api/v1/sync/changes"; request: never; response: B11SyncReceipt; idempotent: false };
  pushB4SyncEvents: { method: "POST"; path: "/api/v1/sync/events"; request: B4SyncRequest; response: unknown; idempotent: true };
  saveB4SyncCheckpoint: { method: "PUT"; path: "/api/v1/sync/checkpoints/{entityId}"; request: B4CheckpointRequest; response: unknown; idempotent: true };
  createB4ModerationReport: { method: "POST"; path: "/api/v1/social/moderation/reports"; request: B4ReportRequest; response: unknown; idempotent: true };
  createB4Block: { method: "POST"; path: "/api/v1/social/moderation/blocks"; request: B4BlockRequest; response: unknown; idempotent: true };
  createB4RoomMute: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/mutes"; request: B4MuteRequest; response: unknown; idempotent: true };
  markB4NotificationRead: { method: "PUT"; path: "/api/v1/user/notifications/{messageId}/read"; request: never; response: unknown; idempotent: true };
  markAllB4NotificationsRead: { method: "PUT"; path: "/api/v1/user/notifications/read-all"; request: never; response: unknown; idempotent: true };
  getB4NotificationPreferences: { method: "GET"; path: "/api/v1/user/notification-preferences"; request: never; response: unknown; idempotent: false };
  updateB4NotificationPreferences: { method: "PATCH"; path: "/api/v1/user/notification-preferences"; request: B4NotificationPreferencesRequest; response: unknown; idempotent: true };
  updateB4OfflineDownload: { method: "PATCH"; path: "/api/v1/sync/offline-downloads/{downloadId}"; request: B4OfflineDownloadRequest; response: unknown; idempotent: true };
  cleanupB4OfflineDownload: { method: "POST"; path: "/api/v1/sync/offline-downloads/{downloadId}/cleanup"; request: never; response: unknown; idempotent: true };
  appealB4ModerationReport: { method: "POST"; path: "/api/v1/social/moderation/reports/{reportId}/appeal"; request: B4AppealRequest; response: unknown; idempotent: true };
  listCommerceSkus: { method: "GET"; path: "/api/v1/commerce/skus"; request: never; response: unknown; idempotent: false };
  getCommerceSku: { method: "GET"; path: "/api/v1/commerce/skus/{skuId}"; request: never; response: unknown; idempotent: false };
  listCommerceOrders: { method: "GET"; path: "/api/v1/commerce/orders"; request: never; response: unknown; idempotent: false };
  createCommerceOrder: { method: "POST"; path: "/api/v1/commerce/orders"; request: B5CreateOrderRequest; response: unknown; idempotent: true };
  getCommerceOrder: { method: "GET"; path: "/api/v1/commerce/orders/{orderId}"; request: never; response: unknown; idempotent: false };
  createPaymentAttempt: { method: "POST"; path: "/api/v1/commerce/orders/{orderId}/payment-attempts"; request: B5PaymentAttemptRequest; response: unknown; idempotent: true };
  receiveWechatCallback: { method: "POST"; path: "/api/v1/commerce/wechat/callback"; request: B5ProviderCallbackRequest; response: unknown; idempotent: true };
  receiveAlipayNotify: { method: "POST"; path: "/api/v1/commerce/alipay/notify"; request: B5ProviderCallbackRequest; response: unknown; idempotent: true };
  verifyAppleTransaction: { method: "POST"; path: "/api/v1/commerce/apple/transactions/verify"; request: B5AppleVerificationRequest; response: unknown; idempotent: true };
  scanAppleRecovery: { method: "POST"; path: "/api/v1/commerce/apple/recovery/scan"; request: B5AppleVerificationRequest; response: unknown; idempotent: true };
  receiveAppleNotification: { method: "POST"; path: "/api/v1/commerce/apple/notifications"; request: B5ProviderCallbackRequest; response: unknown; idempotent: true };
  getMyEntitlements: { method: "GET"; path: "/api/v1/commerce/entitlements/me"; request: never; response: unknown; idempotent: false };
  createHousehold: { method: "POST"; path: "/api/v1/commerce/households"; request: B5HouseholdRequest; response: unknown; idempotent: true };
  createHouseholdInvitation: { method: "POST"; path: "/api/v1/commerce/households/{householdId}/invitations"; request: B5InvitationRequest; response: unknown; idempotent: true };
  acceptHouseholdInvitation: { method: "POST"; path: "/api/v1/commerce/households/invitations/accept"; request: B5InvitationAcceptRequest; response: unknown; idempotent: true };
  removeHouseholdMember: { method: "DELETE"; path: "/api/v1/commerce/households/{householdId}/members/{memberUserId}"; request: never; response: unknown; idempotent: true };
  redeemActivationCode: { method: "POST"; path: "/api/v1/commerce/activation-codes/redeem"; request: B5ActivationRedeemRequest; response: unknown; idempotent: true };
  requestCommerceRefund: { method: "POST"; path: "/api/v1/commerce/orders/{orderId}/refunds"; request: B5RefundRequest; response: unknown; idempotent: true };
  listInvoices: { method: "GET"; path: "/api/v1/commerce/invoices"; request: never; response: unknown; idempotent: false };
  createInvoice: { method: "POST"; path: "/api/v1/commerce/invoices"; request: B5InvoiceRequest; response: unknown; idempotent: true };
  listSupportTickets: { method: "GET"; path: "/api/v1/support/tickets"; request: never; response: unknown; idempotent: false };
  createSupportTicket: { method: "POST"; path: "/api/v1/support/tickets"; request: B5SupportTicketRequest; response: unknown; idempotent: true };
  getSupportTicket: { method: "GET"; path: "/api/v1/support/tickets/{ticketId}"; request: never; response: unknown; idempotent: false };
  addSupportTicketMessage: { method: "POST"; path: "/api/v1/support/tickets/{ticketId}/messages"; request: B5SupportMessageRequest; response: unknown; idempotent: true };
  createContentDraft: { method: "POST"; path: "/api/v1/admin/content"; request: B5ContentDraftRequest; response: unknown; idempotent: true };
  saveContentDraft: { method: "PUT"; path: "/api/v1/admin/content/{contentId}/draft"; request: B5ContentSaveRequest; response: unknown; idempotent: true };
  validateContentDraft: { method: "POST"; path: "/api/v1/admin/content/{contentId}/validate"; request: never; response: unknown; idempotent: true };
  submitContentReview: { method: "POST"; path: "/api/v1/admin/content/{contentId}/submit-review"; request: never; response: unknown; idempotent: true };
  listReviewTasks: { method: "GET"; path: "/api/v1/admin/reviews"; request: never; response: unknown; idempotent: false };
  decideReviewTask: { method: "POST"; path: "/api/v1/admin/reviews/{reviewTaskId}/decision"; request: B5ReviewDecisionRequest; response: unknown; idempotent: true };
  publishContent: { method: "POST"; path: "/api/v1/admin/content/{contentId}/publish"; request: never; response: unknown; idempotent: true };
  rollbackContent: { method: "POST"; path: "/api/v1/admin/content/{contentId}/rollback"; request: B5ContentSaveRequest; response: unknown; idempotent: true };
  createImportJob: { method: "POST"; path: "/api/v1/admin/import-jobs"; request: B5ImportJobRequest; response: unknown; idempotent: true };
  getImportJob: { method: "GET"; path: "/api/v1/admin/import-jobs/{importJobId}"; request: never; response: unknown; idempotent: false };
  listCorrectionTickets: { method: "GET"; path: "/api/v1/admin/correction-tickets"; request: never; response: unknown; idempotent: false };
  resolveCorrectionTicket: { method: "POST"; path: "/api/v1/admin/correction-tickets/{ticketId}/resolve"; request: B5CorrectionResolveRequest; response: unknown; idempotent: true };
  getRiskProfile: { method: "GET"; path: "/api/v1/admin/risk/users/{userId}"; request: never; response: unknown; idempotent: false };
  applyRiskAction: { method: "POST"; path: "/api/v1/admin/risk/users/{userId}/actions"; request: B5RiskActionRequest; response: unknown; idempotent: true };
  getDashboardMetrics: { method: "GET"; path: "/api/v1/admin/dashboard/metrics"; request: never; response: unknown; idempotent: false };
  listReconciliationBatches: { method: "GET"; path: "/api/v1/admin/reconciliation/batches"; request: never; response: unknown; idempotent: false };
  resolveReconciliationItem: { method: "POST"; path: "/api/v1/admin/reconciliation/items/{itemId}/resolve"; request: B5ReconciliationResolveRequest; response: unknown; idempotent: true };
  listFeatureFlags: { method: "GET"; path: "/api/v1/admin/feature-flags"; request: never; response: unknown; idempotent: false };
  updateFeatureFlag: { method: "PUT"; path: "/api/v1/admin/feature-flags/{flagKey}"; request: B5FlagUpdateRequest; response: unknown; idempotent: true };
  createActivationBatch: { method: "POST"; path: "/api/v1/admin/activation-batches"; request: B5ActivationBatchRequest; response: unknown; idempotent: true };
  revokeActivationCode: { method: "POST"; path: "/api/v1/admin/activation-codes/{code}/revoke"; request: never; response: unknown; idempotent: true };
  adjustCommerceOrder: { method: "POST"; path: "/api/v1/admin/commerce/orders/{orderId}/adjust"; request: B5OrderAdjustmentRequest; response: unknown; idempotent: true };
  searchAuditLogs: { method: "GET"; path: "/api/v1/admin/audit-logs"; request: never; response: unknown; idempotent: false };
  exportAuditReport: { method: "POST"; path: "/api/v1/admin/audit-logs/export"; request: never; response: unknown; idempotent: true };
  importReconciliationBatch: { method: "POST"; path: "/api/v1/admin/reconciliation/batches/import"; request: B5ReconciliationImportRequest; response: unknown; idempotent: true };
  listAdminCommerceOrders: { method: "GET"; path: "/api/v1/admin/commerce/orders"; request: never; response: unknown; idempotent: false };
  getAdminUserEntitlements: { method: "GET"; path: "/api/v1/admin/commerce/users/{userId}/entitlements"; request: never; response: unknown; idempotent: false };
  getAdminSession: { method: "GET"; path: "/api/v1/admin/session"; request: never; response: unknown; idempotent: false };
  getB6ReleaseMatrix: { method: "GET"; path: "/api/v1/platform/release-matrix"; request: never; response: unknown; idempotent: false };
  registerB6PlatformBuild: { method: "POST"; path: "/api/v1/platform/builds"; request: B6BuildRequest; response: unknown; idempotent: true };
  getB6PlatformBuild: { method: "GET"; path: "/api/v1/platform/builds/{buildId}"; request: never; response: unknown; idempotent: false };
  recordB6CompatibilityCheck: { method: "POST"; path: "/api/v1/platform/compatibility-checks"; request: B6CompatibilityCheckRequest; response: unknown; idempotent: true };
  getB6PerformanceBudget: { method: "GET"; path: "/api/v1/platform/performance/budget"; request: never; response: unknown; idempotent: false };
  getB6AccessibilityChecklist: { method: "GET"; path: "/api/v1/platform/accessibility/checklist"; request: never; response: unknown; idempotent: false };
  getB6ResponsiveChecklist: { method: "GET"; path: "/api/v1/platform/responsive/checklist"; request: never; response: unknown; idempotent: false };
  recordB6E2ERun: { method: "POST"; path: "/api/v1/quality/e2e-runs"; request: B6E2ERunRequest; response: unknown; idempotent: true };
  getB6E2ERun: { method: "GET"; path: "/api/v1/quality/e2e-runs/{runId}"; request: never; response: unknown; idempotent: false };
  recordB6SecurityScan: { method: "POST"; path: "/api/v1/quality/security-scans"; request: B6SecurityScanRequest; response: unknown; idempotent: true };
  getB6SecurityScan: { method: "GET"; path: "/api/v1/quality/security-scans/{scanId}"; request: never; response: unknown; idempotent: false };
  recordB6ReliabilityRun: { method: "POST"; path: "/api/v1/quality/reliability-runs"; request: B6ReliabilityRunRequest; response: unknown; idempotent: true };
  getB6ReliabilityRun: { method: "GET"; path: "/api/v1/quality/reliability-runs/{runId}"; request: never; response: unknown; idempotent: false };
  getB6ObservabilityDashboard: { method: "GET"; path: "/api/v1/observability/dashboard"; request: never; response: unknown; idempotent: false };
  recordB6DataReliabilityDrill: { method: "POST"; path: "/api/v1/data-reliability/drills"; request: B6DrillRequest; response: unknown; idempotent: true };
  getB6DataReliabilityDrill: { method: "GET"; path: "/api/v1/data-reliability/drills/{drillId}"; request: never; response: unknown; idempotent: false };
  evaluateB6ReleaseGate: { method: "POST"; path: "/api/v1/release/gates/evaluate"; request: B6ReleaseGateRequest; response: unknown; idempotent: true };
  getB6ReleaseGate: { method: "GET"; path: "/api/v1/release/gates/{gateId}"; request: never; response: unknown; idempotent: false };
  startB8OidcAuthorization: { method: "GET"; path: "/api/v1/auth/oidc/{provider}/authorization/start"; request: never; response: B8AuthorizationStartResponse; idempotent: false };
  exchangeB8OidcCallback: { method: "POST"; path: "/api/v1/auth/oidc/{provider}/callback"; request: B8OidcCallbackRequest; response: B8OidcCallbackResponse; idempotent: true };
  refreshB8IamSession: { method: "POST"; path: "/api/v1/iam/session/refresh"; request: B8SessionRefreshRequest; response: B8SessionTokenResponse; idempotent: true };
  logoutB8IamSession: { method: "POST"; path: "/api/v1/iam/session/logout"; request: never; response: B8SessionRevocationResponse; idempotent: true };
  revokeB8IamSession: { method: "POST"; path: "/api/v1/iam/sessions/{sessionId}/revoke"; request: never; response: B8SessionRevocationResponse; idempotent: true };
  getB8CurrentPrincipal: { method: "GET"; path: "/api/v1/iam/principal/me"; request: never; response: B8PrincipalResponse; idempotent: false };
  listB8IamDevices: { method: "GET"; path: "/api/v1/iam/devices"; request: never; response: B8DeviceListResponse; idempotent: false };
  kickoutB8IamDevice: { method: "POST"; path: "/api/v1/iam/devices/{deviceId}/kickout"; request: never; response: B8SessionRevocationResponse; idempotent: true };
  evaluateB8AdultGate: { method: "POST"; path: "/api/v1/iam/adult-gate"; request: B8AdultGateRequest; response: B8AdultGateResponse; idempotent: true };
  listB8IamConsents: { method: "GET"; path: "/api/v1/iam/consents"; request: never; response: B8ConsentListResponse; idempotent: false };
  updateB8IamConsent: { method: "PUT"; path: "/api/v1/iam/consents"; request: B8ConsentUpdateRequest; response: B8Consent; idempotent: true };
  getB8OidcProviderMetadata: { method: "GET"; path: "/api/v1/auth/oidc/{provider}/metadata"; request: never; response: B8OidcProviderMetadata; idempotent: false };
  getB8OidcProviderJwks: { method: "GET"; path: "/api/v1/auth/oidc/{provider}/jwks"; request: never; response: B8JwksResponse; idempotent: false };
  decideB8Authorization: { method: "POST"; path: "/internal/v1/iam/authorization/decisions"; request: B8AuthorizationDecisionRequest; response: B8AuthorizationDecisionResponse; idempotent: true };
  getB8IamPermissions: { method: "GET"; path: "/api/v1/iam/permissions"; request: never; response: B8PermissionsResponse; idempotent: false };
  listB9PublicContentCatalog: { method: "GET"; path: "/api/v1/public/content/catalog"; request: never; response: B9PublicContentCatalogResponse; idempotent: false };
  getB9PublicContentProjection: { method: "GET"; path: "/api/v1/public/content/{contentCode}"; request: never; response: B9PublicContentProjectionResponse; idempotent: false };
  getB9OfficialSiteProjection: { method: "GET"; path: "/api/v1/public/site/projection"; request: never; response: B9PublicSiteProjectionResponse; idempotent: false };
  listB9LearnerContentCatalog: { method: "GET"; path: "/api/v1/content/learner/catalog"; request: never; response: B9LearnerContentCatalogResponse; idempotent: false };
  getB9LearnerContentProjection: { method: "GET"; path: "/api/v1/content/learner/{contentCode}"; request: never; response: B9LearnerContentProjectionResponse; idempotent: false };
  listB9AdminContentStates: { method: "GET"; path: "/api/v1/admin/content-commands"; request: never; response: B9AdminContentStateListResponse; idempotent: false };
  submitB9ContentCommand: { method: "POST"; path: "/api/v1/admin/content-commands"; request: B9ContentCommandRequest; response: B9ContentCommandAcceptedResponse; idempotent: true };
  getB9AdminContentState: { method: "GET"; path: "/api/v1/admin/content-commands/{contentCode}"; request: never; response: B9AdminContentStateResponse; idempotent: false };
  getB9InternalPublicProjection: { method: "GET"; path: "/internal/v1/content/public-projections/{projectionKey}"; request: never; response: B9InternalPublicProjectionResponse; idempotent: false };
  getB9AssessmentContentSnapshot: { method: "GET"; path: "/internal/v1/content/versions/{contentVersionId}/assessment-snapshot"; request: never; response: B9AssessmentContentSnapshotResponse; idempotent: false };
  getB9LearnerProfile: { method: "GET"; path: "/api/v1/learner/profile"; request: never; response: B9LearnerProfileResponse; idempotent: false };
  patchB9LearnerProfile: { method: "PATCH"; path: "/api/v1/learner/profile"; request: B9LearnerProfilePatch; response: B9LearnerProfileResponse; idempotent: true };
  getB9LearnerTarget: { method: "GET"; path: "/api/v1/learner/targets"; request: never; response: B9LearnerTargetResponse; idempotent: false };
  putB9LearnerTarget: { method: "PUT"; path: "/api/v1/learner/targets"; request: B9LearnerTargetUpsert; response: B9LearnerTargetResponse; idempotent: true };
  getB9LearnerPreferences: { method: "GET"; path: "/api/v1/learner/preferences"; request: never; response: B9LearnerPreferencesResponse; idempotent: false };
  patchB9LearnerPreferences: { method: "PATCH"; path: "/api/v1/learner/preferences"; request: B9LearnerPreferencesPatch; response: B9LearnerPreferencesResponse; idempotent: true };
  getB9FirstDayProjection: { method: "GET"; path: "/api/v1/learner/first-day"; request: never; response: B9FirstDayProjectionResponse; idempotent: false };
  getB9LearnerHomeProjection: { method: "GET"; path: "/api/v1/learner/home"; request: never; response: B9HomeProjectionResponse; idempotent: false };
  getB9LegacyLearnerProfileShadow: { method: "GET"; path: "/internal/v1/learner/shadow-profile/{principalId}"; request: never; response: B9LegacyShadowProfileResponse; idempotent: false };
  getB10CompatibilityReadShadow: { method: "GET"; path: "/internal/v1/compatibility/b10/read-shadow"; request: never; response: B10ReadShadowResponse; idempotent: false };
  createB10CompatibilityReconciliation: { method: "POST"; path: "/internal/v1/compatibility/b10/reconciliations"; request: B10ReconciliationRequest; response: B10ReadShadowResponse; idempotent: true };
  createB10CompatibilityRouteDecision: { method: "POST"; path: "/internal/v1/compatibility/b10/route-decisions"; request: B10RouteDecisionRequest; response: B10RouteDecisionResponse; idempotent: true };
  createB10CompatibilityRollback: { method: "POST"; path: "/internal/v1/compatibility/b10/rollbacks"; request: B10RollbackRequest; response: B10RouteDecisionResponse; idempotent: true };
  getB10LearnerContentSnapshot: { method: "GET"; path: "/api/v1/learning/content-snapshots/{contentVersionId}"; request: never; response: B10LearnerContentSnapshotResponse; idempotent: false };
  getB10AssessmentContentSnapshot: { method: "GET"; path: "/internal/v1/content/assessment-snapshots/{contentVersionId}"; request: never; response: B10AssessmentContentSnapshotResponse; idempotent: false };
  resolveB10ContentSnapshotRecovery: { method: "GET"; path: "/internal/v1/content/assessment-snapshots/{contentVersionId}/recovery"; request: never; response: B10ContentRecoveryResponse; idempotent: false };
  submitB10AssessmentAttempt: { method: "POST"; path: "/api/v1/assessment/sessions/{sessionId}/attempts"; request: B10SubmitAttemptRequest; response: B10AttemptResponse; idempotent: true };
  putB10AssessmentCheckpoint: { method: "PUT"; path: "/api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint"; request: B10CheckpointRequest; response: B10CheckpointResponse; idempotent: true };
  getB10AssessmentReport: { method: "GET"; path: "/api/v1/assessment/reports/{reportId}"; request: never; response: B10AssessmentReportResponse; idempotent: false };
  listB10LearningReviewQueue: { method: "GET"; path: "/api/v1/learning/review-queue"; request: never; response: B10ReviewQueueResponse; idempotent: false };
  completeB10LearningReview: { method: "POST"; path: "/api/v1/learning/review-queue/{queueItemId}/complete"; request: B10CompleteReviewRequest; response: B10MasteryProjectionResponse; idempotent: true };
  getB10LearningMasteryProjection: { method: "GET"; path: "/api/v1/learning/mastery/{itemId}"; request: never; response: B10MasteryProjectionResponse; idempotent: false };
  getB11MediaAsset: { method: "GET"; path: "/api/v1/media/assets/{assetId}"; request: never; response: B11MediaAsset; idempotent: false };
  getB11MediaManifest: { method: "GET"; path: "/api/v1/media/assets/{assetId}/manifest"; request: never; response: B11MediaManifest; idempotent: false };
  createB11MediaAccess: { method: "POST"; path: "/api/v1/media/assets/{assetId}/access"; request: B11MediaAccessRequest; response: B11SignedMediaUrl; idempotent: true };
  streamB11MediaContent: { method: "GET"; path: "/api/v1/media/assets/{assetId}/content"; request: never; response: B11MediaContentRange; idempotent: false };
  revokeB11MediaAsset: { method: "POST"; path: "/internal/v1/media/assets/{assetId}/revoke"; request: B11MediaRevocation; response: unknown; idempotent: true };
  getB11MediaCompatibility: { method: "GET"; path: "/internal/v1/compatibility/b11/media-assets/{assetId}"; request: never; response: B11MediaCompatibility; idempotent: false };
  createB11MediaReconciliation: { method: "POST"; path: "/internal/v1/compatibility/b11/media-assets/reconciliations"; request: B11MediaCompatibility; response: unknown; idempotent: true };
  createB11MediaMigration: { method: "POST"; path: "/internal/v1/compatibility/b11/media-assets/{assetId}/migrations"; request: B11MediaMigration; response: unknown; idempotent: true };
  getB11NotificationPreference: { method: "GET"; path: "/api/v1/settings/notifications"; request: never; response: B11NotificationPreference; idempotent: false };
  updateB11NotificationPreference: { method: "PUT"; path: "/api/v1/settings/notifications"; request: B11NotificationPreference; response: B11NotificationPreference; idempotent: true };
  listB11Messages: { method: "GET"; path: "/api/v1/messages"; request: never; response: B11MessagePage; idempotent: false };
  markB11MessageRead: { method: "POST"; path: "/api/v1/messages/{messageId}/read"; request: never; response: unknown; idempotent: true };
  getB11SyncCursor: { method: "GET"; path: "/api/v1/sync/cursor"; request: never; response: B11VectorClock; idempotent: false };
  updateB11SyncCursor: { method: "PUT"; path: "/api/v1/sync/cursor"; request: B11VectorClock; response: B11VectorClock; idempotent: true };
  listB11SyncConflicts: { method: "GET"; path: "/api/v1/sync/conflicts"; request: never; response: B11SyncConflictPage; idempotent: false };
  recoverB11SyncConflict: { method: "POST"; path: "/api/v1/sync/conflicts/{conflictId}/recovery"; request: B11SyncRecovery; response: unknown; idempotent: true };
  createB11OfflineCompatibility: { method: "POST"; path: "/internal/v1/compatibility/b11/offline"; request: B11OfflineCompatibility; response: unknown; idempotent: true };
  createB11Recording: { method: "POST"; path: "/api/v1/multimodal/recordings"; request: B11RecordingMetadata; response: B11RecordingMetadata; idempotent: true };
  getB12GamificationSummary: { method: "GET"; path: "/api/v1/gamification/me/summary"; request: never; response: B12GrowthSummary; idempotent: false };
  listB12GamificationLedger: { method: "GET"; path: "/api/v1/gamification/me/ledger"; request: never; response: B12LedgerPage; idempotent: false };
  listB12RewardGrants: { method: "GET"; path: "/api/v1/gamification/me/rewards"; request: never; response: B12RewardPage; idempotent: false };
  getB12RewardProbability: { method: "GET"; path: "/api/v1/gamification/me/rewards/{grantId}/probability"; request: never; response: B12RewardProbability; idempotent: false };
  claimB12Reward: { method: "POST"; path: "/api/v1/gamification/me/rewards/{grantId}/claim"; request: B12RewardClaimRequest; response: B12RewardClaimResult; idempotent: true };
  consumeB12TrustedCompletion: { method: "POST"; path: "/internal/v1/gamification/trusted-events/completions"; request: B12TrustedCompletion; response: B12SettlementResult; idempotent: true };
  disconnectB12StudyRoom: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/disconnect"; request: B12RoomCommand; response: B12RoomState; idempotent: true };
  recoverB12StudyRoomSeat: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/recover"; request: B12RoomCommand; response: B12RoomState; idempotent: true };
  renewB12StudyRoomLease: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/lease/renew"; request: B12RoomCommand; response: B12RoomState; idempotent: true };
  startB12RoomFocus: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/focus"; request: B12FocusCommand; response: B12FocusSession; idempotent: true };
  updateB12SocialVisibility: { method: "PATCH"; path: "/api/v1/social/me/visibility"; request: B12VisibilityCommand; response: B12Visibility; idempotent: true };
  createB12SocialReport: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/reports"; request: B12ReportCommand; response: B12Report; idempotent: true };
  getB12SocialReport: { method: "GET"; path: "/api/v1/social/reports/{reportId}"; request: never; response: B12Report; idempotent: false };
  consumeB12SocialTrustedEvent: { method: "POST"; path: "/internal/v1/social/trusted-events"; request: B12TrustedSocialEvent; response: B12EventReceipt; idempotent: true };
  consumeB12NotificationTrustedEvent: { method: "POST"; path: "/internal/v1/notifications/trusted-events"; request: B12NotificationTrustedEvent; response: B12EventReceipt; idempotent: true };
  dispatchB12NotificationRetry: { method: "POST"; path: "/internal/v1/notifications/retry"; request: B12RetryCommand; response: B12RetryResult; idempotent: true };
  recoverB12NotificationTask: { method: "POST"; path: "/internal/v1/notifications/recovery"; request: B12RecoveryCommand; response: B12RecoveryResult; idempotent: true };
  listB12ModerationReports: { method: "GET"; path: "/api/v1/admin/moderation/reports"; request: never; response: B12ReportPage; idempotent: false };
  executeB12ModerationCommand: { method: "POST"; path: "/api/v1/admin/moderation/reports/{reportId}/commands"; request: B12ModerationCommand; response: B12Report; idempotent: true };
  listB12RecoveryTasks: { method: "GET"; path: "/api/v1/admin/recovery/tasks"; request: never; response: B12RecoveryPage; idempotent: false };
  executeB12RecoveryCommand: { method: "POST"; path: "/api/v1/admin/recovery/tasks/{taskId}/commands"; request: B12RecoveryCommand; response: B12RecoveryResult; idempotent: true };
  listB12NotificationPreferences: { method: "GET"; path: "/api/v1/notifications/preferences"; request: never; response: ReadonlyArray<B12NotificationPreference>; idempotent: false };
  updateB12NotificationPreference: { method: "PUT"; path: "/api/v1/notifications/preferences/{notificationType}/{channel}"; request: B12NotificationPreferenceCommand; response: B12NotificationPreference; idempotent: true };
  listB12Notifications: { method: "GET"; path: "/api/v1/notifications/messages"; request: never; response: ReadonlyArray<B12NotificationMessage>; idempotent: false };
}

export type ApiOperationId = keyof ApiOperationRegistry;
