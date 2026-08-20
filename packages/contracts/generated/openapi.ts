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
export type B4FocusRequest = { action?: "PAUSE" | "RESUME" | "COMPLETE" | "AUTO_RELEASE" | "HEARTBEAT"; };

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
  getB2DailyStream: { method: "GET"; path: "/api/v1/assessment/daily-stream"; request: never; response: unknown; idempotent: false };
  createB2AssessmentSession: { method: "POST"; path: "/api/v1/assessment/sessions"; request: B2CreateAssessmentSessionRequest; response: unknown; idempotent: true };
  getB2AssessmentSession: { method: "GET"; path: "/api/v1/assessment/sessions/{sessionId}"; request: never; response: unknown; idempotent: false };
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
  sendB4PresetInteraction: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/interactions"; request: B4InteractionRequest; response: unknown; idempotent: true };
  getB4SocialLeaderboard: { method: "GET"; path: "/api/v1/social/leaderboards"; request: never; response: unknown; idempotent: false };
  createB4SocialWsTicket: { method: "POST"; path: "/api/v1/social/ws-ticket"; request: B4WsTicketRequest; response: unknown; idempotent: true };
  listB4OfflinePackages: { method: "GET"; path: "/api/v1/sync/offline-packages"; request: never; response: unknown; idempotent: false };
  authorizeB4OfflinePackage: { method: "POST"; path: "/api/v1/sync/offline-packages/{packageId}/authorize"; request: never; response: unknown; idempotent: true };
  listB4SyncChanges: { method: "GET"; path: "/api/v1/sync/changes"; request: never; response: unknown; idempotent: false };
  pushB4SyncEvents: { method: "POST"; path: "/api/v1/sync/events"; request: B4SyncRequest; response: unknown; idempotent: true };
  saveB4SyncCheckpoint: { method: "PUT"; path: "/api/v1/sync/checkpoints/{entityId}"; request: B4CheckpointRequest; response: unknown; idempotent: true };
  createB4ModerationReport: { method: "POST"; path: "/api/v1/social/moderation/reports"; request: B4ReportRequest; response: unknown; idempotent: true };
  createB4Block: { method: "POST"; path: "/api/v1/social/moderation/blocks"; request: B4BlockRequest; response: unknown; idempotent: true };
  createB4RoomMute: { method: "POST"; path: "/api/v1/social/rooms/{roomId}/mutes"; request: B4MuteRequest; response: unknown; idempotent: true };
}

export type ApiOperationId = keyof ApiOperationRegistry;
