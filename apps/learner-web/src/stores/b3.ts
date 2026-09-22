import { experiencePerformance } from '../platform/experience-ui'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { type PerformanceLevel } from '@englishflow/performance'
import { createListeningSession, getPhonetics, getReadingArticle, getSentenceGraph, isB3OfflineError, listGrammarExercises, listGrammarPoints, listListeningMaterials, listReadingArticles, listWritingPrompts, pullOfflineChanges, pushOfflineChanges, saveReadingProgress, submitDictation, submitGrammarAttempt, submitSelfRating, submitWriting } from '../api/b3'
import type { B3Status, DictationResult, GrammarExercise, GrammarPoint, ListeningMaterial, OfflineChange, Phoneme, ReadingArticle, SentenceGraph, SpeakingRecording, WritingEvaluation, WritingPrompt } from '../domain/b3'
import { createB3OfflineQueue, isB3NetworkAvailable, sha256Text, type B3OfflineRecord } from '../platform/b3-offline'

export const useB3Store = defineStore('b3', () => {
  const engine = experiencePerformance
  const performanceLevel = ref<PerformanceLevel>(engine.level)
  const status = ref<B3Status>('idle')
  const message = ref<string | null>(null)
  const online = ref(isB3NetworkAvailable())
  const grammarPoints = ref<GrammarPoint[]>([])
  const grammarExercises = ref<GrammarExercise[]>([])
  const grammarAttemptResult = ref<Record<string, unknown> | null>(null)
  const sentence = ref<SentenceGraph | null>(null)
  const writingPrompts = ref<WritingPrompt[]>([])
  const writingEvaluation = ref<WritingEvaluation | null>(null)
  const materials = ref<ListeningMaterial[]>([])
  const listeningSessionId = ref<string | null>(null)
  const dictationResult = ref<DictationResult | null>(null)
  const articles = ref<ReadingArticle[]>([])
  const article = ref<ReadingArticle | null>(null)
  const phonemes = ref<Phoneme[]>([])
  const recording = ref<SpeakingRecording | null>(null)
  const offline = createB3OfflineQueue()
  const offlineQueue = ref<B3OfflineRecord[]>(offline.records.slice())
  const hasOfflineQueue = computed(() => offlineQueue.value.length > 0)
  const unsubscribe = engine.subscribe((state) => { performanceLevel.value = state.level })

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { online.value = true })
    window.addEventListener('offline', () => { online.value = false; status.value = 'offline'; message.value = '当前处于离线状态，变更会保存到本地队列，服务端确认后才算完成。' })
  }

  function refreshQueue(): void { offlineQueue.value = offline.records.slice() }
  function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level }
  function fail(error: unknown): void { status.value = isB3OfflineError(error) ? 'offline' : 'error'; message.value = error instanceof Error ? error.message : '服务端暂时不可用，未使用本地伪造结果。' }
  async function loadGrammar(): Promise<void> { status.value = 'loading'; message.value = null; try { [grammarPoints.value, grammarExercises.value] = await Promise.all([listGrammarPoints(), listGrammarExercises()]); sentence.value = grammarPoints.value.length ? await getSentenceGraph(3201) : null; status.value = grammarPoints.value.length ? 'ready' : 'empty' } catch (error) { fail(error) } }
  async function evaluateGrammar(exerciseId: number, answer: Record<string, unknown>): Promise<void> { try { grammarAttemptResult.value = await submitGrammarAttempt(exerciseId, answer) } catch (error) { fail(error) } }
  async function loadWriting(): Promise<void> { status.value = 'loading'; message.value = null; try { writingPrompts.value = await listWritingPrompts(); status.value = writingPrompts.value.length ? 'ready' : 'empty' } catch (error) { fail(error) } }
  async function evaluateWriting(answer: string): Promise<void> { const prompt = writingPrompts.value[0]; if (!prompt) return; try { writingEvaluation.value = await submitWriting(prompt.promptId, answer) } catch (error) { fail(error) } }
  async function loadListening(): Promise<void> { status.value = 'loading'; message.value = null; listeningSessionId.value = null; try { materials.value = await listListeningMaterials(); status.value = materials.value.length ? 'ready' : 'empty' } catch (error) { fail(error) } }
  async function startListeningSession(materialId: number): Promise<void> { try { const session = await createListeningSession(materialId); listeningSessionId.value = typeof session.sessionId === 'string' ? session.sessionId : typeof session.id === 'string' ? session.id : null; if (!listeningSessionId.value) message.value = '听力会话尚未建立，答题不会伪造成功。' } catch (error) { fail(error) } }
  async function evaluateDictation(sessionId: string, segmentId: string, answer: string): Promise<void> { try { dictationResult.value = await submitDictation(sessionId, segmentId, answer) } catch (error) { fail(error) } }
  async function loadReading(): Promise<void> { status.value = 'loading'; message.value = null; try { articles.value = await listReadingArticles(); article.value = articles.value[0] ? await getReadingArticle(articles.value[0].articleId) : null; status.value = article.value ? 'ready' : 'empty' } catch (error) { fail(error) } }
  async function saveProgress(articleId: number, blockId: string, percent: number, version: number): Promise<void> {
    try { await saveReadingProgress(articleId, blockId, percent, version) } catch (error) {
      if (!isB3OfflineError(error)) { fail(error); return }
      const payload = JSON.stringify({ articleId, blockId, percent, version })
      try {
        const change: OfflineChange = { changeId: `b3-reading-${articleId}-${version}`, entityType: 'READING_PROGRESS', entityId: String(articleId), entityVersion: version, operation: 'UPSERT', payloadHash: await sha256Text(payload), occurredAt: new Date().toISOString(), clientEventId: `b3-reading-${articleId}-${version}` }
        offline.enqueue(change); refreshQueue(); online.value = false; status.value = 'offline'; message.value = '阅读进度已安全排队，服务端确认前不会标记为已同步。'
      } catch (hashError) { fail(hashError) }
    }
  }
  async function syncOffline(): Promise<void> {
    if (!isB3NetworkAvailable() || !offlineQueue.value.length) return
    const pending = offline.records.filter((item) => item.status === 'PENDING' || item.status === 'FAILED')
    if (!pending.length) return
    pending.forEach((item) => offline.markSyncing(item.id)); refreshQueue()
    try {
      const result = await pushOfflineChanges(pending.map((item) => item.change), offline.cursor)
      const accepted = new Set(result.acceptedChangeIds)
      offline.remove([...accepted])
      for (const item of pending) if (!accepted.has(item.id)) offline.markFailed(item.id, '服务端返回冲突，等待人工选择或下一次版本合并。')
      const pulled = await pullOfflineChanges(result.nextCursor)
      offline.setCursor(pulled.cursor); refreshQueue(); online.value = true; status.value = 'ready'; message.value = result.conflicts.length ? `已同步 ${accepted.size} 项，${result.conflicts.length} 项存在版本冲突。` : `已同步 ${accepted.size} 项离线变更。`
    } catch (error) { pending.forEach((item) => offline.markFailed(item.id, error instanceof Error ? error.message : '同步失败')); refreshQueue(); fail(error) }
  }
  async function loadPhonetics(): Promise<void> { status.value = 'loading'; try { phonemes.value = await getPhonetics(); status.value = phonemes.value.length === 48 ? 'ready' : 'empty' } catch (error) { fail(error) } }
  async function rateRecording(recordingId: string, rating: string): Promise<void> { try { await submitSelfRating(recordingId, rating) } catch (error) { fail(error) } }
  function dispose(): void { void unsubscribe }

  return { performanceLevel, status, message, online, grammarPoints, grammarExercises, grammarAttemptResult, sentence, writingPrompts, writingEvaluation, materials, listeningSessionId, dictationResult, articles, article, phonemes, recording, offlineQueue, hasOfflineQueue, setPerformance, loadGrammar, evaluateGrammar, loadWriting, evaluateWriting, loadListening, startListeningSession, evaluateDictation, loadReading, saveProgress, syncOffline, loadPhonetics, rateRecording, dispose }
})
