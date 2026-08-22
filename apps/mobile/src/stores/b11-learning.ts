import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createAdaptivePerformanceEngine, type PerformanceLevel, type PerformanceStrategy } from '@englishflow/performance'
import { b11ContentLocale, b11UiLocale } from '../platform/b11-foundation'
import { getUniRuntime } from '../platform/uni-runtime'
import { B11OfflineQueue, hashB11Payload } from '../platform/b11-offline'
import { b11ErrorText } from '../utils/b11-errors'
import { authorizeB11Playback, completeB11Shadowing, deleteB11Recording, fetchB11MediaManifest, isB11ExpiredError, isB11ForbiddenError, isB11OfflineError, loadB11ListeningMaterials, loadB11Phonetics, loadB11ReadingWorkspace, registerB11Recording, saveB11MediaProgress, saveB11ReadingProgress, startB11ListeningSession, submitB11Dictation, submitB11ReadingQuestion, submitB11SelfRating, syncB11Offline } from '../api/b11'
import type { DictationResult, ListeningMaterial, Phoneme, ReadingAttemptResult, ReadingArticle, ReadingQuestion, SpeakingRecording } from '../domain/b3'
import type { B11Conflict, B11ListeningWorkspace, B11MediaManifest, B11OfflineEvent, B11OfflineRecord, B11PermissionStatus, B11ReadingWorkspace, B11RecordingDraft, B11RecordingResult, B11SelfRating, B11Status } from '../domain/b11'
import { contentVersionOf, createB11ClientEventId } from '../domain/b11'

const STORAGE_KEY = 'yx.b11.mobile.learning.v1'

interface PersistedState {
  listening?: B11ListeningWorkspace | null
  mediaProgress?: number
  mediaPositionVersion?: number
  playbackRate?: number
  abStartMs?: number | null
  abEndMs?: number | null
  reading?: B11ReadingWorkspace | null
  readingProgress?: number
  readingPositionVersion?: number
  recordingDraft?: B11RecordingDraft | null
  permissionStatus?: B11PermissionStatus
  motionDisabled?: boolean
}

function runtimeStorage() {
  return {
    getItem: (key: string): string | null => { try { const value = getUniRuntime().getStorageSync(key); return typeof value === 'string' ? value : null } catch { return null } },
    setItem: (key: string, value: string): void => { try { getUniRuntime().setStorageSync(key, value) } catch { /* runtime unavailable during SSR */ } },
  }
}

function context() { return { uiLocale: b11UiLocale.value, contentLocale: b11ContentLocale.value } }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function errorMessage(error: unknown, fallback: string): string { return b11ErrorText(error, fallback) }
function contentVersion(value: unknown, fallback: string | number = 'unknown'): string | number { return contentVersionOf(value, fallback) }

export const useB11LearningStore = defineStore('mobile-b11-learning', () => {
  const restored = ref(false)
  const engine = createAdaptivePerformanceEngine({ storage: runtimeStorage(), storageKey: 'yx.b11.mobile.performance.v1' })
  const performanceLevel = ref<PerformanceLevel>(engine.level)
  const performanceStrategy = ref<PerformanceStrategy>(engine.state.strategy)
  const motionDisabled = ref(false)
  const performanceUnsubscribe = engine.subscribe((state) => { performanceLevel.value = state.level; performanceStrategy.value = state.strategy })

  const listeningStatus = ref<B11Status>('idle')
  const listeningMessage = ref<string | null>(null)
  const listening = ref<B11ListeningWorkspace | null>(null)
  const mediaProgress = ref(0)
  const mediaPositionMs = ref(0)
  const mediaPositionVersion = ref(0)
  const playbackRate = ref(1)
  const abStartMs = ref<number | null>(null)
  const abEndMs = ref<number | null>(null)
  const dictationAnswer = ref('')
  const dictationResult = ref<DictationResult | null>(null)
  const languageClipId = ref<string | null>(null)

  const readingStatus = ref<B11Status>('idle')
  const readingMessage = ref<string | null>(null)
  const reading = ref<B11ReadingWorkspace | null>(null)
  const readingBlockIndex = ref(0)
  const readingProgress = ref(0)
  const readingPositionVersion = ref(0)
  const readingAnswers = ref<Record<string, string>>({})
  const readingAttempts = ref<Record<string, ReadingAttemptResult>>({})

  const phoneticsStatus = ref<B11Status>('idle')
  const phoneticsMessage = ref<string | null>(null)
  const phonemes = ref<Phoneme[]>([])
  const permissionStatus = ref<B11PermissionStatus>('UNKNOWN')
  const recordingStatus = ref<B11Status>('idle')
  const recordingMessage = ref<string | null>(null)
  const recordingDraft = ref<B11RecordingDraft | null>(null)
  const savedRecording = ref<SpeakingRecording | null>(null)
  const selfRating = ref<B11SelfRating | null>(null)

  const queue = new B11OfflineQueue()
  const queueRecords = ref<B11OfflineRecord[]>(queue.records)
  const conflicts = ref<B11Conflict[]>(queue.conflicts)
  const queueCount = computed(() => queue.pendingCount)
  const playbackSource = computed(() => {
    const mediaRef = listening.value?.material.mediaRef
    const manifest = listening.value?.manifest
    if (manifest && (manifest.rightsStatus !== 'AUTHORIZED' || manifest.availability !== 'READY')) return null
    if (!manifest && mediaRef?.availability && mediaRef.availability !== 'READY') return null
    if (manifest?.expiresAt && Date.parse(manifest.expiresAt) <= Date.now()) return null
    const variant = manifest?.variants.find((item) => item.variant === 'stream' || item.variant === 'default') ?? manifest?.variants[0]
    return variant?.signedUrl ?? mediaRef?.signedUrl ?? null
  })
  const mediaRightsState = computed(() => {
    const manifest = listening.value?.manifest
    if (manifest?.rightsStatus === 'REVOKED' || listening.value?.material.rightsStatus === 'REVOKED') return 'REVOKED'
    if (manifest?.rightsStatus === 'EXPIRED' || (manifest?.expiresAt && Date.parse(manifest.expiresAt) <= Date.now())) return 'EXPIRED'
    return 'AUTHORIZED'
  })
  const currentReadingBlock = computed(() => reading.value?.article.blocks[readingBlockIndex.value] ?? reading.value?.article.blocks[0] ?? null)
  const languageClips = computed(() => listening.value?.manifest?.clips ?? [])
  const canUseWaveform = computed(() => performanceStrategy.value.enableWaveform && !motionDisabled.value)
  const renderMode = computed(() => performanceLevel.value === 'Performance' || motionDisabled.value ? 'static' : performanceStrategy.value.fallbackMode)

  function persist(): void {
    try {
      getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify({ listening: listening.value, mediaProgress: mediaProgress.value, mediaPositionVersion: mediaPositionVersion.value, playbackRate: playbackRate.value, abStartMs: abStartMs.value, abEndMs: abEndMs.value, reading: reading.value, readingProgress: readingProgress.value, readingPositionVersion: readingPositionVersion.value, recordingDraft: recordingDraft.value, permissionStatus: permissionStatus.value, motionDisabled: motionDisabled.value } satisfies PersistedState))
    } catch { /* local recovery is best effort; server remains authoritative */ }
  }

  function restore(): void {
    if (restored.value) return
    try {
      const raw = getUniRuntime().getStorageSync(STORAGE_KEY)
      if (typeof raw === 'string') {
        const saved = JSON.parse(raw) as PersistedState
        if (saved.listening) listening.value = saved.listening
        if (typeof saved.mediaProgress === 'number') mediaProgress.value = saved.mediaProgress
        if (typeof saved.mediaPositionVersion === 'number') mediaPositionVersion.value = saved.mediaPositionVersion
        if (typeof saved.playbackRate === 'number') playbackRate.value = Math.min(2, Math.max(.5, saved.playbackRate))
        if (typeof saved.abStartMs === 'number') abStartMs.value = saved.abStartMs
        if (typeof saved.abEndMs === 'number') abEndMs.value = saved.abEndMs
        if (saved.reading) reading.value = saved.reading
        if (typeof saved.readingProgress === 'number') readingProgress.value = saved.readingProgress
        if (typeof saved.readingPositionVersion === 'number') readingPositionVersion.value = saved.readingPositionVersion
        if (saved.recordingDraft) recordingDraft.value = saved.recordingDraft
        if (saved.permissionStatus) permissionStatus.value = saved.permissionStatus
        if (typeof saved.motionDisabled === 'boolean') motionDisabled.value = saved.motionDisabled
      }
    } catch { /* corrupt local state is ignored; no result is fabricated */ }
    queue.refresh(); queueRecords.value = queue.records; conflicts.value = queue.conflicts; restored.value = true
  }

  function setPerformance(level: PerformanceLevel): void { engine.setLevel(level, 'manual'); performanceLevel.value = level; persist() }
  function setMotionDisabled(disabled: boolean): void { motionDisabled.value = disabled; persist() }
  function observeNetwork(networkQuality: 'good' | 'degraded' | 'offline'): void { const state = engine.observe({ networkQuality }); performanceLevel.value = state.level; performanceStrategy.value = state.strategy; if (networkQuality === 'offline') listeningStatus.value = listeningStatus.value === 'ready' ? 'recovering' : listeningStatus.value; persist() }
  function refreshQueue(): void { queue.refresh(); queueRecords.value = queue.records; conflicts.value = queue.conflicts }
  function fail(status: B11Status, message: string, area: 'listening' | 'reading' | 'phonetics' | 'recording'): void { if (area === 'listening') { listeningStatus.value = status; listeningMessage.value = message } else if (area === 'reading') { readingStatus.value = status; readingMessage.value = message } else if (area === 'phonetics') { phoneticsStatus.value = status; phoneticsMessage.value = message } else { recordingStatus.value = status; recordingMessage.value = message } }
  function statusForError(error: unknown): B11Status { if (isB11ForbiddenError(error)) return 'forbidden'; if (isB11ExpiredError(error)) return 'expired'; if (isB11OfflineError(error)) return 'offline'; return 'error' }

  async function loadListening(): Promise<void> {
    restore(); listeningStatus.value = 'loading'; listeningMessage.value = null; dictationResult.value = null
    try {
      const materials = await loadB11ListeningMaterials(context())
      const material = materials[0]
      if (!material) { listening.value = null; listeningStatus.value = 'empty'; return }
      const version = contentVersion(material.contentVersionId, 'unknown')
      if (material.rightsStatus === 'REVOKED') { listening.value = { material, manifest: null, sessionId: null, contentVersion: version }; fail('forbidden', '当前媒体权益已撤销，字幕与历史进度不会伪造为可播放。', 'listening'); persist(); return }
      let manifest: B11MediaManifest | null = null
      if (material.mediaRef?.assetId) {
        try { manifest = await fetchB11MediaManifest(material.mediaRef.assetId, context(), version); if (manifest?.rightsStatus === 'AUTHORIZED' && manifest.availability === 'READY' && !manifest.variants.some((item) => item.signedUrl)) { try { manifest = await authorizeB11Playback(material.mediaRef.assetId, 'default', context(), createB11ClientEventId(`playback-${material.mediaRef.assetId}`), version) ?? manifest } catch (authorizationError) { if (!material.mediaRef.signedUrl) throw authorizationError } } } catch (error) { if (!isB11ExpiredError(error) && !isB11ForbiddenError(error)) throw error; fail(statusForError(error), errorMessage(error, '媒体清单不可用。'), 'listening'); persist(); return }
      }
      const sessionId = await startB11ListeningSession(material.materialId, context(), createB11ClientEventId(`listening-session-${material.materialId}`), version)
      listening.value = { material, manifest, sessionId, contentVersion: version }
      listeningStatus.value = 'ready'; listeningMessage.value = sessionId ? null : '服务端未返回听力会话，播放与字幕可查看，但不会伪造提交成功。'; persist()
    } catch (error) { fail(statusForError(error), errorMessage(error, '听力服务暂时不可用；本地进度仍会保留。'), 'listening'); persist() }
  }

  function setPlaybackRate(rate: number): void { playbackRate.value = Math.min(2, Math.max(.5, rate)); persist() }
  function setPosition(positionMs: number): void {
    mediaPositionMs.value = Math.max(0, Math.round(positionMs))
    const duration = listening.value?.material.durationMs ?? listening.value?.manifest?.durationMs ?? 0
    mediaProgress.value = duration > 0 ? Math.min(100, Math.round((mediaPositionMs.value / duration) * 10000) / 100) : mediaProgress.value
    persist()
  }
  function setABPoint(point: 'A' | 'B'): void { if (point === 'A') abStartMs.value = mediaPositionMs.value; else abEndMs.value = mediaPositionMs.value; persist() }
  function clearAB(): void { abStartMs.value = null; abEndMs.value = null; persist() }
  function selectLanguageClip(clipId: string): void { languageClipId.value = clipId; persist() }

  async function enqueueEvent(event: B11OfflineEvent): Promise<boolean> {
    const result = queue.enqueue(event)
    refreshQueue()
    if (!result.accepted) {
      const message = result.reason === 'STORAGE_FULL' ? '本机空间不足，未丢弃已保存内容。' : result.reason === 'SENSITIVE_PAYLOAD' ? '本地事件包含不允许持久化的媒体字段，已拒绝入队。' : '离线事件不完整，未入队。'
      listeningMessage.value = message; readingMessage.value = message; recordingMessage.value = message
      return false
    }
    return true
  }

  async function saveMediaProgress(force = false): Promise<void> {
    if (!listening.value || !listening.value.sessionId && !listening.value.material.mediaRef?.assetId) return
    if (!force && mediaPositionMs.value <= 0) return
    mediaPositionVersion.value += 1
    const clientEventId = createB11ClientEventId(`media-progress-${listening.value.material.materialId}-${mediaPositionVersion.value}`)
    const payload = { sessionId: listening.value.sessionId, assetId: listening.value.material.mediaRef?.assetId ?? String(listening.value.material.materialId), positionMs: mediaPositionMs.value, durationMs: listening.value.material.durationMs, contentVersion: listening.value.contentVersion }
    const event: B11OfflineEvent = { clientEventId, entityType: 'MEDIA_PROGRESS', entityId: payload.assetId, entityVersion: mediaPositionVersion.value, operation: 'UPSERT', contentVersion: listening.value.contentVersion, payloadHash: await hashB11Payload(payload), occurredAt: new Date().toISOString(), payload }
    if (!await enqueueEvent(event)) { fail('recovering', '本地空间不足，进度仍停留在当前页面；请释放空间后重试。', 'listening'); persist(); return }
    try { await saveB11MediaProgress({ ...payload, entityVersion: event.entityVersion, clientEventId }, context()); queue.remove([clientEventId]); refreshQueue(); listeningStatus.value = 'ready'; listeningMessage.value = '播放进度已由服务端确认。' } catch (error) { const state = statusForError(error); fail(state === 'expired' || state === 'forbidden' ? state : state === 'offline' ? 'offline' : 'recovering', errorMessage(error, '进度未确认；联网后可恢复。'), 'listening') }
    persist()
  }

  async function submitDictationAnswer(): Promise<void> {
    const sessionId = listening.value?.sessionId; const segment = listening.value?.material.segments[0]
    if (!sessionId || !segment || !dictationAnswer.value.trim()) { listeningMessage.value = '请先读取真实听力会话并填写听写答案。'; return }
    const clientEventId = createB11ClientEventId(`dictation-${sessionId}-${segment.segmentId}`)
    try { dictationResult.value = await submitB11Dictation(sessionId, segment.segmentId, dictationAnswer.value.trim(), context(), clientEventId, listening.value?.contentVersion ?? 'unknown'); listeningStatus.value = 'ready'; listeningMessage.value = dictationResult.value.correct ? '服务端规则判定正确。' : '服务端已记录本次练习，可按反馈复习。' } catch (error) {
      if (isB11OfflineError(error)) {
        const payload = { sessionId, segmentId: segment.segmentId, answer: dictationAnswer.value.trim(), contentVersion: listening.value?.contentVersion ?? 'unknown' }
        await enqueueEvent({ clientEventId, entityType: 'READING_QUESTION', entityId: `${sessionId}:${segment.segmentId}`, entityVersion: 1, operation: 'UPSERT', contentVersion: payload.contentVersion, payloadHash: await hashB11Payload(payload), occurredAt: new Date().toISOString(), payload })
        fail('offline', '听写答案已保留到待同步队列，服务端尚未判定。', 'listening')
      } else fail(statusForError(error), errorMessage(error, '听写提交失败，答案仍保留在当前页面。'), 'listening')
    }
    persist()
  }

  async function loadReading(): Promise<void> {
    restore(); readingStatus.value = 'loading'; readingMessage.value = null
    try { const workspace = await loadB11ReadingWorkspace(context()); if (!workspace || !workspace.article.blocks.length || workspace.article.rightsStatus === 'REVOKED') { reading.value = workspace; fail(workspace?.article.rightsStatus === 'REVOKED' ? 'forbidden' : 'empty', workspace?.article.rightsStatus === 'REVOKED' ? '当前文章版权状态不允许阅读。' : '服务端未返回可阅读文章。', 'reading'); persist(); return }; reading.value = workspace; readingBlockIndex.value = Math.min(readingBlockIndex.value, workspace.article.blocks.length - 1); readingStatus.value = 'ready'; persist() } catch (error) { fail(statusForError(error), errorMessage(error, '阅读服务暂时不可用；最后位置仍保留。'), 'reading'); persist() }
  }

  function setReadingBlock(index: number): void { const count = reading.value?.article.blocks.length ?? 0; readingBlockIndex.value = Math.min(Math.max(0, index), Math.max(0, count - 1)); readingProgress.value = count > 0 ? Math.round(((readingBlockIndex.value + 1) / count) * 100) : 0; persist() }
  async function saveReadingPosition(force = false): Promise<void> {
    if (!reading.value || !currentReadingBlock.value || (!force && readingProgress.value <= 0)) return
    readingPositionVersion.value += 1
    const clientEventId = createB11ClientEventId(`reading-progress-${reading.value.article.articleId}-${readingPositionVersion.value}`)
    const payload = { articleId: reading.value.article.articleId, blockId: currentReadingBlock.value.blockId, progressPercent: readingProgress.value, contentVersion: reading.value.contentVersion }
    const event: B11OfflineEvent = { clientEventId, entityType: 'READING_PROGRESS', entityId: String(reading.value.article.articleId), entityVersion: readingPositionVersion.value, operation: 'UPSERT', contentVersion: reading.value.contentVersion, payloadHash: await hashB11Payload(payload), occurredAt: new Date().toISOString(), payload }
    if (!await enqueueEvent(event)) { fail('recovering', '本机空间不足，阅读位置仍在当前页面保留。', 'reading'); return }
    try { await saveB11ReadingProgress(reading.value.article, currentReadingBlock.value.blockId, readingProgress.value, readingPositionVersion.value, context(), clientEventId); queue.remove([clientEventId]); refreshQueue(); readingStatus.value = 'ready'; readingMessage.value = '阅读进度已由服务端确认。' } catch (error) { const state = statusForError(error); fail(state === 'expired' || state === 'forbidden' ? state : state === 'offline' ? 'offline' : 'recovering', errorMessage(error, '阅读位置未确认；最后位置已保留。'), 'reading') }
    persist()
  }

  async function submitReadingAnswer(question: ReadingQuestion): Promise<void> {
    const answer = readingAnswers.value[String(question.questionId)]
    if (!answer || readingAttempts.value[String(question.questionId)]) return
    const clientEventId = createB11ClientEventId(`reading-question-${question.questionId}`)
    try { readingAttempts.value[String(question.questionId)] = await submitB11ReadingQuestion(question, answer, context(), clientEventId); readingStatus.value = 'ready'; readingMessage.value = '理解题已由服务端记录。' } catch (error) { if (isB11OfflineError(error)) { const payload = { questionId: question.questionId, answer, contentVersion: contentVersion(question.contentVersionId) }; await enqueueEvent({ clientEventId, entityType: 'READING_QUESTION', entityId: String(question.questionId), entityVersion: 1, operation: 'UPSERT', contentVersion: payload.contentVersion, payloadHash: await hashB11Payload(payload), occurredAt: new Date().toISOString(), payload }); fail('offline', '理解题答案已保留，服务端尚未判定。', 'reading') } else fail(statusForError(error), errorMessage(error, '理解题提交失败，答案仍保留。'), 'reading') }
    persist()
  }

  async function loadPhonetics(): Promise<void> { restore(); phoneticsStatus.value = 'loading'; phoneticsMessage.value = null; try { phonemes.value = await loadB11Phonetics(context()); phoneticsStatus.value = phonemes.value.length ? 'ready' : 'empty'; if (!phonemes.value.length) phoneticsMessage.value = '服务端未返回音标目录。' } catch (error) { fail(statusForError(error), errorMessage(error, '音标服务暂时不可用。'), 'phonetics') } }
  function setPermissionStatus(status: B11PermissionStatus): void { permissionStatus.value = status; persist() }
  function setRecordingDraft(draft: B11RecordingDraft | null): void { recordingDraft.value = draft; recordingStatus.value = draft ? draft.status === 'SAVED' ? 'ready' : 'recovering' : 'idle'; persist() }
  function clearRecordingDraft(): void { recordingDraft.value = null; savedRecording.value = null; selfRating.value = null; recordingStatus.value = 'idle'; persist() }
  function setRecordingMessage(message: string | null): void { recordingMessage.value = message }

  async function registerRecordingDraft(): Promise<void> {
    const draft = recordingDraft.value
    if (!draft) { recordingMessage.value = '请先完成一段真实录音。'; return }
    recordingStatus.value = 'loading'; recordingMessage.value = null
    try { const result: B11RecordingResult = await registerB11Recording({ sourceSegmentId: draft.sourceSegmentId, durationMs: draft.durationMs, contentHash: draft.contentHash, storageMode: draft.storageMode, contentVersion: draft.contentVersion, clientEventId: draft.clientEventId }, context()); savedRecording.value = result.recording; recordingDraft.value = { ...draft, status: 'SAVED', recordingId: result.recording.recordingId }; recordingStatus.value = 'ready'; recordingMessage.value = '服务端已登记哈希与生命周期元数据；未上传原始录音到普通状态。' } catch (error) { if (isB11OfflineError(error)) { const payload = { sourceSegmentId: draft.sourceSegmentId, durationMs: draft.durationMs, contentHash: draft.contentHash, storageMode: draft.storageMode, contentVersion: draft.contentVersion }; await enqueueEvent({ clientEventId: draft.clientEventId, entityType: 'RECORDING', entityId: draft.clientEventId, entityVersion: 1, operation: 'UPSERT', contentVersion: draft.contentVersion, payloadHash: await hashB11Payload(payload), occurredAt: new Date().toISOString(), payload }); recordingDraft.value = { ...draft, status: 'LOCAL_ONLY' }; recordingStatus.value = 'offline'; recordingMessage.value = '网络不可用；加密录音仍保留在本地，服务端尚未登记。' } else { recordingDraft.value = { ...draft, status: 'FAILED' }; recordingStatus.value = statusForError(error); recordingMessage.value = errorMessage(error, '录音登记失败；本地副本仍保留。') } }
    persist()
  }

  async function removeSavedRecording(): Promise<void> { if (!savedRecording.value) return; const id = savedRecording.value.recordingId; try { await deleteB11Recording(id, context(), createB11ClientEventId(`recording-delete-${id}`)); clearRecordingDraft(); recordingMessage.value = '服务端已确认删除录音登记。' } catch (error) { recordingMessage.value = errorMessage(error, '录音删除未获服务端确认。') } }
  async function saveSelfRating(rating: B11SelfRating): Promise<void> {
    selfRating.value = rating
    const draft = recordingDraft.value
    if (!draft) { recordingMessage.value = '请先完成并保留一次真实录音，再提交自评。'; persist(); return }
    const clientEventId = createB11ClientEventId(`self-rating-${draft.recordingId ?? draft.clientEventId}`)
    if (!draft.recordingId) { recordingDraft.value = { ...draft, selfRating: rating }; const payload = { recordingEventId: draft.clientEventId, rating, contentVersion: draft.contentVersion }; await enqueueEvent({ clientEventId, entityType: 'SELF_RATING', entityId: draft.clientEventId, entityVersion: 1, operation: 'UPSERT', contentVersion: draft.contentVersion, payloadHash: await hashB11Payload(payload), occurredAt: new Date().toISOString(), payload }); recordingMessage.value = '自评已保留，待录音登记后同步。'; persist(); return }
    try { await submitB11SelfRating(draft.recordingId, rating, context(), clientEventId, draft.contentVersion); recordingDraft.value = { ...draft, selfRating: rating }; recordingStatus.value = 'ready'; recordingMessage.value = `自评已保存：${rating}。Phase 1 不生成 AI 分数。` } catch (error) { if (isB11OfflineError(error)) { const payload = { recordingId: draft.recordingId, rating, contentVersion: draft.contentVersion }; await enqueueEvent({ clientEventId, entityType: 'SELF_RATING', entityId: draft.recordingId, entityVersion: 1, operation: 'UPSERT', contentVersion: draft.contentVersion, payloadHash: await hashB11Payload(payload), occurredAt: new Date().toISOString(), payload }); recordingMessage.value = '自评已保留，联网后同步。' } else recordingMessage.value = errorMessage(error, '自评提交失败，当前选择仍保留。') }
    persist()
  }

  async function completeShadowing(sourceSegmentId: string): Promise<void> {
    const draft = recordingDraft.value
    if (!draft?.recordingId) { recordingMessage.value = '请先由服务端登记录音，再完成影子跟读。'; return }
    try { await completeB11Shadowing({ recordingId: draft.recordingId, sourceSegmentId, contentVersion: draft.contentVersion, clientEventId: createB11ClientEventId(`shadowing-${sourceSegmentId}`) }, context()); recordingMessage.value = '影子跟读已记录；Phase 1 无 ASR/AI 评分。' } catch (error) { if (isB11OfflineError(error)) recordingMessage.value = '影子跟读待联网恢复；本地录音副本仍保留。'; else recordingMessage.value = errorMessage(error, '影子跟读提交失败。') }
  }

  async function syncOffline(): Promise<void> {
    refreshQueue(); const pending = queue.records.filter((item) => item.status === 'PENDING' || item.status === 'FAILED')
    if (!pending.length) return
    const events = pending.map(({ status: _status, attempts: _attempts, lastError: _lastError, queuedAt: _queuedAt, ...event }) => event)
    pending.forEach((item) => queue.markSyncing(item.clientEventId)); refreshQueue()
    try { const result = await syncB11Offline(events, queue.cursor, context(), createB11ClientEventId('offline-sync')); if (result.acceptedEventIds.length) queue.remove(result.acceptedEventIds); const conflictEventIds = new Set(result.conflicts.map((conflict) => conflict.clientEventId).filter(Boolean)); result.conflicts.forEach((conflict) => { queue.recordConflict(conflict); if (conflict.clientEventId) queue.markFailed(conflict.clientEventId, '服务端版本冲突，等待人工或明确策略恢复。') }); const acceptedEventIds = new Set(result.acceptedEventIds); pending.filter((item) => !acceptedEventIds.has(item.clientEventId) && !conflictEventIds.has(item.clientEventId)).forEach((item) => queue.markFailed(item.clientEventId, '服务端未确认该事件。')); if (result.nextCursor) queue.setCursor(result.nextCursor); refreshQueue(); listeningStatus.value = 'ready'; readingStatus.value = 'ready'; recordingMessage.value = result.conflicts.length ? '同步发现版本冲突，未静默覆盖本地进度。' : '待同步操作已由服务端确认。' } catch (error) { pending.forEach((item) => queue.markFailed(item.clientEventId, errorMessage(error, '同步请求失败'))); refreshQueue(); const status = statusForError(error); listeningStatus.value = status === 'offline' ? 'offline' : 'recovering'; readingStatus.value = status === 'offline' ? 'offline' : 'recovering'; recordingMessage.value = '同步失败，队列与本地录音副本仍保留。' }
    persist()
  }

  return { restored, performanceLevel, performanceStrategy, motionDisabled, listeningStatus, listeningMessage, listening, mediaProgress, mediaPositionMs, mediaPositionVersion, playbackRate, abStartMs, abEndMs, dictationAnswer, dictationResult, languageClipId, playbackSource, mediaRightsState, languageClips, canUseWaveform, renderMode, readingStatus, readingMessage, reading, readingBlockIndex, readingProgress, readingPositionVersion, currentReadingBlock, readingAnswers, readingAttempts, phoneticsStatus, phoneticsMessage, phonemes, permissionStatus, recordingStatus, recordingMessage, recordingDraft, savedRecording, selfRating, queueRecords, conflicts, queueCount, restore, setPerformance, setMotionDisabled, observeNetwork, refreshQueue, loadListening, setPlaybackRate, setPosition, setABPoint, clearAB, selectLanguageClip, saveMediaProgress, submitDictationAnswer, loadReading, setReadingBlock, saveReadingPosition, submitReadingAnswer, loadPhonetics, setPermissionStatus, setRecordingDraft, clearRecordingDraft, setRecordingMessage, registerRecordingDraft, removeSavedRecording, saveSelfRating, completeShadowing, syncOffline, dispose: () => { performanceUnsubscribe(); engine.dispose() } }
})
