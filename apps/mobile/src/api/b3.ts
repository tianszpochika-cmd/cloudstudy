import { unavailableOperation } from './unavailable'
import { mobileApiClient, MobileApiError } from './client'
import type { B3SyncResult, DictationResult, GrammarPoint, ListeningMaterial, OfflineChange, Phoneme, ReadingArticle, ReadingAttemptResult, ReadingMiningResult, ReadingQuestion, RoleplaySession, RoleplayTurnResult, SentenceGraph, SpeakingRecording, WritingEvaluation, WritingPrompt } from '../domain/b3'
import { isRecord, text, unwrap } from '../domain/b3'

function withKey(key: string): { header: Record<string, string> } {
  return { header: { 'Idempotency-Key': key } }
}

function listData<T>(value: unknown): T[] {
  const source = unwrap(value)
  return isRecord(source) && Array.isArray(source.items) ? source.items as T[] : []
}

export async function listGrammarPoints(): Promise<GrammarPoint[]> {
  return listData<GrammarPoint>(await mobileApiClient.request('/grammar/points?pageSize=20'))
}

export async function getSentenceGraph(sentenceId: number): Promise<SentenceGraph> {
  return unwrap(await unavailableOperation()) as SentenceGraph
}

export async function listGrammarExercises(): Promise<Array<Record<string, unknown>>> { return listData<Record<string, unknown>>(await mobileApiClient.request('/grammar/exercises?limit=20')) }
export async function submitGrammarAttempt(exerciseId: number, answer: Record<string, unknown>): Promise<Record<string, unknown>> { return unwrap(await unavailableOperation()) as Record<string, unknown> }
export async function submitSentenceBlocks(sentenceId: number, blockOrder: string[]): Promise<Record<string, unknown>> { return unwrap(await unavailableOperation()) as Record<string, unknown> }
export async function submitSentenceImitation(sentenceId: number, slotValues: Record<string, string>): Promise<Record<string, unknown>> { return unwrap(await unavailableOperation()) as Record<string, unknown> }

export async function listWritingPrompts(): Promise<WritingPrompt[]> {
  return listData<WritingPrompt>(await mobileApiClient.request('/writing/prompts?limit=20'))
}

export async function submitWriting(promptId: number, answer: string): Promise<WritingEvaluation> {
  return unwrap(await unavailableOperation()) as WritingEvaluation
}
export async function submitCorrection(promptId: number, answer: string): Promise<Record<string, unknown>> { return unwrap(await unavailableOperation()) as Record<string, unknown> }

export async function listListeningMaterials(): Promise<ListeningMaterial[]> {
  return listData<ListeningMaterial>(await mobileApiClient.request('/listening/materials?limit=20'))
}

export async function createListeningSession(materialId: number, clientEventId = `b3-mobile-listen-${materialId}-${Date.now()}`): Promise<string | null> {
  const source = unwrap(await unavailableOperation<unknown>())
  return isRecord(source) ? text(source.sessionId) ?? text(source.id) : null
}

export async function submitDictation(sessionId: string, segmentId: string, answer: string, clientEventId = `b3-mobile-dictation-${Date.now()}`): Promise<DictationResult> {
  return unwrap(await unavailableOperation()) as DictationResult
}

export async function listReadingArticles(): Promise<ReadingArticle[]> {
  return listData<ReadingArticle>(await mobileApiClient.request('/reading/articles?limit=20'))
}

export async function getReadingArticle(articleId: number): Promise<ReadingArticle> {
  return unwrap(await mobileApiClient.request(`/reading/articles/${articleId}`)) as ReadingArticle
}

export async function saveReadingProgress(articleId: number, blockId: string, progressPercent: number, positionVersion: number, clientEventId = `b3-mobile-reading-${articleId}-${positionVersion}`): Promise<void> {
  await unavailableOperation()
}
export async function listReadingQuestions(articleId?: number): Promise<ReadingQuestion[]> { const suffix = articleId ? `&articleId=${articleId}` : ''; return listData<ReadingQuestion>(await mobileApiClient.request(`/reading/questions?limit=20${suffix}`)) }
export async function submitReadingAttempt(questionId: number, answer: string, clientEventId = `b3-mobile-reading-attempt-${Date.now()}`): Promise<ReadingAttemptResult> { return unwrap(await unavailableOperation()) as ReadingAttemptResult }
export async function createReadingMining(articleId: number, blockId: string): Promise<ReadingMiningResult> { return unwrap(await unavailableOperation()) as ReadingMiningResult }

export async function getPhonetics(): Promise<Phoneme[]> {
  return listData<Phoneme>(await unavailableOperation())
}

export async function createRecording(sourceSegmentId: string, durationMs: number, contentHash: string, clientEventId = `b3-mobile-recording-${Date.now()}`): Promise<SpeakingRecording> { return unwrap(await unavailableOperation()) as SpeakingRecording }
export async function deleteRecording(recordingId: string, clientEventId = `b3-mobile-recording-delete-${recordingId}-${Date.now()}`): Promise<void> { await unavailableOperation() }
export async function submitSelfRating(recordingId: string, rating: string, clientEventId = `b3-mobile-rating-${Date.now()}`): Promise<void> { await unavailableOperation() }
export async function createRoleplaySession(roleplayCode = 'COFFEE_SHOP_V1'): Promise<RoleplaySession> { return unwrap(await unavailableOperation()) as RoleplaySession }
export async function submitRoleplayTurn(sessionId: string, turnIndex: number, recordingId: string, choiceCode?: string): Promise<RoleplayTurnResult> { return unwrap(await unavailableOperation()) as RoleplayTurnResult }

export async function pushOfflineChanges(changes: OfflineChange[], baseCursor: string): Promise<B3SyncResult> { return unwrap(await mobileApiClient.request('/offline/sync/push', { method: 'POST', data: { deviceId: 'mobile-b3', clientBatchId: `b3-mobile-sync-${Date.now()}`, baseCursor, changes }, ...withKey(`b3-mobile-sync-${Date.now()}`) })) as B3SyncResult }
export async function pullOfflineChanges(cursor: string): Promise<{ cursor: string; changes: OfflineChange[] }> { const source = unwrap(await mobileApiClient.request(`/offline/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=100`)); return isRecord(source) && typeof source.cursor === 'string' && Array.isArray(source.changes) ? { cursor: source.cursor, changes: source.changes as OfflineChange[] } : { cursor, changes: [] } }

export function isB3OfflineError(error: unknown): boolean {
  return error instanceof MobileApiError && (error.status === 0 || error.status >= 500)
}
