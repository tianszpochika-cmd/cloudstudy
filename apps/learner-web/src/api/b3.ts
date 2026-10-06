import { unavailableOperation } from './unavailable'
import { apiClient, ApiError } from './client'
import type { B3SyncResult, DictionaryEntry, DictationResult, GrammarExercise, GrammarPoint, GrammarMastery, LanguageClip, ListeningMaterial, MinimalPair, OfflineChange, OfflinePackage, Phoneme, ProofreadingIssue, ReadingArticle, ReadingAttemptResult, ReadingMiningResult, ReadingQuestion, RoleplaySession, RoleplayTurnResult, SentenceGraph, ShadowingSession, SpeakingRecording, WritingEvaluation, WritingHistoryItem, WritingMaterial, WritingPrompt, WritingTemplate } from '../domain/b3'
import { isRecord, unwrap } from '../domain/b3'

function withKey(key: string): { headers: Record<string, string> } { return { headers: { 'Idempotency-Key': key } } }
function listData<T>(value: unknown): T[] { const source = unwrap(value); return isRecord(source) && Array.isArray(source.items) ? source.items as T[] : [] }

export async function listGrammarPoints(): Promise<GrammarPoint[]> { return listData<GrammarPoint>(await apiClient.get('/grammar/points?pageSize=20')) }
export async function getSentenceGraph(sentenceId: number): Promise<SentenceGraph> { return unwrap(await unavailableOperation()) as SentenceGraph }
export async function listGrammarExercises(grammarPointId?: number): Promise<GrammarExercise[]> { const suffix = grammarPointId ? `&grammarPointId=${grammarPointId}` : ''; return listData<GrammarExercise>(await apiClient.get(`/grammar/exercises?limit=20${suffix}`)) }
export async function submitGrammarAttempt(exerciseId: number, answer: Record<string, unknown>): Promise<Record<string, unknown>> { const stableKey = `b3-answer-${exerciseId}-${Date.now()}`; return unwrap(await unavailableOperation()) as Record<string, unknown> }
export async function getGrammarMastery(grammarPointId?: number): Promise<GrammarMastery[]> { const suffix = grammarPointId ? `?grammarPointId=${grammarPointId}` : ''; return listData<GrammarMastery>(await unavailableOperation()) }
export async function getSentenceXray(sentenceId: number): Promise<Record<string, unknown>> { return unwrap(await unavailableOperation()) as Record<string, unknown> }
export async function submitSentenceBlocks(sentenceId: number, blockOrder: string[]): Promise<Record<string, unknown>> { const stableKey = `b3-blocks-${sentenceId}-${Date.now()}`; return unwrap(await unavailableOperation()) as Record<string, unknown> }
export async function submitSentenceImitation(sentenceId: number, slotValues: Record<string, string>): Promise<Record<string, unknown>> { const stableKey = `b3-imitation-${sentenceId}-${Date.now()}`; return unwrap(await unavailableOperation()) as Record<string, unknown> }
export async function listWritingPrompts(): Promise<WritingPrompt[]> { return listData<WritingPrompt>(await apiClient.get('/writing/prompts?limit=20')) }
export async function listWritingTemplates(): Promise<WritingTemplate[]> { return listData<WritingTemplate>(await unavailableOperation()) }
export async function listWritingMaterials(): Promise<WritingMaterial[]> { return listData<WritingMaterial>(await unavailableOperation()) }
export async function listProofreadingExercises(): Promise<ProofreadingIssue[]> { return listData<ProofreadingIssue>(await unavailableOperation()) }
export async function submitWriting(promptId: number, answer: string): Promise<WritingEvaluation> { const stableKey = `b3-writing-${promptId}-${Date.now()}`; return unwrap(await unavailableOperation()) as WritingEvaluation }
export async function listWritingHistory(): Promise<WritingHistoryItem[]> { return listData<WritingHistoryItem>(await unavailableOperation()) }
export async function submitCorrection(promptId: number, answer: string): Promise<Record<string, unknown>> { const stableKey = `b3-correction-${promptId}-${Date.now()}`; return unwrap(await unavailableOperation()) as Record<string, unknown> }
export async function listListeningMaterials(): Promise<ListeningMaterial[]> { return listData<ListeningMaterial>(await apiClient.get('/listening/materials?limit=20')) }
export async function createListeningSession(materialId: number): Promise<Record<string, unknown>> { const stableKey = `b3-listen-session-${materialId}-${Date.now()}`; return unwrap(await unavailableOperation()) as Record<string, unknown> }
export async function listLanguageClips(materialId?: number): Promise<LanguageClip[]> { const suffix = materialId ? `&materialId=${materialId}` : ''; return listData<LanguageClip>(await unavailableOperation()) }
export async function submitDictation(sessionId: string, segmentId: string, answer: string): Promise<DictationResult> { const stableKey = `b3-dictation-${sessionId}-${segmentId}-${Date.now()}`; return unwrap(await unavailableOperation()) as DictationResult }
export async function updateListeningProgress(sessionId: string, mediaPositionMs: number, positionVersion: number, playbackRate: number, subtitleMode: string): Promise<void> { const stableKey = `b3-listening-progress-${sessionId}-${positionVersion}`; await unavailableOperation() }
export async function listOfflinePackages(): Promise<OfflinePackage[]> { return listData<OfflinePackage>(await unavailableOperation()) }
export async function createOfflinePackage(materialIds: number[], deviceId: string): Promise<OfflinePackage> { const stableKey = `b3-offline-package-${deviceId}-${Date.now()}`; return unwrap(await unavailableOperation()) as OfflinePackage }
export async function listReadingArticles(): Promise<ReadingArticle[]> { return listData<ReadingArticle>(await apiClient.get('/reading/articles?limit=20')) }
export async function getReadingArticle(articleId: number): Promise<ReadingArticle> { return unwrap(await apiClient.get(`/reading/articles/${articleId}`)) as ReadingArticle }
export async function getDictionaryEntry(articleId: number, tokenId: string): Promise<DictionaryEntry> { return unwrap(await apiClient.get(`/reading/articles/${articleId}/dictionary?tokenId=${encodeURIComponent(tokenId)}`)) as DictionaryEntry }
export async function listReadingQuestions(articleId?: number): Promise<ReadingQuestion[]> { const suffix = articleId ? `&articleId=${articleId}` : ''; return listData<ReadingQuestion>(await apiClient.get(`/reading/questions?limit=20${suffix}`)) }
export async function submitReadingAttempt(questionId: number, answer: string): Promise<ReadingAttemptResult> { const stableKey = `b3-reading-attempt-${questionId}-${Date.now()}`; return unwrap(await unavailableOperation()) as ReadingAttemptResult }
export async function createReadingMining(articleId: number, blockId: string): Promise<ReadingMiningResult> { const stableKey = `b3-mining-${articleId}-${blockId}-${Date.now()}`; return unwrap(await unavailableOperation()) as ReadingMiningResult }
export async function saveReadingProgress(articleId: number, blockId: string, progressPercent: number, positionVersion: number): Promise<void> { const stableKey = `b3-reading-${articleId}-${positionVersion}`; await unavailableOperation() }
export async function getPhonetics(): Promise<Phoneme[]> { const source = unwrap(await unavailableOperation()); return isRecord(source) && Array.isArray(source.items) ? source.items as Phoneme[] : [] }
export async function listMinimalPairs(): Promise<MinimalPair[]> { return listData<MinimalPair>(await unavailableOperation()) }
export async function createRecording(sourceSegmentId: string, durationMs: number, contentHash: string): Promise<SpeakingRecording> { const stableKey = `b3-recording-${sourceSegmentId}-${Date.now()}`; return unwrap(await unavailableOperation()) as SpeakingRecording }
export async function deleteRecording(recordingId: string): Promise<void> { await unavailableOperation() }
export async function submitSelfRating(recordingId: string, rating: string): Promise<void> { const stableKey = `b3-rating-${recordingId}-${Date.now()}`; await unavailableOperation() }
export async function createShadowingSession(sourceSegmentId: string): Promise<ShadowingSession> { const stableKey = `b3-shadowing-${sourceSegmentId}-${Date.now()}`; return unwrap(await unavailableOperation()) as ShadowingSession }
export async function updateShadowingProgress(sessionId: string, positionMs: number, attemptNo: number): Promise<void> { const stableKey = `b3-shadowing-progress-${sessionId}-${attemptNo}`; await unavailableOperation() }
export async function createRoleplaySession(roleplayCode = 'COFFEE_SHOP_V1'): Promise<RoleplaySession> { const stableKey = `b3-roleplay-${roleplayCode}-${Date.now()}`; return unwrap(await unavailableOperation()) as RoleplaySession }
export async function submitRoleplayTurn(sessionId: string, turnIndex: number, recordingId: string, choiceCode?: string): Promise<RoleplayTurnResult> { const stableKey = `b3-roleplay-turn-${sessionId}-${turnIndex}-${Date.now()}`; return unwrap(await unavailableOperation()) as RoleplayTurnResult }
export async function pushOfflineChanges(changes: OfflineChange[], baseCursor = '0'): Promise<B3SyncResult> { const stableKey = `b3-sync-${Date.now()}`; return unwrap(await apiClient.post('/offline/sync/push', { deviceId: 'web-b3', clientBatchId: stableKey, baseCursor, changes }, withKey(stableKey))) as B3SyncResult }
export async function pullOfflineChanges(cursor: string): Promise<{ cursor: string; changes: OfflineChange[] }> { const source = unwrap(await apiClient.get(`/offline/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=100`)); return isRecord(source) && typeof source.cursor === 'string' && Array.isArray(source.changes) ? { cursor: source.cursor, changes: source.changes as OfflineChange[] } : { cursor, changes: [] } }
export function isB3OfflineError(error: unknown): boolean { return error instanceof TypeError || error instanceof ApiError && (error.status === 0 || error.status >= 500) }
