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
  return listData<GrammarPoint>(await mobileApiClient.request('/grammar/points?limit=20'))
}

export async function getSentenceGraph(sentenceId: number): Promise<SentenceGraph> {
  return unwrap(await mobileApiClient.request(`/grammar/sentences/${sentenceId}`)) as SentenceGraph
}

export async function listGrammarExercises(): Promise<Array<Record<string, unknown>>> { return listData<Record<string, unknown>>(await mobileApiClient.request('/grammar/exercises?limit=20')) }
export async function submitGrammarAttempt(exerciseId: number, answer: Record<string, unknown>): Promise<Record<string, unknown>> { return unwrap(await mobileApiClient.request('/grammar/practice/attempts', { method: 'POST', data: { exerciseId, answer, clientAnswerId: `b3-mobile-answer-${Date.now()}`, contentVersionId: 301 }, ...withKey(`b3-mobile-answer-${exerciseId}-${Date.now()}`) })) as Record<string, unknown> }
export async function submitSentenceBlocks(sentenceId: number, blockOrder: string[]): Promise<Record<string, unknown>> { return unwrap(await mobileApiClient.request(`/grammar/sentences/${sentenceId}/blocks`, { method: 'POST', data: { blockOrder, contentVersionId: 301, clientEventId: `b3-mobile-blocks-${Date.now()}` }, ...withKey(`b3-mobile-blocks-${sentenceId}-${Date.now()}`) })) as Record<string, unknown> }
export async function submitSentenceImitation(sentenceId: number, slotValues: Record<string, string>): Promise<Record<string, unknown>> { return unwrap(await mobileApiClient.request(`/grammar/sentences/${sentenceId}/imitation`, { method: 'POST', data: { slotValues, contentVersionId: 301, clientEventId: `b3-mobile-imitation-${Date.now()}` }, ...withKey(`b3-mobile-imitation-${sentenceId}-${Date.now()}`) })) as Record<string, unknown> }

export async function listWritingPrompts(): Promise<WritingPrompt[]> {
  return listData<WritingPrompt>(await mobileApiClient.request('/writing/prompts?limit=20'))
}

export async function submitWriting(promptId: number, answer: string): Promise<WritingEvaluation> {
  return unwrap(await mobileApiClient.request('/writing/submissions', {
    method: 'POST',
    data: { promptId, answer, clientSubmissionId: `b3-mobile-writing-${Date.now()}`, contentVersionId: 301, mode: 'TRANSLATION' },
    ...withKey(`b3-mobile-writing-${promptId}-${Date.now()}`),
  })) as WritingEvaluation
}
export async function submitCorrection(promptId: number, answer: string): Promise<Record<string, unknown>> { return unwrap(await mobileApiClient.request('/writing/corrections', { method: 'POST', data: { promptId, answer, contentVersionId: 301, clientSubmissionId: `b3-mobile-correction-${Date.now()}` }, ...withKey(`b3-mobile-correction-${promptId}-${Date.now()}`) })) as Record<string, unknown> }

export async function listListeningMaterials(): Promise<ListeningMaterial[]> {
  return listData<ListeningMaterial>(await mobileApiClient.request('/listening/materials?limit=20'))
}

export async function createListeningSession(materialId: number, clientEventId = `b3-mobile-listen-${materialId}-${Date.now()}`): Promise<string | null> {
  const source = unwrap(await mobileApiClient.request<unknown>('/listening/sessions', {
    method: 'POST',
    data: { materialId, contentVersionId: 301, mode: 'LISTEN', clientEventId },
    ...withKey(clientEventId),
  }))
  return isRecord(source) ? text(source.sessionId) ?? text(source.id) : null
}

export async function submitDictation(sessionId: string, segmentId: string, answer: string, clientEventId = `b3-mobile-dictation-${Date.now()}`): Promise<DictationResult> {
  return unwrap(await mobileApiClient.request(`/listening/sessions/${encodeURIComponent(sessionId)}/dictation`, {
    method: 'POST',
    data: { segmentId, mode: 'SENTENCE', answer, attemptNo: 1, clientEventId, contentVersionId: 301 },
    ...withKey(clientEventId),
  })) as DictationResult
}

export async function listReadingArticles(): Promise<ReadingArticle[]> {
  return listData<ReadingArticle>(await mobileApiClient.request('/reading/articles?limit=20'))
}

export async function getReadingArticle(articleId: number): Promise<ReadingArticle> {
  return unwrap(await mobileApiClient.request(`/reading/articles/${articleId}`)) as ReadingArticle
}

export async function saveReadingProgress(articleId: number, blockId: string, progressPercent: number, positionVersion: number, clientEventId = `b3-mobile-reading-${articleId}-${positionVersion}`): Promise<void> {
  await mobileApiClient.request('/reading/progress', {
    method: 'PUT',
    data: { articleId, blockId, progressPercent, positionVersion, contentVersionId: 301, clientEventId },
    ...withKey(clientEventId),
  })
}
export async function listReadingQuestions(articleId?: number): Promise<ReadingQuestion[]> { const suffix = articleId ? `&articleId=${articleId}` : ''; return listData<ReadingQuestion>(await mobileApiClient.request(`/reading/questions?limit=20${suffix}`)) }
export async function submitReadingAttempt(questionId: number, answer: string, clientEventId = `b3-mobile-reading-attempt-${Date.now()}`): Promise<ReadingAttemptResult> { return unwrap(await mobileApiClient.request('/reading/attempts', { method: 'POST', data: { questionId, answer, contentVersionId: 301, clientEventId }, ...withKey(clientEventId) })) as ReadingAttemptResult }
export async function createReadingMining(articleId: number, blockId: string): Promise<ReadingMiningResult> { return unwrap(await mobileApiClient.request('/reading/mining', { method: 'POST', data: { articleId, blockId, contentVersionId: 301, clientEventId: `b3-mobile-mining-${Date.now()}` }, ...withKey(`b3-mobile-mining-${articleId}-${blockId}-${Date.now()}`) })) as ReadingMiningResult }

export async function getPhonetics(): Promise<Phoneme[]> {
  return listData<Phoneme>(await mobileApiClient.request('/phonetics/catalog?setCode=EN_48_PHASE1'))
}

export async function createRecording(sourceSegmentId: string, durationMs: number, contentHash: string, clientEventId = `b3-mobile-recording-${Date.now()}`): Promise<SpeakingRecording> { return unwrap(await mobileApiClient.request('/speaking/recordings', { method: 'POST', data: { sourceSegmentId, durationMs, contentHash, storageMode: 'LOCAL_ENCRYPTED', clientEventId }, ...withKey(clientEventId) })) as SpeakingRecording }
export async function deleteRecording(recordingId: string, clientEventId = `b3-mobile-recording-delete-${recordingId}-${Date.now()}`): Promise<void> { await mobileApiClient.request(`/speaking/recordings/${encodeURIComponent(recordingId)}`, { method: 'DELETE', ...withKey(clientEventId) }) }
export async function submitSelfRating(recordingId: string, rating: string, clientEventId = `b3-mobile-rating-${Date.now()}`): Promise<void> { await mobileApiClient.request(`/speaking/recordings/${encodeURIComponent(recordingId)}/self-rating`, { method: 'POST', data: { rating, clientEventId }, ...withKey(clientEventId) }) }
export async function createRoleplaySession(roleplayCode = 'COFFEE_SHOP_V1'): Promise<RoleplaySession> { return unwrap(await mobileApiClient.request('/speaking/roleplay/sessions', { method: 'POST', data: { roleplayCode, contentVersionId: 301, clientEventId: `b3-mobile-roleplay-${Date.now()}` }, ...withKey(`b3-mobile-roleplay-${roleplayCode}-${Date.now()}`) })) as RoleplaySession }
export async function submitRoleplayTurn(sessionId: string, turnIndex: number, recordingId: string, choiceCode?: string): Promise<RoleplayTurnResult> { return unwrap(await mobileApiClient.request(`/speaking/roleplay/sessions/${encodeURIComponent(sessionId)}/turns`, { method: 'POST', data: { turnIndex, recordingId, ...(choiceCode ? { choiceCode } : {}), clientEventId: `b3-mobile-roleplay-turn-${Date.now()}` }, ...withKey(`b3-mobile-roleplay-turn-${sessionId}-${turnIndex}-${Date.now()}`) })) as RoleplayTurnResult }

export async function pushOfflineChanges(changes: OfflineChange[], baseCursor: string): Promise<B3SyncResult> { return unwrap(await mobileApiClient.request('/offline/sync/push', { method: 'POST', data: { deviceId: 'mobile-b3', clientBatchId: `b3-mobile-sync-${Date.now()}`, baseCursor, changes }, ...withKey(`b3-mobile-sync-${Date.now()}`) })) as B3SyncResult }
export async function pullOfflineChanges(cursor: string): Promise<{ cursor: string; changes: OfflineChange[] }> { const source = unwrap(await mobileApiClient.request(`/offline/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=100`)); return isRecord(source) && typeof source.cursor === 'string' && Array.isArray(source.changes) ? { cursor: source.cursor, changes: source.changes as OfflineChange[] } : { cursor, changes: [] } }

export function isB3OfflineError(error: unknown): boolean {
  return error instanceof MobileApiError && (error.status === 0 || error.status >= 500)
}
