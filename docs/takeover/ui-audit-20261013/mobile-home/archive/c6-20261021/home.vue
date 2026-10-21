<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import AppIcon from '../../components/AppIcon.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { mobileI18n } from '../../platform/v2-foundation'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess, currentMobilePagePath } from '../../auth/navigation'
import type { MobileTask } from '../../domain/learner-content'
import { hasPlacementEntryReached, isPlacementSatisfied, selectOnboardingResumeStep, showOnboardingGuide } from '../../domain/onboarding-resume'
import { isAccessibleContent, shelfSearchState, type EmptyReason, type ShelfSearchState } from '../../domain/plan-today'
import { shelfNote } from '../../domain/content-release'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const { experienceStyle, experienceMotion } = useMobileExperience()
const store = useLearnerContentStore()
const session = useSessionStore()

const courseQuery = ref('')
const busy = ref<string | null>(null)
const navError = ref('')
const accessChecked = ref(false)
const pageVisible = ref(false)
const reading = ref(false)
const guideReady = ref(false)
const searchFocus = ref(false)
const courseJumpFailed = ref(false)
const searchField = ref<{ $el?: HTMLElement } | null>(null)
let pageEpoch = 0
let entrySeq = 0
let actionSeq = 0
let activeEntry: EntryToken | null = null
let enteredEpoch = -1
let pageOwnerKey = ''

const homeLocaleTick = computed(() => mobileT('home.h1'))
function tr(key: string, values?: Record<string, string | number>): string {
  void homeLocaleTick.value
  return mobileI18n.t(`mobile.home.${key}`, values)
}

function ownerKey(): string {
  return session.isAuthenticated && session.verifiedSubject ? `${session.verifiedSubject}:${session.identityRevision}` : ''
}
interface EntryToken { epoch: number; seq: number; owner: string }
interface ActionToken { epoch: number; op: number; owner: string }
function beginAction(): ActionToken {
  return { epoch: pageEpoch, op: ++actionSeq, owner: ownerKey() }
}
function actionCurrent(token: ActionToken): boolean {
  return pageVisible.value && token.epoch === pageEpoch && token.op === actionSeq && token.owner !== '' && token.owner === ownerKey()
}
function entryCurrent(token: EntryToken): boolean {
  return pageVisible.value && token.epoch === pageEpoch && token.seq === entrySeq && token.owner !== '' && token.owner === ownerKey()
}
function invalidatePage(): void {
  pageEpoch += 1
  entrySeq += 1
  actionSeq += 1
  activeEntry = null
  enteredEpoch = -1
  pageOwnerKey = ''
  accessChecked.value = false
  reading.value = false
  busy.value = null
  navError.value = ''
  courseQuery.value = ''
  courseJumpFailed.value = false
  guideReady.value = false
}
function isThenable(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'
}

const homeReady = computed(() => Boolean(store.home) && (store.homeStatus === 'ready' || store.homeStatus === 'empty' || store.homeStatus === 'unavailable'))
const hasConfirmedProgress = computed(() => Boolean(store.home?.tasks.length && store.home.targetMinutes > 0 && !store.home.stale))
const progressPercent = computed(() => {
  if (!hasConfirmedProgress.value || !store.home) return null
  return Math.min(100, store.home.completedMinutes / store.home.targetMinutes * 100)
})
const progressValue = computed(() => progressPercent.value === null ? 0 : Math.round(progressPercent.value))
const progressText = computed(() => {
  if (!hasConfirmedProgress.value || !store.home) return tr('progressUnknown')
  return tr('progress', { done: store.home.completedMinutes, target: store.home.targetMinutes })
})

const publishedContent = computed(() => (store.home?.content ?? []).filter((item) => isAccessibleContent(item)))
const visibleContent = computed(() => {
  const needle = courseQuery.value.trim().toLowerCase()
  return publishedContent.value.filter((item) => !needle || `${item.title} ${item.summary}`.toLowerCase().includes(needle))
})
const releaseNote = computed(() => shelfNote(publishedContent.value))
const contentUnavailable = computed(() => store.home?.contentStatus === 'UNAVAILABLE')
const shelf = computed((): ShelfSearchState => shelfSearchState(
  publishedContent.value.length,
  visibleContent.value.length,
  contentUnavailable.value,
))
const resultCount = computed(() => tr('resultCount', { count: visibleContent.value.length, total: publishedContent.value.length }))

function isActionable(task: MobileTask): boolean {
  return (task.status === 'AVAILABLE' || task.status === 'IN_PROGRESS') && Boolean(task.contentCode)
}
const firstTaskId = computed(() => store.home?.tasks.find(isActionable)?.id ?? '')
function isFirstTask(task: MobileTask): boolean { return task.id === firstTaskId.value && isActionable(task) }
function primaryLabel(task: MobileTask): string { return task.status === 'IN_PROGRESS' ? tr('continueLearning') : tr('startLearning') }
function secondaryLabel(task: MobileTask): string { return task.status === 'IN_PROGRESS' ? tr('continueShort') : tr('viewShort') }
function taskMeta(task: MobileTask): string {
  if (task.status === 'UNAVAILABLE') return ''
  return task.minutes > 0 ? tr('minutes', { count: task.minutes }) : ''
}
function taskDescription(task: MobileTask): string {
  if (task.status === 'UNAVAILABLE' && task.description === (task.unavailableReason ?? '')) return ''
  return task.description
}
function stateLabel(task: MobileTask): string {
  if (task.status === 'COMPLETED') return tr('statusCompleted')
  if (task.status === 'LOCKED') return tr('statusLocked')
  return task.unavailableReason || tr('statusUnavailable')
}
function stateIcon(task: MobileTask): 'check' | 'lock' | 'x' {
  if (task.status === 'COMPLETED') return 'check'
  if (task.status === 'LOCKED') return 'lock'
  return 'x'
}

const PLAN_CONFLICT_NOTICE = '计划版本已变化，请重新读取。'
const PLAN_REPLAN_NOTICE = '目标已保存。计划还没有按新目标重排。'
const planExplanation = computed(() => store.planQueue?.explanation ?? null)
const planNoticeText = computed(() => {
  const notice = store.planNotice
  if (!notice) return ''
  if (notice === PLAN_CONFLICT_NOTICE) return tr('planConflict')
  if (notice === PLAN_REPLAN_NOTICE) return tr('planReplanFailed')
  return notice
})
const firstLearningText = computed(() => {
  const first = store.planQueue?.firstLearning
  if (!first?.guideVisible) return ''
  if (first.reason === 'NO_PLAN') return tr('fl.noPlan')
  if (first.reason === 'NO_CONTENT') return tr('fl.noContent')
  if (first.reason === 'INCOMPLETE') return tr('fl.incomplete')
  return ''
})

function emptyCopy(reason: EmptyReason | null): { title: string; description: string; action: string; to: 'onboarding' | 'courses' } | null {
  const hasCourses = publishedContent.value.length > 0
  switch (reason) {
    case 'NO_PLAN':
      return { title: tr('empty.noPlan.title'), description: tr('empty.noPlan.description'), action: tr('empty.noPlan.action'), to: 'onboarding' }
    case 'COMPLETED':
      return { title: tr('empty.completed.title'), description: tr('empty.completed.description'), action: hasCourses ? tr('empty.completed.action') : '', to: 'courses' }
    case 'NO_CONTENT':
      return { title: tr('empty.noContent.title'), description: tr('empty.noContent.description'), action: hasCourses ? tr('empty.noContent.action') : '', to: 'courses' }
    case 'NO_DUE_REVIEW':
      return { title: tr('empty.noReview.title'), description: tr('empty.noReview.description'), action: hasCourses ? tr('empty.noReview.action') : '', to: 'courses' }
    default:
      return null
  }
}
const planSettled = computed(() => store.planQueueStatus === 'ready' || store.planQueueStatus === 'empty' || store.planQueueStatus === 'error')
const planReadFailed = computed(() => store.planQueueStatus === 'error')
const planEmpty = computed(() => {
  if (!store.home || store.home.tasks.length) return null
  if (store.planQueueStatus !== 'ready' && store.planQueueStatus !== 'empty') return null
  return emptyCopy(store.planQueue?.emptyReason ?? null)
})
const showNoTasks = computed(() => Boolean(store.home) && !store.home?.tasks.length && planSettled.value && !planReadFailed.value && !planEmpty.value)

const guideStep = computed(() => store.onboardingResume ? selectOnboardingResumeStep(store.onboardingResume) : null)
const placementDone = computed(() => {
  const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage
  return isPlacementSatisfied({
    placementEntryReached: hasPlacementEntryReached(storage, session.verifiedSubject),
    planId: store.planQueue?.planId ?? null,
  })
})
const serverPlacementUnknown = computed(() => {
  const homePending = store.homeStatus === 'idle' || store.homeStatus === 'loading'
  const planPending = store.planQueueStatus === 'idle' || store.planQueueStatus === 'loading'
  return homePending || planPending
})
const guideVisible = computed(() => {
  if (!accessChecked.value || !pageVisible.value || !session.isAuthenticated || !guideReady.value) return false
  const facts = store.onboardingResume
  if (!facts || session.adultGate === 'REJECTED') return false
  return showOnboardingGuide(facts, placementDone.value, { serverPlacementUnknown: serverPlacementUnknown.value })
})
const guideLabel = computed(() => {
  const step = guideStep.value
  return step && step !== 'rejected' ? tr(`guideLabel.${step}`) : ''
})
const guideStepsText = computed(() => {
  const step = guideStep.value
  return step && step !== 'rejected' ? tr(`stepsText.${step}`) : ''
})
const guidePath = computed(() => guideStep.value === 'assessment' ? '/pages/assessment/assessment' : '/pages/onboarding/onboarding')
const secondaryVisible = computed(() => accessChecked.value && session.isAuthenticated && (store.homeStatus === 'ready' || store.homeStatus === 'empty' || store.homeStatus === 'unavailable'))

const statusMessages = computed(() => {
  const skip = new Set<string>()
  if (guideVisible.value) {
    skip.add(guideLabel.value)
    skip.add(guideStepsText.value)
    skip.add(tr('guideAction'))
    skip.add(tr('guideRemaining', { steps: guideStepsText.value }))
  }
  const seen = new Set<string>()
  const list: Array<{ id: string; text: string }> = []
  for (const [id, value] of [['explanation', planExplanation.value ?? ''], ['notice', planNoticeText.value], ['first', firstLearningText.value]] as const) {
    const text = value.trim()
    if (!text || seen.has(text) || skip.has(text)) continue
    seen.add(text)
    list.push({ id, text })
  }
  return list
})

async function loadGuide(token: EntryToken): Promise<void> {
  guideReady.value = false
  if (!entryCurrent(token) || session.adultGate === 'REJECTED' || typeof store.loadOnboardingResume !== 'function') return
  try {
    await store.loadOnboardingResume()
    if (entryCurrent(token)) guideReady.value = true
  } catch {
    if (entryCurrent(token)) guideReady.value = false
  }
}

async function runEntry(): Promise<void> {
  if (!pageVisible.value) return
  const key = ownerKey()
  if (!key) {
    accessChecked.value = false
    return
  }
  // Only one live attempt per epoch; a new epoch may supersede it immediately.
  if (activeEntry && activeEntry.epoch === pageEpoch && activeEntry.owner === key) return
  const token: EntryToken = { epoch: pageEpoch, seq: ++entrySeq, owner: key }
  activeEntry = token
  accessChecked.value = false
  reading.value = false
  let allowed = false
  try { allowed = await ensureMobilePageAccess('/pages/home/home') } catch { allowed = false }
  if (!entryCurrent(token) || !allowed) {
    if (activeEntry?.seq === token.seq) activeEntry = null
    if (!allowed && pageVisible.value && ownerKey() === key) return
    maybeEnter()
    return
  }
  accessChecked.value = true
  pageOwnerKey = key
  reading.value = true
  try {
    await store.loadHome()
    if (entryCurrent(token)) await loadGuide(token)
  } finally {
    if (entryCurrent(token)) {
      reading.value = false
      enteredEpoch = pageEpoch
      activeEntry = null
    } else if (activeEntry?.seq === token.seq) {
      activeEntry = null
    }
    if (pageVisible.value && ownerKey() !== key) maybeEnter()
  }
}

function maybeEnter(): void {
  if (!pageVisible.value) return
  const key = ownerKey()
  if (!key) return
  if (accessChecked.value && pageOwnerKey === key && enteredEpoch === pageEpoch && !reading.value) return
  if (activeEntry && activeEntry.epoch === pageEpoch && activeEntry.owner === key) return
  void runEntry()
}

async function navigate(url: string, key: string): Promise<void> {
  if (busy.value) return
  const token = beginAction()
  busy.value = key
  navError.value = ''
  try {
    const result = openUniPage(url)
    if (isThenable(result)) await result
  } catch {
    if (actionCurrent(token) && currentMobilePagePath() === '/pages/home/home') navError.value = tr('navFailed')
  } finally {
    if (actionCurrent(token)) busy.value = null
  }
}

function focusCourseHeading(): void {
  // #ifdef H5
  document.getElementById('course-heading')?.focus({ preventScroll: true })
  // #endif
  // #ifndef H5
  searchFocus.value = true
  // #endif
}

function scrollToCourses(): void {
  courseJumpFailed.value = false
  const epoch = pageEpoch
  const owner = ownerKey()
  const onPage = (): boolean => pageVisible.value && epoch === pageEpoch && owner !== '' && owner === ownerKey()
  const reduceMotion = experienceMotion.value !== 'on'
  const duration = reduceMotion ? 0 : 250
  const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth'
  const domFallback = (): boolean => {
    if (!onPage()) return false
    try {
      if (typeof document === 'undefined') return false
      const target = document.getElementById('course-shelf')
      if (!target) return false
      target.scrollIntoView({ behavior, block: 'start' })
      focusCourseHeading()
      return true
    } catch { return false }
  }
  try {
    const runtime = getUniRuntime() as unknown as { pageScrollTo?: (options: { selector?: string; duration?: number; success?: () => void; fail?: () => void }) => void }
    if (typeof runtime.pageScrollTo === 'function') {
      runtime.pageScrollTo({ selector: '#course-shelf', duration, success: () => { if (onPage()) focusCourseHeading() }, fail: () => { if (onPage() && !domFallback()) courseJumpFailed.value = true } })
      return
    }
  } catch { /* fall through to the DOM path */ }
  if (onPage() && !domFallback()) courseJumpFailed.value = true
}

async function runPlanEmpty(): Promise<void> {
  const view = planEmpty.value
  if (!view || busy.value) return
  if (view.to === 'onboarding') { await navigate('/pages/onboarding/onboarding', 'empty'); return }
  scrollToCourses()
}

function openTask(task: MobileTask): void {
  if (!isActionable(task) || !task.contentCode || busy.value) return
  void navigate(`/pages/learn/learn?contentCode=${encodeURIComponent(task.contentCode)}&taskId=${encodeURIComponent(task.id)}`, `task-${task.id}`)
}

function openCourse(contentCode: string): void {
  if (busy.value) return
  void navigate(`/pages/learn/learn?contentCode=${encodeURIComponent(contentCode)}`, `course-${contentCode}`)
}

function onCourseInput(event: unknown): void {
  const detail = (event as { detail?: { value?: unknown } } | null)?.detail
  courseQuery.value = typeof detail?.value === 'string' ? detail.value : ''
}

function focusSearchInput(): void {
  const epoch = pageEpoch
  const owner = ownerKey()
  searchFocus.value = false
  void nextTick(() => {
    if (pageVisible.value && epoch === pageEpoch && owner !== '' && owner === ownerKey()) searchFocus.value = true
  })
}

function clearSearch(): void {
  courseQuery.value = ''
  focusSearchInput()
}

function syncSearchAccessibility(): void {
  // #ifdef H5
  if (!pageVisible.value || !accessChecked.value) return
  const host = searchField.value?.$el
  if (!host) return
  const input = host.matches('input') ? host as HTMLInputElement : host.querySelector<HTMLInputElement>('.uni-input-input, input')
  if (!input) return
  input.setAttribute('aria-label', tr('searchLabel'))
  input.setAttribute('placeholder', tr('searchPlaceholder'))
  input.setAttribute('type', 'search')
  input.setAttribute('autocomplete', 'off')
  // #endif
}

async function retryHome(): Promise<void> {
  if (busy.value) return
  const action = beginAction()
  busy.value = 'retry'
  reading.value = true
  const key = ownerKey()
  if (!key) {
    reading.value = false
    if (actionCurrent(action)) busy.value = null
    return
  }
  const token: EntryToken = { epoch: pageEpoch, seq: ++entrySeq, owner: key }
  activeEntry = token
  try {
    await store.loadHome()
    if (entryCurrent(token)) await loadGuide(token)
  } finally {
    if (entryCurrent(token)) {
      reading.value = false
      enteredEpoch = pageEpoch
      if (activeEntry?.seq === token.seq) activeEntry = null
    } else if (activeEntry?.seq === token.seq) {
      activeEntry = null
    }
    if (actionCurrent(action)) busy.value = null
  }
}

async function retryPlan(): Promise<void> {
  if (busy.value) return
  const action = beginAction()
  busy.value = 'plan'
  try {
    // Keep the existing owner/scope default; the optional predicate drops a
    // late plan read that belongs to an older epoch/owner/action.
    await store.refreshPlanQueue(undefined, () => actionCurrent(action))
  } finally {
    if (actionCurrent(action)) busy.value = null
  }
}

onShow(() => {
  pageVisible.value = true
  pageEpoch += 1
  entrySeq += 1
  actionSeq += 1
  activeEntry = null
  enteredEpoch = -1
  accessChecked.value = false
  reading.value = false
  guideReady.value = false
  busy.value = null
  navError.value = ''
  courseJumpFailed.value = false
  maybeEnter()
})

function leavePage(): void {
  pageVisible.value = false
  pageEpoch += 1
  entrySeq += 1
  actionSeq += 1
  activeEntry = null
  enteredEpoch = -1
  reading.value = false
  busy.value = null
  guideReady.value = false
  accessChecked.value = false
}

onHide(leavePage)
onBeforeUnmount(leavePage)

watch(() => session.identityRevision, () => {
  invalidatePage()
  maybeEnter()
}, { flush: 'sync' })

watch(() => session.status, (status) => {
  if (status === 'authenticated') maybeEnter()
})

watch(homeLocaleTick, () => {
  void nextTick(syncSearchAccessibility)
})

watch([accessChecked, reading], ([checked, isLoading]) => {
  if (checked && !isLoading) void nextTick(syncSearchAccessibility)
})

onMounted(() => {
  void nextTick(syncSearchAccessibility)
})
</script>

<template>
  <view class="yx-page home-page" :style="experienceStyle" :data-motion="experienceMotion">
    <view class="home-topbar">
      <text class="home-brand">{{ mobileT('brand') }}</text>
      <button tabindex="0" role="button" type="button" class="home-settings" :aria-label="mobileT('settings')" :disabled="busy !== null || reading" @click="navigate('/pages/settings/settings', 'settings')">
        <AppIcon name="gear" :size="22" />
      </button>
    </view>

    <text class="home-title" role="heading" aria-level="1">{{ tr('h1') }}</text>

    <view v-if="!accessChecked" class="home-line" role="status"><text>{{ tr('checking') }}</text></view>

    <template v-else>
      <view v-if="!session.isAuthenticated" class="home-line" role="status">
        <text>{{ tr('loginNote') }}</text>
        <button tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="navigate('/pages/login/login', 'login')">{{ tr('loginAction') }}</button>
      </view>

      <template v-else>
        <view v-if="reading || store.homeStatus === 'idle' || store.homeStatus === 'loading'" class="home-line" role="status"><text>{{ tr('loading') }}</text></view>

        <view v-else-if="store.homeStatus === 'offline' || store.homeStatus === 'error'" class="home-block" role="alert">
          <text class="home-block__title">{{ tr('errorTitle') }}</text>
          <text class="home-block__desc">{{ tr('errorHint') }}</text>
          <button tabindex="0" role="button" type="button" class="home-ghost" :disabled="busy !== null" @click="retryHome">{{ tr('retry') }}</button>
        </view>

        <view v-else-if="store.homeStatus === 'forbidden'" class="home-block" role="alert">
          <text class="home-block__title">{{ tr('forbiddenTitle') }}</text>
          <text class="home-block__desc">{{ tr('forbiddenDesc') }}</text>
        </view>

        <template v-else>
          <view v-if="navError" class="home-line home-line--error" role="alert"><text>{{ navError }}</text></view>

          <view v-if="homeReady" class="home-progress">
            <text class="home-progress__text">{{ progressText }}</text>
            <view
              v-if="progressPercent !== null"
              class="home-progress__track"
              role="progressbar"
              :aria-label="tr('progressLabel')"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="progressValue"
            >
              <view class="home-progress__value" :style="{ width: `${progressPercent}%` }"></view>
            </view>
          </view>

          <view v-if="statusMessages.length" class="home-status">
            <text v-for="message in statusMessages" :key="message.id" class="home-status__line" role="status">{{ message.text }}</text>
          </view>

          <view v-if="guideVisible" class="home-guide">
            <text class="home-guide__label">{{ guideLabel }}</text>
            <text v-if="guideStepsText" class="home-guide__steps">{{ tr('guideRemaining', { steps: guideStepsText }) }}</text>
            <button tabindex="0" role="button" type="button" class="home-ghost" :disabled="busy !== null" @click="navigate(guidePath, 'guide')">{{ tr('guideAction') }}</button>
          </view>

          <view class="home-section">
            <view class="home-section__head">
              <text class="home-section__title" role="heading" aria-level="2">{{ tr('tasks') }}</text>
              <text class="home-section__count">{{ tr('taskCount', { count: store.home?.tasks.length ?? 0 }) }}</text>
            </view>

            <view v-if="planReadFailed" class="home-line home-line--error" role="alert">
              <text>{{ tr('planReadFailed') }}</text>
              <button tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="retryPlan">{{ tr('retry') }}</button>
            </view>

            <view v-if="planEmpty" class="home-empty">
              <text class="home-empty__title">{{ planEmpty.title }}</text>
              <text class="home-empty__desc">{{ planEmpty.description }}</text>
              <button v-if="planEmpty.action" tabindex="0" role="button" type="button" class="home-ghost" :disabled="busy !== null" @click="runPlanEmpty">{{ planEmpty.action }}</button>
            </view>

            <view v-else-if="showNoTasks" class="home-empty">
              <text class="home-empty__desc">{{ tr('noTasks') }}</text>
              <text v-if="publishedContent.length" class="home-empty__desc">{{ tr('noTasksHint') }}</text>
            </view>

            <template v-else-if="store.home?.tasks.length">
              <view v-for="task in store.home.tasks" :key="task.id" class="home-task" :class="{ 'home-task--first': isFirstTask(task) }">
                <view class="home-task__copy">
                  <text class="home-task__title">{{ task.title }}</text>
                  <text v-if="taskMeta(task)" class="home-task__meta">{{ taskMeta(task) }}</text>
                  <text v-if="taskDescription(task)" class="home-task__desc">{{ taskDescription(task) }}</text>
                </view>
                <button
                  v-if="isFirstTask(task)"
                  tabindex="0"
                  role="button"
                  type="button"
                  class="home-primary home-task__primary"
                  :disabled="busy !== null"
                  @click="openTask(task)"
                >{{ primaryLabel(task) }}</button>
                <button
                  v-else-if="isActionable(task)"
                  tabindex="0"
                  role="button"
                  type="button"
                  class="home-ghost home-task__secondary"
                  :disabled="busy !== null"
                  @click="openTask(task)"
                >{{ secondaryLabel(task) }}</button>
                <view v-else class="home-task__state">
                  <AppIcon :name="stateIcon(task)" :size="16" />
                  <text>{{ stateLabel(task) }}</text>
                </view>
              </view>
            </template>
          </view>

          <view id="course-shelf" class="home-section">
            <text id="course-heading" class="home-section__title" role="heading" aria-level="2" tabindex="-1">{{ tr('courses') }}</text>
            <view class="home-search">
              <AppIcon name="search" :size="18" />
              <input
                ref="searchField"
                class="home-search__input"
                type="search"
                placeholder-style="color: var(--yx-text-secondary); opacity: 1; font-family: inherit; font-size: inherit; font-weight: inherit;"
                :value="courseQuery"
                :focus="searchFocus"
                :aria-label="tr('searchLabel')"
                :placeholder="tr('searchPlaceholder')"
                @input="onCourseInput"
                @blur="searchFocus = false"
              />
              <button v-if="courseQuery" tabindex="0" role="button" type="button" class="home-search__clear" :aria-label="tr('searchClear')" @click="clearSearch">
                <AppIcon name="x" :size="16" />
              </button>
            </view>
            <text v-if="courseQuery.trim()" class="home-search__count">{{ resultCount }}</text>
            <view v-if="courseJumpFailed" class="home-line home-line--error" role="status"><text>{{ tr('coursesJumpFailed') }}</text></view>
            <text v-if="releaseNote" class="home-note">{{ releaseNote }}</text>

            <view v-if="contentUnavailable" class="home-line home-line--error" role="alert">
              <text>{{ tr('shelfUnavailable') }}</text>
              <button tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="retryHome">{{ tr('retry') }}</button>
            </view>
            <view v-else-if="shelf === 'error'" class="home-line home-line--error" role="alert">
              <text>{{ tr('shelfError') }}</text>
              <button tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="retryHome">{{ tr('retry') }}</button>
            </view>
            <view v-else-if="shelf === 'catalog-empty'" class="home-line"><text>{{ tr('catalogEmpty') }}</text></view>
            <view v-else-if="shelf === 'no-matches'" class="home-line"><text>{{ tr('noMatches') }}</text></view>
            <view v-else class="home-course-list">
              <button
                v-for="item in visibleContent"
                :key="item.contentCode"
                tabindex="0"
                role="button"
                type="button"
                class="home-course"
                :disabled="busy !== null"
                @click="openCourse(item.contentCode)"
              >
                <view class="home-course__copy">
                  <text class="home-course__title">{{ item.title }}</text>
                  <text class="home-course__desc">{{ item.summary || tr('noSummary') }}</text>
                </view>
                <AppIcon name="chev" :size="16" />
              </button>
            </view>
          </view>

          <button tabindex="0" role="button" type="button" class="home-navrow" :disabled="busy !== null" @click="navigate('/pages/b10-report/b10-report', 'mistakes')">
            <view class="home-navrow__copy">
              <text class="home-navrow__title">{{ tr('mistakes') }}</text>
              <text class="home-navrow__desc">{{ tr('mistakesDesc') }}</text>
            </view>
            <AppIcon name="chev" :size="16" />
          </button>

          <view v-if="secondaryVisible" class="home-secondary-row">
            <button tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="navigate('/pages/onboarding/onboarding', 'goal')">{{ tr('changeGoal') }}</button>
            <button tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="navigate('/pages/assessment/assessment', 'assessment')">{{ tr('takeAssessment') }}</button>
          </view>
        </template>
      </template>
    </template>
  </view>
</template>

<style scoped>
/* Global `.yx-page.yx-page` (0,2,0) sets 860px width and 22px padding. The
 * :root context raises this local selector one level so the page owns its
 * 720px reading line without duplicating the page class. */
:root .home-page {
  max-width: 720px;
  padding-left: 20px;
  padding-right: 20px;
  font-family: var(--v2-font);
}
.home-page button,
.home-page input {
  font-family: var(--v2-font);
}
.home-topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 44px; }
.home-brand { color: var(--yx-text-primary); font-size: 15px; font-weight: 650; line-height: 1.5; letter-spacing: .01em; }
.home-settings { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; min-height: 44px; padding: 0; border: 1px solid var(--yx-text-secondary); border-radius: 50%; background: var(--yx-surface-card); color: var(--yx-text-primary); }
.home-settings[disabled] { opacity: .55; }
.home-title { display: block; margin: 20px 0 8px; color: var(--yx-text-primary); font-size: 28px; font-weight: 650; line-height: 1.4; letter-spacing: -.01em; overflow-wrap: break-word; word-break: normal; }
.home-progress { display: grid; gap: 10px; margin: 0 0 8px; }
.home-progress__text { color: var(--yx-text-secondary); font-size: 16px; line-height: 1.5; overflow-wrap: break-word; }
.home-progress__track { width: 100%; height: 8px; overflow: hidden; border-radius: 999px; background: var(--yx-surface-soft); }
.home-progress__value { height: 100%; border-radius: inherit; background: var(--yx-brand); }
.home-line { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 0; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; overflow-wrap: break-word; }
.home-line--error { color: var(--yx-danger); }
.home-block { display: grid; justify-items: start; gap: 8px; padding: 20px 0; }
.home-block__title { color: var(--yx-text-primary); font-size: 16px; font-weight: 650; line-height: 1.5; }
.home-block__desc { color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; }
.home-status { display: grid; gap: 6px; margin: 12px 0 0; }
.home-status__line { display: block; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; overflow-wrap: break-word; }
.home-guide { display: grid; justify-items: start; gap: 6px; margin: 12px 0 0; padding: 14px 0; border-top: 1px solid var(--yx-border); border-bottom: 1px solid var(--yx-border); }
.home-guide__label { color: var(--yx-text-primary); font-size: 16px; font-weight: 650; line-height: 1.5; }
.home-guide__steps { color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; }
.home-section { margin-top: 32px; }
.home-section__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.home-section__title { display: block; color: var(--yx-text-primary); font-size: 20px; font-weight: 650; line-height: 1.45; }
.home-section__title:focus-visible { outline: 2px solid var(--yx-focus); outline-offset: 2px; }
.home-section__count { color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; }
.home-empty { display: grid; justify-items: start; gap: 6px; padding: 16px 0; }
.home-empty__title { color: var(--yx-text-primary); font-size: 16px; font-weight: 650; line-height: 1.5; }
.home-empty__desc { color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; overflow-wrap: break-word; }
.home-task { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 20px 0; border-top: 1px solid var(--yx-border); }
.home-task__copy { flex: 1 1 240px; min-width: 0; }
.home-task__title { display: block; color: var(--yx-text-primary); font-size: 16px; font-weight: 650; line-height: 1.5; overflow-wrap: break-word; word-break: normal; }
.home-task__meta { display: block; margin-top: 4px; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; }
.home-task__desc { display: block; margin-top: 4px; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; overflow-wrap: break-word; }
.home-task__state { display: inline-flex; flex: 0 1 auto; align-items: center; gap: 6px; max-width: 100%; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; overflow-wrap: break-word; }
.home-task--first { align-items: stretch; }
.home-task--first .home-task__copy { flex-basis: 100%; }
.home-primary, .home-ghost { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: var(--yx-radius-button); font-family: inherit; font-weight: 650; line-height: 1.5; text-align: center; overflow-wrap: break-word; }
.home-primary { min-height: 48px; padding: 12px 18px; border: 1px solid transparent; background: var(--yx-action); color: var(--yx-on-brand); font-size: 16px; }
.home-task__primary { flex: 1 1 100%; width: 100%; }
.home-ghost { min-height: 44px; padding: 10px 16px; border: 1px solid var(--yx-text-secondary); background: var(--yx-surface-card); color: var(--yx-brand); font-size: 16px; white-space: normal; }
.home-task__secondary { flex: 0 0 auto; }
.home-primary[disabled], .home-ghost[disabled], .home-text-action[disabled], .home-course[disabled], .home-navrow[disabled] { opacity: .55; }
.home-search { display: flex; align-items: center; gap: 8px; box-sizing: border-box; margin-top: 12px; padding: 0 8px 0 12px; min-height: 48px; border: 1px solid var(--yx-text-secondary); border-radius: 12px; background: var(--yx-surface-card); color: var(--yx-text-secondary); }
.home-search__input { flex: 1 1 auto; min-width: 0; height: auto; min-height: 46px; padding: 10px 0; border: 0; border-radius: 0; background: transparent; color: var(--yx-text-primary); font-size: 16px; line-height: 1.5; }
.home-search__input:focus-visible { outline: none; }
/* uni-h5 renders its own placeholder overlay inside the input component and
 * the native input has a UA ::placeholder. Both must use the semantic
 * secondary text color; host-only CSS leaves the inner placeholder gray. */
.home-search :deep(.uni-input-placeholder) {
  color: var(--yx-text-secondary);
  opacity: 1;
  font: inherit;
}
/* uni compiles `input` in a deep selector to `uni-input`, which never matches
 * the real native input. Target uni's own internal input class instead. */
.home-search :deep(.uni-input-input::placeholder) {
  color: var(--yx-text-secondary);
  opacity: 1;
  font: inherit;
}
.home-search:focus-within { outline: 2px solid var(--yx-focus); outline-offset: 2px; }
.home-search__clear { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 44px; height: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--yx-text-secondary); }
.home-search__count { display: block; margin-top: 8px; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; }
.home-note { display: block; margin-top: 8px; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; overflow-wrap: break-word; }
.home-course-list { margin-top: 12px; border-top: 1px solid var(--yx-border); }
.home-course { display: flex; align-items: center; gap: 12px; box-sizing: border-box; width: 100%; min-height: 64px; padding: 16px 0; border: 0; border-bottom: 1px solid var(--yx-border); border-radius: 0; background: transparent; color: var(--yx-text-secondary); text-align: left; }
.home-course__copy { flex: 1 1 auto; min-width: 0; }
.home-course__title { display: block; color: var(--yx-text-primary); font-size: 16px; font-weight: 650; line-height: 1.5; overflow-wrap: break-word; word-break: normal; }
.home-course__desc { display: block; margin-top: 2px; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; overflow-wrap: break-word; }
.home-navrow { display: flex; align-items: center; gap: 12px; box-sizing: border-box; width: 100%; min-height: 72px; margin-top: 32px; padding: 16px 0; border: 0; border-top: 1px solid var(--yx-border); border-bottom: 1px solid var(--yx-border); border-radius: 0; background: transparent; color: var(--yx-text-secondary); text-align: left; }
.home-navrow__copy { flex: 1 1 auto; min-width: 0; }
.home-navrow__title { display: block; color: var(--yx-text-primary); font-size: 16px; font-weight: 650; line-height: 1.5; }
.home-navrow__desc { display: block; margin-top: 2px; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; }
.home-secondary-row { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--yx-border); }
.home-text-action { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 4px; border: 0; border-radius: var(--yx-radius-button); background: transparent; color: var(--yx-brand); font-size: 16px; font-weight: 650; line-height: 1.5; text-align: center; overflow-wrap: break-word; }
.home-settings:focus-visible, .home-primary:focus-visible, .home-ghost:focus-visible, .home-text-action:focus-visible, .home-course:focus-visible, .home-navrow:focus-visible, .home-search__clear:focus-visible { outline: 2px solid var(--yx-focus); outline-offset: 2px; }
@media (max-width: 360px) {
  .home-task__copy { flex-basis: 100%; }
  .home-task__secondary { margin-left: auto; }
}
</style>
