// Resume facts for BC-011. Step choice uses IAM adult gate, IAM consent and
// GET /learner/targets only. First-day blockers and registration time are not inputs.

export type OnboardingResumeStep = 'rejected' | 'gate' | 'consent' | 'goal' | 'assessment'

export type UiTargetGoal = 'ZERO_BASIS' | 'CET_4_6' | 'POSTGRADUATE' | 'WORKPLACE_DAILY'

const LEARNING_CONSENT_PURPOSES = ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'] as const

export interface OnboardingConsentFact {
  readable: boolean
  accepted: boolean | null
  unsatisfiedPurposes: readonly string[]
}

export interface OnboardingTargetFact {
  readable: boolean
  saved: boolean
  goal: UiTargetGoal | null
  quota: number | null
}

export interface OnboardingResumeFacts {
  adultGate: string
  consent: OnboardingConsentFact
  target: OnboardingTargetFact
}

export const ONBOARDING_GUIDE_ACTION = '继续设置，开始学习'

export function mapUiGoal(value: string | null | undefined): UiTargetGoal | null {
  switch (value) {
    case 'FOUNDATION':
    case 'ZERO_BASIS':
      return 'ZERO_BASIS'
    case 'COLLEGE_CET':
    case 'CET_4_6':
      return 'CET_4_6'
    case 'POSTGRADUATE_ENGLISH':
    case 'POSTGRADUATE':
      return 'POSTGRADUATE'
    case 'WORKPLACE_DAILY':
    case 'WORKPLACE':
      return 'WORKPLACE_DAILY'
    default:
      return null
  }
}

export function requiredConsentsComplete(consent: OnboardingConsentFact): boolean {
  if (!consent.readable || consent.accepted !== true) return false
  return !consent.unsatisfiedPurposes.some((item) => (LEARNING_CONSENT_PURPOSES as readonly string[]).includes(item))
}

export function selectOnboardingResumeStep(facts: OnboardingResumeFacts): OnboardingResumeStep {
  if (facts.adultGate === 'REJECTED') return 'rejected'
  if (facts.adultGate !== 'PASSED') return 'gate'
  if (!requiredConsentsComplete(facts.consent)) return 'consent'
  if (!facts.target.readable || !facts.target.saved) return 'goal'
  return 'assessment'
}

export function onboardingProgressLabel(facts: OnboardingResumeFacts): string {
  const step = selectOnboardingResumeStep(facts)
  if (step === 'rejected') return '当前版本暂不能向你开放学习'
  if (step === 'gate') return '还需要确认成人身份'
  if (step === 'consent') return facts.consent.readable ? '还需要完成必要同意' : '必要同意暂时无法读取'
  if (step === 'goal') return facts.target.readable ? '还需要保存学习目标' : '学习目标暂时无法读取'
  return '目标已保存，下一步进入定级'
}

/**
 * Placement is done when the server already has a learning plan (or report-backed
 * plan id), or when this browser session has already opened the assessment entry.
 * Prefer server state; the session flag is only a graceful fallback for a brief
 * window before home/plan hydrate.
 */
export function isPlacementSatisfied(input: {
  placementEntryReached?: boolean
  planId?: string | null
  hasPlan?: boolean
} = {}): boolean {
  if (input.placementEntryReached) return true
  if (input.hasPlan) return true
  return Boolean(input.planId && String(input.planId).trim())
}

export function showOnboardingGuide(
  facts: OnboardingResumeFacts,
  placementDone: boolean,
  options: { serverPlacementUnknown?: boolean } = {},
): boolean {
  const step = selectOnboardingResumeStep(facts)
  if (step === 'rejected') return false
  if (step !== 'assessment') return true
  // Avoid flashing 「剩余步骤：定级」 while home/plan is still loading.
  if (options.serverPlacementUnknown && !placementDone) return false
  return !placementDone
}

export function placementEntryStorageKey(subject: string): string {
  return `yx.onboarding.placement-entry.${subject}`
}

export function markPlacementEntryReached(
  storage: { setItem(key: string, value: string): void } | null | undefined,
  subject: string | null | undefined,
): void {
  if (!storage || !subject) return
  try { storage.setItem(placementEntryStorageKey(subject), '1') } catch { /* the route marker is optional */ }
}

export function hasPlacementEntryReached(
  storage: { getItem(key: string): string | null } | null | undefined,
  subject: string | null | undefined,
): boolean {
  if (!storage || !subject) return false
  try { return storage.getItem(placementEntryStorageKey(subject)) === '1' } catch { return false }
}

// GET /learner/targets publishes these codes. learner_goal.goal_type still stores
// historical aliases such as CET_4_6; the form must not show that stored alias.
export type CanonicalTargetGoal = 'FOUNDATION' | 'COLLEGE_CET' | 'POSTGRADUATE_ENGLISH' | 'WORKPLACE_DAILY'

const CANONICAL_GOAL_ORDER: readonly CanonicalTargetGoal[] = ['FOUNDATION', 'COLLEGE_CET', 'POSTGRADUATE_ENGLISH', 'WORKPLACE_DAILY']

const CANONICAL_GOAL_COPY: Record<CanonicalTargetGoal, { label: string; description: string }> = {
  FOUNDATION: { label: '成人零基础', description: '从发音、核心词和短句开始建立基础。' },
  COLLEGE_CET: { label: '四六级备考', description: '围绕词汇、听力与真题节奏推进。' },
  POSTGRADUATE_ENGLISH: { label: '考研英语', description: '强化长难句、阅读和高频表达。' },
  WORKPLACE_DAILY: { label: '职场与日常', description: '优先处理会话、场景和邮件表达。' },
}

const GOAL_CODE_TEXT = new Set<string>([
  ...CANONICAL_GOAL_ORDER,
  'ZERO_BASIS',
  'CET_4_6',
  'POSTGRADUATE',
  'WORKPLACE',
])

const SAVED_QUOTAS = [5, 15, 30, 45] as const

export type SavedQuotaMinutes = (typeof SAVED_QUOTAS)[number]

export interface CanonicalGoalOption {
  value: CanonicalTargetGoal
  label: string
  description: string
}

export function canonicalGoalCode(value: string | null | undefined): CanonicalTargetGoal | null {
  switch (value) {
    case 'FOUNDATION':
    case 'ZERO_BASIS':
      return 'FOUNDATION'
    case 'COLLEGE_CET':
    case 'CET_4_6':
      return 'COLLEGE_CET'
    case 'POSTGRADUATE_ENGLISH':
    case 'POSTGRADUATE':
      return 'POSTGRADUATE_ENGLISH'
    case 'WORKPLACE_DAILY':
    case 'WORKPLACE':
      return 'WORKPLACE_DAILY'
    default:
      return null
  }
}

function visibleGoalText(value: string | null | undefined, fallback: string): string {
  const text = value?.trim() ?? ''
  if (!text || GOAL_CODE_TEXT.has(text)) return fallback
  return text
}

export function canonicalGoalOptions(
  items: readonly { value?: string | null; label?: string | null; description?: string | null }[] | null | undefined,
): CanonicalGoalOption[] {
  const byCode = new Map<CanonicalTargetGoal, CanonicalGoalOption & { native: boolean }>()
  for (const item of items ?? []) {
    const code = canonicalGoalCode(item?.value)
    if (!code) continue
    const copy = CANONICAL_GOAL_COPY[code]
    const option = {
      value: code,
      label: visibleGoalText(item.label, copy.label),
      description: visibleGoalText(item.description, copy.description),
      native: item.value === code,
    }
    const existing = byCode.get(code)
    if (!existing || (option.native && !existing.native)) byCode.set(code, option)
  }
  const options = [...byCode.values()].map(({ value, label, description }) => ({ value, label, description }))
  if (options.length) return options
  return CANONICAL_GOAL_ORDER.map((value) => ({ value, ...CANONICAL_GOAL_COPY[value] }))
}

export function prefillSavedTarget(target: {
  saved: boolean
  goal: string | null | undefined
  quota: number | null | undefined
}): { goal: CanonicalTargetGoal | null; quota: SavedQuotaMinutes | null } {
  if (!target.saved) return { goal: null, quota: null }
  const goal = canonicalGoalCode(target.goal)
  const quota = SAVED_QUOTAS.find((item) => item === target.quota) ?? null
  if (!goal || quota === null) return { goal: null, quota: null }
  return { goal, quota }
}

export function onboardingRemainingStepLabels(
  facts: OnboardingResumeFacts,
  placementDone = false,
): readonly string[] {
  const step = selectOnboardingResumeStep(facts)
  if (step === 'rejected') return []
  if (step === 'gate') return ['确认身份', '必要同意', '学习目标']
  if (step === 'consent') return ['必要同意', '学习目标']
  if (step === 'goal') return ['学习目标']
  return placementDone ? [] : ['定级']
}
