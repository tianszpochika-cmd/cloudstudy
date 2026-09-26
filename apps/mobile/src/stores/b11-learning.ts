import { computed, ref, watch } from 'vue'
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
import { useSessionStore } from './session'
import { B11_LEARNING_STORAGE_KEY, B11_OFFLINE_STORAGE_KEY, removeLearningCache } from './learning-cache'

const STORAGE_KEY = B11_LEARNING_STORAGE_KEY
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

function normalizePlaybackRate(value: number): number {
  if (!Number.isFinite(value)) return 1
  return PLAYBACK_RATES.reduce((nearest, rate) => Math.abs(rate - value) < Math.abs(nearest - value) ? rate : nearest, 1)
}

interface PersistedState {
  subject: string
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
  const session = useSessionStore()
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
  const queueRecords = ref<B11OfflineRecord[]>([])
  const conflicts = ref<B11Conflict[]>([])
  let cacheOwner: string | null = null
  const queueCount = computed(() => session.isAuthenticated && cacheOwner === session.verifiedSubject ? queueRecords.value.filter((item) => item.status !== 'SYNCING').length : 0)
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

  type Scope = { subject: string; revision: number }
  function scope(): Scope | null {
    return session.isAuthenticated && session.verifiedSubject
      ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
  }
  function stillCurrent(owner: Scope | null): boolean {
    return Boolean(owner && session.isAuthenticated && session.verifiedSubject === owner.subject && session.identityRevision === owner.revision)
  }
  function reset(): void {
    restored.value = false; cacheOwner = null
    listeningStatus.value = 'idle'; listeningMessage.value = null; listening.value = null
    mediaProgress.value = 0; mediaPositionMs.value = 0; mediaPositionVersion.value = 0
    playbackRate.value = 1; abStartMs.value = null; abEndMs.value = null
    dictationAnswer.value = ''; dictationResult.value = null; languageClipId.value = null
    readingStatus.value = 'idle'; readingMessage.value = null; reading.value = null
    readingBlockIndex.value = 0; readingProgress.value = 0; readingPositionVersion.value = 0
    readingAnswers.value = {}; readingAttempts.value = {}
    phoneticsStatus.value = 'idle'; phoneticsMessage.value = null; phonemes.value = []
    permissionStatus.value = 'UNKNOWN'; recordingStatus.value = 'idle'; recordingMessage.value = null
    recordingDraft.value = null; savedRecording.value = null; selfRating.value = null
    motionDisabled.value = false
    queueRecords.value = []; conflicts.value = []
  }
  watch(() => session.identityRevision, reset, { flush: 'sync' })

  function persist(): void {
    const owner = scope()
    if (!owner) return
    if (!restored.value) restore()
    try {
      getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify({ subject: owner.subject, listening: listening.value, mediaProgress: mediaProgress.value, mediaPositionVersion: mediaPositionVersion.value, playbackRate: playbackRate.value, abStartMs: abStartMs.value, abEndMs: abEndMs.value, reading: reading.value, readingProgress: readingProgress.value, readingPositionVersion: readingPositionVersion.value, recordingDraft: recordingDraft.value, permissionStatus: permissionStatus.value, motionDisabled: motionDisabled.value } satisfies PersistedState))
    } catch { /* local recovery is best effort; server remains authoritative */ }
  }

  function restore(): void {
    const owner = scope()
    if (!owner) return
    if (restored.value) return
    let validOwner = false
    try {
      const raw = getUniRuntime().getStorageSync(STORAGE_KEY)
      if (typeof raw === 'string') {
        const saved = JSON.parse(raw) as PersistedState
        if (saved.subject !== owner.subject) throw new Error('B11 cache owner mismatch')
        validOwner = true
        if (saved.listening) listening.value = saved.listening
        if (typeof saved.mediaProgress === 'number') mediaProgress.value = saved.mediaProgress
        if (typeof saved.mediaPositionVersion === 'number') mediaPositionVersion.value = saved.mediaPositionVersion
        if (typeof saved.playbackRate === 'number') playbackRate.value = normalizePlaybackRate(saved.playbackRate)
        if (typeof saved.abStartMs === 'number') abStartMs.value = saved.abStartMs
        if (typeof saved.abEndMs === 'number') abEndMs.value = saved.abEndMs
        if (saved.reading) reading.value = saved.reading
        if (typeof saved.readingProgress === 'number') readingProgress.value = saved.readingProgress
        if (typeof saved.readingPositionVersion === 'number') readingPositionVersion.value = saved.readingPositionVersion
        if (saved.recordingDraft) recordingDraft.value = saved.recordingDraft
        if (saved.permissionStatus) permissionStatus.value = saved.permissionStatus
        if (typeof saved.motionDisabled === 'boolean') motionDisabled.value = saved.motionDisabled
      }
    } catch { removeLearningCache(STORAGE_KEY) }
    if (!validOwner) removeLearningCache(B11_OFFLINE_STORAGE_KEY)
    queue.refresh(); queueRecords.value = queue.records; conflicts.value = queue.conflicts; restored.value = true
    cacheOwner = owner.subject
  }

  function setPerformance(level: PerformanceLevel): void { if (!scope()) return; restore(); engine.setLevel(level, 'manual'); performanceLevel.value = level; persist() }
  function setMotionDisabled(disabled: boolean): void { if (!scope()) return; restore(); motionDisabled.value = disabled; persist() }
  function observeNetwork(networkQuality: 'good' | 'degraded' | 'offline'): void { if (!scope()) return; restore(); const state = engine.observe({ networkQuality }); performanceLevel.value = state.level; performanceStrategy.value = state.strategy; if (networkQuality === 'offline') listeningStatus.value = listeningStatus.value === 'ready' ? 'recovering' : listeningStatus.value; persist() }
  function refreshQueue(): void { if (!scope()) return; restore(); queue.refresh(); queueRecords.value = queue.records; conflicts.value = queue.conflicts }
  function fail(status: B11Status, message: string, area: 'listening' | 'reading' | 'phonetics' | 'recording'): void { if (area === 'listening') { listeningStatus.value = status; listeningMessage.value = message } else if (area === 'reading') { readingStatus.value = status; readingMessage.value = message } else if (area === 'phonetics') { phoneticsStatus.value = status; phoneticsMessage.value = message } else { recordingStatus.value = status; recordingMessage.value = message } }
  function statusForError(error: unknown): B11Status { if (isB11ForbiddenError(error)) return 'forbidden'; if (isB11ExpiredError(error)) return 'expired'; if (isB11OfflineError(error)) return 'offline'; return 'error' }

  async function loadListening(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); listeningStatus.value = 'forbidden'; return }
    restore(); listeningStatus.value = 'loading'; listeningMessage.value = null; dictationResult.value = null
    try {
      const materials = await loadB11ListeningMaterials(context())
      if (!stillCurrent(owner)) return
      const material = materials[0]
      if (!material) { listening.value = null; listeningStatus.value = 'empty'; return }
      const version = contentVersion(material.contentVersionId, 'unknown')
      if (material.rightsStatus === 'REVOKED') { listening.value = { material, manifest: null, sessionId: null, contentVersion: version }; fail('forbidden', '当前媒体权益已撤销，字幕与历史进度不会伪造为可播放。', 'listening'); persist(); return }
      let manifest: B11MediaManifest | null = null
      if (material.mediaRef?.assetId) {
        try {
          manifest = await fetchB11MediaManifest(material.mediaRef.assetId, context(), version)
          if (!stillCurrent(owner)) return
          if (manifest?.rightsStatus === 'AUTHORIZED' && manifest.availability === 'READY' && !manifest.variants.some((item) => item.signedUrl)) {
            try { manifest = await authorizeB11Playback(material.mediaRef.assetId, 'default', context(), createB11ClientEventId(`playback-${material.mediaRef.assetId}`), version) ?? manifest }
            catch (authorizationError) { if (!material.mediaRef.signedUrl) throw authorizationError }
            if (!stillCurrent(owner)) return
          }
        } catch (error) { if (!stillCurrent(owner)) return; if (!isB11ExpiredError(error) && !isB11ForbiddenError(error)) throw error; fail(statusForError(error), errorMessage(error, '媒体清单不可用。'), 'listening'); persist(); return }
      }
      if (!stillCurrent(owner)) return
      const sessionId = await startB11ListeningSession(material.materialId, context(), createB11ClientEventId(`listening-session-${material.materialId}`), version)
      if (!stillCurrent(owner)) return
      listening.value = { material, manifest, sessionId, contentVersion: version }
      listeningStatus.value = 'ready'; listeningMessage.value = sessionId ? null : '暂时无法提交练习，可继续查看字幕。'; persist()
    } catch (error) { if (!stillCurrent(owner)) return; fail(statusForError(error), errorMessage(error, '听力服务暂时不可用；本地进度仍会保留。'), 'listening'); persist() }
  }

  function setPlaybackRate(rate: number): void { if (!scope()) return; restore(); playbackRate.value = normalizePlaybackRate(rate); persist() }
  function setPosition(positionMs: number): void {
    if (!scope() || !listening.value) return
    mediaPositionMs.value = Math.max(0, Math.round(positionMs))
    const duration = listening.value?.material.durationMs ?? listening.value?.manifest?.durationMs ?? 0
    mediaProgress.value = duration > 0 ? Math.min(100, Math.round((mediaPositionMs.value / duration) * 10000) / 100) : mediaProgress.value
    persist()
  }
  function setABPoint(point: 'A' | 'B'): void { if (!scope() || !listening.value) return; if (point === 'A') abStartMs.value = mediaPositionMs.value; else abEndMs.value = mediaPositionMs.value; persist() }
  function clearAB(): void { if (!scope()) return; abStartMs.value = null; abEndMs.value = null; persist() }
  function selectLanguageClip(clipId: string): void { if (!scope() || !listening.value?.manifest?.clips.some((item) => item.clipId === clipId)) return; languageClipId.value = clipId; persist() }

  async function enqueueEvent(event: B11OfflineEvent): Promise<boolean> {
    if (!scope()) return false
    restore()
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
    const owner = scope()
    if (!owner) return
    restore()
    const currentListening = listening.value
    if (!currentListening || !currentListening.sessionId && !currentListening.material.mediaRef?.assetId) return
    if (!force && mediaPositionMs.value <= 0) return
    mediaPositionVersion.value += 1
    const clientEventId = createB11ClientEventId(`media-progress-${currentListening.material.materialId}-${mediaPositionVersion.value}`)
    const payload = { sessionId: currentListening.sessionId, assetId: currentListening.material.mediaRef?.assetId ?? String(currentListening.material.materialId), positionMs: mediaPositionMs.value, durationMs: currentListening.material.durationMs, contentVersion: currentListening.contentVersion }
    const payloadHash = await hashB11Payload(payload)
    if (!stillCurrent(owner) || listening.value !== currentListening) return
    const event: B11OfflineEvent = { clientEventId, entityType: 'MEDIA_PROGRESS', entityId: payload.assetId, entityVersion: mediaPositionVersion.value, operation: 'UPSERT', contentVersion: currentListening.contentVersion, payloadHash, occurredAt: new Date().toISOString(), payload }
    const queued = await enqueueEvent(event)
    if (!stillCurrent(owner) || listening.value !== currentListening) return
    if (!queued) { fail('recovering', '本地空间不足，进度仍停留在当前页面；请释放空间后重试。', 'listening'); persist(); return }
    try { await saveB11MediaProgress({ ...payload, entityVersion: event.entityVersion, clientEventId }, context()); if (!stillCurrent(owner) || listening.value !== currentListening) return; queue.remove([clientEventId]); refreshQueue(); listeningStatus.value = 'ready'; listeningMessage.value = '播放进度已由服务端确认。' } catch (error) { if (!stillCurrent(owner) || listening.value !== currentListening) return; const state = statusForError(error); fail(state === 'expired' || state === 'forbidden' ? state : state === 'offline' ? 'offline' : 'recovering', errorMessage(error, '进度未确认；联网后可恢复。'), 'listening') }
    persist()
  }

  async function submitDictationAnswer(): Promise<void> {
    const owner = scope()
    if (!owner) return
    const currentListening = listening.value
    const sessionId = currentListening?.sessionId; const segment = currentListening?.material.segments[0]
    const answer = dictationAnswer.value.trim()
    if (!sessionId || !segment || !answer) { listeningMessage.value = '请先读取真实听力会话并填写听写答案。'; return }
    const clientEventId = createB11ClientEventId(`dictation-${sessionId}-${segment.segmentId}`)
    try { const result = await submitB11Dictation(sessionId, segment.segmentId, answer, context(), clientEventId, currentListening.contentVersion); if (!stillCurrent(owner) || listening.value !== currentListening) return; dictationResult.value = result; listeningStatus.value = 'ready'; listeningMessage.value = result.correct ? '服务端规则判定正确。' : '服务端已记录本次练习，可按反馈复习。' } catch (error) {
      if (!stillCurrent(owner) || listening.value !== currentListening) return
      if (isB11OfflineError(error)) {
        const payload = { sessionId, segmentId: segment.segmentId, answer, contentVersion: currentListening.contentVersion }
        const payloadHash = await hashB11Payload(payload)
        if (!stillCurrent(owner) || listening.value !== currentListening) return
        await enqueueEvent({ clientEventId, entityType: 'READING_QUESTION', entityId: `${sessionId}:${segment.segmentId}`, entityVersion: 1, operation: 'UPSERT', contentVersion: payload.contentVersion, payloadHash, occurredAt: new Date().toISOString(), payload })
        if (!stillCurrent(owner) || listening.value !== currentListening) return
        fail('offline', '听写答案已保留到待同步队列，服务端尚未判定。', 'listening')
      } else fail(statusForError(error), errorMessage(error, '听写提交失败，答案仍保留在当前页面。'), 'listening')
    }
    persist()
  }

  async function loadReading(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); readingStatus.value = 'forbidden'; return }
    restore(); readingStatus.value = 'loading'; readingMessage.value = null
    try { const workspace = await loadB11ReadingWorkspace(context()); if (!stillCurrent(owner)) return; if (!workspace || !workspace.article.blocks.length || workspace.article.rightsStatus === 'REVOKED') { reading.value = workspace; fail(workspace?.article.rightsStatus === 'REVOKED' ? 'forbidden' : 'empty', workspace?.article.rightsStatus === 'REVOKED' ? '当前文章版权状态不允许阅读。' : '服务端未返回可阅读文章。', 'reading'); persist(); return }; reading.value = workspace; readingBlockIndex.value = Math.min(readingBlockIndex.value, workspace.article.blocks.length - 1); readingStatus.value = 'ready'; persist() } catch (error) { if (!stillCurrent(owner)) return; fail(statusForError(error), errorMessage(error, '阅读服务暂时不可用；最后位置仍保留。'), 'reading'); persist() }
  }

  function setReadingBlock(index: number): void { if (!scope()) return; const count = reading.value?.article.blocks.length ?? 0; readingBlockIndex.value = Math.min(Math.max(0, index), Math.max(0, count - 1)); readingProgress.value = count > 0 ? Math.round(((readingBlockIndex.value + 1) / count) * 100) : 0; persist() }
  async function saveReadingPosition(force = false): Promise<void> {
    const owner = scope()
    if (!owner) return
    restore()
    const currentReading = reading.value
    const block = currentReadingBlock.value
    if (!currentReading || !block || (!force && readingProgress.value <= 0)) return
    readingPositionVersion.value += 1
    const clientEventId = createB11ClientEventId(`reading-progress-${currentReading.article.articleId}-${readingPositionVersion.value}`)
    const payload = { articleId: currentReading.article.articleId, blockId: block.blockId, progressPercent: readingProgress.value, contentVersion: currentReading.contentVersion }
    const payloadHash = await hashB11Payload(payload)
    if (!stillCurrent(owner) || reading.value !== currentReading) return
    const event: B11OfflineEvent = { clientEventId, entityType: 'READING_PROGRESS', entityId: String(currentReading.article.articleId), entityVersion: readingPositionVersion.value, operation: 'UPSERT', contentVersion: currentReading.contentVersion, payloadHash, occurredAt: new Date().toISOString(), payload }
    const queued = await enqueueEvent(event)
    if (!stillCurrent(owner) || reading.value !== currentReading) return
    if (!queued) { fail('recovering', '本机空间不足，阅读位置仍在当前页面保留。', 'reading'); return }
    try { await saveB11ReadingProgress(currentReading.article, block.blockId, payload.progressPercent, event.entityVersion, context(), clientEventId); if (!stillCurrent(owner) || reading.value !== currentReading) return; queue.remove([clientEventId]); refreshQueue(); readingStatus.value = 'ready'; readingMessage.value = '阅读进度已由服务端确认。' } catch (error) { if (!stillCurrent(owner) || reading.value !== currentReading) return; const state = statusForError(error); fail(state === 'expired' || state === 'forbidden' ? state : state === 'offline' ? 'offline' : 'recovering', errorMessage(error, '阅读位置未确认；最后位置已保留。'), 'reading') }
    persist()
  }

  async function submitReadingAnswer(question: ReadingQuestion): Promise<void> {
    const owner = scope()
    if (!owner || !reading.value?.questions.includes(question)) return
    const answer = readingAnswers.value[String(question.questionId)]
    if (!answer || readingAttempts.value[String(question.questionId)]) return
    const clientEventId = createB11ClientEventId(`reading-question-${question.questionId}`)
    try { const result = await submitB11ReadingQuestion(question, answer, context(), clientEventId); if (!stillCurrent(owner)) return; readingAttempts.value[String(question.questionId)] = result; readingStatus.value = 'ready'; readingMessage.value = '理解题已由服务端记录。' } catch (error) { if (!stillCurrent(owner)) return; if (isB11OfflineError(error)) { const payload = { questionId: question.questionId, answer, contentVersion: contentVersion(question.contentVersionId) }; const payloadHash = await hashB11Payload(payload); if (!stillCurrent(owner)) return; await enqueueEvent({ clientEventId, entityType: 'READING_QUESTION', entityId: String(question.questionId), entityVersion: 1, operation: 'UPSERT', contentVersion: payload.contentVersion, payloadHash, occurredAt: new Date().toISOString(), payload }); if (!stillCurrent(owner)) return; fail('offline', '理解题答案已保留，服务端尚未判定。', 'reading') } else fail(statusForError(error), errorMessage(error, '理解题提交失败，答案仍保留。'), 'reading') }
    persist()
  }

  async function loadPhonetics(): Promise<void> { const owner = scope(); if (!owner) { reset(); phoneticsStatus.value = 'forbidden'; return }; restore(); phoneticsStatus.value = 'loading'; phoneticsMessage.value = null; try { const remote = await loadB11Phonetics(context()); if (!stillCurrent(owner)) return; phonemes.value = remote; phoneticsStatus.value = phonemes.value.length ? 'ready' : 'empty'; if (!phonemes.value.length) phoneticsMessage.value = '服务端未返回音标目录。' } catch (error) { if (!stillCurrent(owner)) return; fail(statusForError(error), errorMessage(error, '音标服务暂时不可用。'), 'phonetics') } }
  function setPermissionStatus(status: B11PermissionStatus): void { if (!scope()) return; restore(); permissionStatus.value = status; persist() }
  function setRecordingDraft(draft: B11RecordingDraft | null): void { if (!scope()) return; restore(); recordingDraft.value = draft; recordingStatus.value = draft ? draft.status === 'SAVED' ? 'ready' : 'recovering' : 'idle'; persist() }
  function clearRecordingDraft(): void { if (!scope()) return; recordingDraft.value = null; savedRecording.value = null; selfRating.value = null; recordingStatus.value = 'idle'; persist() }
  function setRecordingMessage(message: string | null): void { if (!scope()) return; recordingMessage.value = message }

  async function registerRecordingDraft(): Promise<void> {
    const owner = scope()
    if (!owner) return
    const draft = recordingDraft.value
    if (!draft) { recordingMessage.value = '请先完成一段真实录音。'; return }
    recordingStatus.value = 'loading'; recordingMessage.value = null
    try { const result: B11RecordingResult = await registerB11Recording({ sourceSegmentId: draft.sourceSegmentId, durationMs: draft.durationMs, contentHash: draft.contentHash, storageMode: draft.storageMode, contentVersion: draft.contentVersion, clientEventId: draft.clientEventId }, context()); if (!stillCurrent(owner) || recordingDraft.value !== draft) return; savedRecording.value = result.recording; recordingDraft.value = { ...draft, status: 'SAVED', recordingId: result.recording.recordingId }; recordingStatus.value = 'ready'; recordingMessage.value = '练习记录已保存，录音留在此设备。' } catch (error) { if (!stillCurrent(owner) || recordingDraft.value !== draft) return; if (isB11OfflineError(error)) { const payload = { sourceSegmentId: draft.sourceSegmentId, durationMs: draft.durationMs, contentHash: draft.contentHash, storageMode: draft.storageMode, contentVersion: draft.contentVersion }; const payloadHash = await hashB11Payload(payload); if (!stillCurrent(owner) || recordingDraft.value !== draft) return; await enqueueEvent({ clientEventId: draft.clientEventId, entityType: 'RECORDING', entityId: draft.clientEventId, entityVersion: 1, operation: 'UPSERT', contentVersion: draft.contentVersion, payloadHash, occurredAt: new Date().toISOString(), payload }); if (!stillCurrent(owner)) return; recordingDraft.value = { ...draft, status: 'LOCAL_ONLY' }; recordingStatus.value = 'offline'; recordingMessage.value = '录音已保存在此设备，联网后重试保存练习记录。' } else { recordingDraft.value = { ...draft, status: 'FAILED' }; recordingStatus.value = statusForError(error); recordingMessage.value = errorMessage(error, '录音未登记；本地副本仍保留。') } }
    persist()
  }

  async function removeSavedRecording(): Promise<void> { const owner = scope(); if (!owner || !savedRecording.value) return; const id = savedRecording.value.recordingId; try { await deleteB11Recording(id, context(), createB11ClientEventId(`recording-delete-${id}`)); if (!stillCurrent(owner)) return; clearRecordingDraft(); recordingMessage.value = '服务端已确认删除录音登记。' } catch (error) { if (!stillCurrent(owner)) return; recordingMessage.value = errorMessage(error, '录音删除未获服务端确认。') } }
  async function saveSelfRating(rating: B11SelfRating): Promise<void> {
    const owner = scope()
    if (!owner) return
    selfRating.value = rating
    const draft = recordingDraft.value
    if (!draft) { recordingMessage.value = '请先完成并保留一次真实录音，再提交自评。'; persist(); return }
    const clientEventId = createB11ClientEventId(`self-rating-${draft.recordingId ?? draft.clientEventId}`)
    if (!draft.recordingId) { recordingDraft.value = { ...draft, selfRating: rating }; const payload = { recordingEventId: draft.clientEventId, rating, contentVersion: draft.contentVersion }; const payloadHash = await hashB11Payload(payload); if (!stillCurrent(owner)) return; await enqueueEvent({ clientEventId, entityType: 'SELF_RATING', entityId: draft.clientEventId, entityVersion: 1, operation: 'UPSERT', contentVersion: draft.contentVersion, payloadHash, occurredAt: new Date().toISOString(), payload }); if (!stillCurrent(owner)) return; recordingMessage.value = '自评已保留，待录音登记后同步。'; persist(); return }
    try { await submitB11SelfRating(draft.recordingId, rating, context(), clientEventId, draft.contentVersion); if (!stillCurrent(owner)) return; recordingDraft.value = { ...draft, selfRating: rating }; recordingStatus.value = 'ready'; recordingMessage.value = '自评已保存。' } catch (error) { if (!stillCurrent(owner)) return; if (isB11OfflineError(error)) { const payload = { recordingId: draft.recordingId, rating, contentVersion: draft.contentVersion }; const payloadHash = await hashB11Payload(payload); if (!stillCurrent(owner)) return; await enqueueEvent({ clientEventId, entityType: 'SELF_RATING', entityId: draft.recordingId, entityVersion: 1, operation: 'UPSERT', contentVersion: draft.contentVersion, payloadHash, occurredAt: new Date().toISOString(), payload }); if (!stillCurrent(owner)) return; recordingMessage.value = '自评已保留，联网后同步。' } else recordingMessage.value = errorMessage(error, '自评提交失败，当前选择仍保留。') }
    persist()
  }

  async function completeShadowing(sourceSegmentId: string): Promise<void> {
    const owner = scope()
    if (!owner) return
    const draft = recordingDraft.value
    if (!draft?.recordingId) { recordingMessage.value = '请先由服务端登记录音，再完成影子跟读。'; return }
    try { await completeB11Shadowing({ recordingId: draft.recordingId, sourceSegmentId, contentVersion: draft.contentVersion, clientEventId: createB11ClientEventId(`shadowing-${sourceSegmentId}`) }, context()); if (!stillCurrent(owner)) return; recordingMessage.value = '跟读练习已记录。' } catch (error) { if (!stillCurrent(owner)) return; if (isB11OfflineError(error)) recordingMessage.value = '跟读记录待联网恢复，录音仍在此设备。'; else recordingMessage.value = errorMessage(error, '跟读记录保存失败。') }
  }

  async function syncOffline(): Promise<void> {
    const owner = scope()
    if (!owner) return
    refreshQueue(); const pending = queue.records.filter((item) => item.status === 'PENDING' || item.status === 'FAILED')
    if (!pending.length) return
    const events = pending.map(({ status: _status, attempts: _attempts, lastError: _lastError, queuedAt: _queuedAt, ...event }) => event)
    pending.forEach((item) => queue.markSyncing(item.clientEventId)); refreshQueue()
    try { const result = await syncB11Offline(events, queue.cursor, context(), createB11ClientEventId('offline-sync')); if (!stillCurrent(owner)) return; if (result.acceptedEventIds.length) queue.remove(result.acceptedEventIds); const conflictEventIds = new Set(result.conflicts.map((conflict) => conflict.clientEventId).filter(Boolean)); result.conflicts.forEach((conflict) => { queue.recordConflict(conflict); if (conflict.clientEventId) queue.markFailed(conflict.clientEventId, '服务端版本冲突，等待人工或明确策略恢复。') }); const acceptedEventIds = new Set(result.acceptedEventIds); pending.filter((item) => !acceptedEventIds.has(item.clientEventId) && !conflictEventIds.has(item.clientEventId)).forEach((item) => queue.markFailed(item.clientEventId, '服务端未确认该事件。')); if (result.nextCursor) queue.setCursor(result.nextCursor); refreshQueue(); listeningStatus.value = 'ready'; readingStatus.value = 'ready'; recordingMessage.value = result.conflicts.length ? '同步发现版本冲突，未静默覆盖本地进度。' : '待同步操作已由服务端确认。' } catch (error) { if (!stillCurrent(owner)) return; pending.forEach((item) => queue.markFailed(item.clientEventId, errorMessage(error, '同步请求失败'))); refreshQueue(); const status = statusForError(error); listeningStatus.value = status === 'offline' ? 'offline' : 'recovering'; readingStatus.value = status === 'offline' ? 'offline' : 'recovering'; recordingMessage.value = '同步失败，队列与本地录音副本仍保留。' }
    persist()
  }

  return { restored, performanceLevel, performanceStrategy, motionDisabled, listeningStatus, listeningMessage, listening, mediaProgress, mediaPositionMs, mediaPositionVersion, playbackRate, abStartMs, abEndMs, dictationAnswer, dictationResult, languageClipId, playbackSource, mediaRightsState, languageClips, canUseWaveform, renderMode, readingStatus, readingMessage, reading, readingBlockIndex, readingProgress, readingPositionVersion, currentReadingBlock, readingAnswers, readingAttempts, phoneticsStatus, phoneticsMessage, phonemes, permissionStatus, recordingStatus, recordingMessage, recordingDraft, savedRecording, selfRating, queueRecords, conflicts, queueCount, restore, setPerformance, setMotionDisabled, observeNetwork, refreshQueue, loadListening, setPlaybackRate, setPosition, setABPoint, clearAB, selectLanguageClip, saveMediaProgress, submitDictationAnswer, loadReading, setReadingBlock, saveReadingPosition, submitReadingAnswer, loadPhonetics, setPermissionStatus, setRecordingDraft, clearRecordingDraft, setRecordingMessage, registerRecordingDraft, removeSavedRecording, saveSelfRating, completeShadowing, syncOffline, dispose: () => { performanceUnsubscribe(); engine.dispose() } }
})
