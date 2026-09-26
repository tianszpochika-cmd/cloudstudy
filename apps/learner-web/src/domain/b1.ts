export const B1_STORAGE_KEY = 'yx.b1.learner-web.v1'

export const targetGoals = [
  { value: 'ZERO_BASIS', label: '成人零基础', description: '从发音、核心词和短句开始建立基础。' },
  { value: 'CET_4_6', label: '四六级备考', description: '围绕词汇、听力与真题节奏推进。' },
  { value: 'POSTGRADUATE', label: '考研英语', description: '强化长难句、阅读和高频表达。' },
  { value: 'WORKPLACE_DAILY', label: '职场与日常', description: '优先处理会话、场景和邮件表达。' },
] as const

export type TargetGoal = (typeof targetGoals)[number]['value']

export const subTags = [
  { value: 'PRONUNCIATION', label: '发音矫正' },
  { value: 'VOCABULARY', label: '核心词汇' },
  { value: 'READING', label: '阅读提升' },
  { value: 'LISTENING', label: '听力精听' },
  { value: 'SPEAKING', label: '口语自练' },
  { value: 'TRAVEL', label: '旅游出行' },
  { value: 'EMAIL', label: '外企邮件' },
] as const

export type SubTag = (typeof subTags)[number]['value']
export const dailyQuotaOptions = [5, 15, 30, 45] as const
export type DailyQuotaMinutes = (typeof dailyQuotaOptions)[number]

export type SyncState = 'local' | 'syncing' | 'synced' | 'offline' | 'error'
export type AssessmentStatus = 'idle' | 'loading' | 'ready' | 'submitting' | 'completed' | 'error' | 'offline'
export type AssessmentSource = 'PLACEMENT' | 'FAST_TRACK'
export type AssessmentDimension = 'VOCABULARY' | 'GRAMMAR' | 'LISTENING'

export interface OnboardingProfile {
  ageConfirmed: boolean
  privacyConsent: boolean
  termsConsent: boolean
  birthYear: number | null
  targetGoal: TargetGoal | null
  subTags: SubTag[]
  dailyQuotaMinutes: DailyQuotaMinutes | null
  completed: boolean
  updatedAt: string | null
}

export interface QuestionOption {
  key: string
  text: string
}

export interface PlacementQuestion {
  questionId: string
  sessionId: string
  stepIndex: number
  totalSteps: number
  dimension: AssessmentDimension
  difficulty: number
  stemText: string
  helperText: string
  options: QuestionOption[]
  correctKey: string | null
  timeLimitSec: number
}

export interface AnswerRecord {
  questionId: string
  stepIndex: number
  dimension: AssessmentDimension
  difficulty: number
  selectedKey: string
  correct: boolean | null
  timeSpentSec: number
  submittedAt: string
}

export interface AssessmentRadar {
  vocab: number
  grammar: number
  listening: number
  speed: number
  scenario: number
}

export interface AssessmentReport {
  score: number
  level: number
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  estimatedVocabulary: number
  radarScores: AssessmentRadar
  recommendedAdvice: string
  source: AssessmentSource
  completedAt: string
}

export interface AssessmentSkipBaseline {
  reportId: string
  sessionId: string
  requestedStartingLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null
  confidence: 'UNVERIFIED'
}

export interface AssessmentSnapshot {
  status: AssessmentStatus
  sessionId: string | null
  currentQuestion: PlacementQuestion | null
  answers: AnswerRecord[]
  report: AssessmentReport | null
  skipBaseline?: AssessmentSkipBaseline | null
  lastSavedAt: string | null
  resumed: boolean
}

export interface ContinueContext {
  moduleId: string
  moduleLabel: string
  lessonId: string
  lessonTitle: string
  stepIndex: number
  totalSteps: number
  elapsedTimeMs: number
  updatedAt: string
  status: 'ACTIVE' | 'EXPIRED'
}

export interface DailyTask {
  id: string
  contentCode: string | null
  title: string
  description: string
  kind: 'NEW' | 'REVIEW' | 'MISTAKE'
  minutes: number
  count: number
  completed: boolean
}

export interface HomeSnapshot {
  streakDays: number
  starCoins: number
  currentXp: number
  levelTitle: string
  dailyStream: {
    dueNewCount: number
    dueReviewCount: number
    mistakeCount: number
    completedMinutes: number
    targetMinutes: DailyQuotaMinutes
    tasks: DailyTask[]
  }
  orderedWidgets: string[]
  lastSyncedAt: string | null
}

export interface ProfileSnapshot {
  nickname: string
  accentPref: 'US' | 'UK'
  dailyQuotaMinutes: DailyQuotaMinutes
  targetGoal: TargetGoal
  profileVersion: string
}

export type LeaderboardVisibility = 'NICKNAME' | 'ANONYMOUS' | 'OPT_OUT'
export type FeedVisibility = 'PUBLIC' | 'ROOM_ONLY' | 'GROUP_ONLY' | 'HIDDEN'

export interface PrivacySettings {
  leaderboardVisibility: LeaderboardVisibility
  feedVisibility: FeedVisibility
  showMinutes: boolean
  showStreak: boolean
  showCourse: boolean
  showAssessment: boolean
}

export interface DeviceSession {
  deviceId: string
  deviceName: string
  deviceType: 'WEB' | 'H5' | 'IOS' | 'ANDROID'
  clientVersion: string
  lastActiveAt: string
  region: string
  current: boolean
  status: 'ACTIVE' | 'KICKED'
}

export interface DeletionStatus {
  state: 'ACTIVE' | 'DELETION_PENDING'
  executeAt: string | null
}

export const assessmentQuestions: PlacementQuestion[] = [
  {
    questionId: 'local-vocab-01', sessionId: 'local-placement', stepIndex: 1, totalSteps: 10,
    dimension: 'VOCABULARY', difficulty: 2, stemText: 'Which word is closest in meaning to “rapid”?', helperText: '词汇识别 · A2',
    options: [{ key: 'A', text: 'slow' }, { key: 'B', text: 'quick' }, { key: 'C', text: 'quiet' }, { key: 'D', text: 'heavy' }], correctKey: 'B', timeLimitSec: 25,
  },
  {
    questionId: 'local-vocab-02', sessionId: 'local-placement', stepIndex: 2, totalSteps: 10,
    dimension: 'VOCABULARY', difficulty: 2, stemText: 'The museum is open to the public every day except Monday. What does “except” mean?', helperText: '词汇识别 · A2',
    options: [{ key: 'A', text: 'including' }, { key: 'B', text: 'beside' }, { key: 'C', text: 'excluding' }, { key: 'D', text: 'before' }], correctKey: 'C', timeLimitSec: 25,
  },
  {
    questionId: 'local-vocab-03', sessionId: 'local-placement', stepIndex: 3, totalSteps: 10,
    dimension: 'VOCABULARY', difficulty: 3, stemText: 'Which phrase means “to make something better”?', helperText: '词汇识别 · B1',
    options: [{ key: 'A', text: 'improve it' }, { key: 'B', text: 'remove it' }, { key: 'C', text: 'repeat it' }, { key: 'D', text: 'hide it' }], correctKey: 'A', timeLimitSec: 25,
  },
  {
    questionId: 'local-vocab-04', sessionId: 'local-placement', stepIndex: 4, totalSteps: 10,
    dimension: 'VOCABULARY', difficulty: 3, stemText: 'A “reliable” person is someone you can…', helperText: '词汇识别 · B1',
    options: [{ key: 'A', text: 'depend on' }, { key: 'B', text: 'argue with' }, { key: 'C', text: 'avoid' }, { key: 'D', text: 'surprise' }], correctKey: 'A', timeLimitSec: 25,
  },
  {
    questionId: 'local-grammar-01', sessionId: 'local-placement', stepIndex: 5, totalSteps: 10,
    dimension: 'GRAMMAR', difficulty: 2, stemText: 'If I ___ more time, I would join the study group.', helperText: '基础语法 · A2',
    options: [{ key: 'A', text: 'have' }, { key: 'B', text: 'had' }, { key: 'C', text: 'will have' }, { key: 'D', text: 'am having' }], correctKey: 'B', timeLimitSec: 25,
  },
  {
    questionId: 'local-grammar-02', sessionId: 'local-placement', stepIndex: 6, totalSteps: 10,
    dimension: 'GRAMMAR', difficulty: 3, stemText: 'She has lived in Shenzhen ___ 2022.', helperText: '基础语法 · B1',
    options: [{ key: 'A', text: 'for' }, { key: 'B', text: 'during' }, { key: 'C', text: 'since' }, { key: 'D', text: 'from' }], correctKey: 'C', timeLimitSec: 25,
  },
  {
    questionId: 'local-grammar-03', sessionId: 'local-placement', stepIndex: 7, totalSteps: 10,
    dimension: 'GRAMMAR', difficulty: 4, stemText: 'The report, ___ was sent yesterday, needs one more review.', helperText: '基础语法 · B2',
    options: [{ key: 'A', text: 'which' }, { key: 'B', text: 'what' }, { key: 'C', text: 'where' }, { key: 'D', text: 'who' }], correctKey: 'A', timeLimitSec: 25,
  },
  {
    questionId: 'local-listening-01', sessionId: 'local-placement', stepIndex: 8, totalSteps: 10,
    dimension: 'LISTENING', difficulty: 2, stemText: '听辨模拟：You hear “The train leaves at half past nine.” What time is it?', helperText: '听力理解 · A2',
    options: [{ key: 'A', text: '8:30' }, { key: 'B', text: '9:00' }, { key: 'C', text: '9:30' }, { key: 'D', text: '10:30' }], correctKey: 'C', timeLimitSec: 25,
  },
  {
    questionId: 'local-listening-02', sessionId: 'local-placement', stepIndex: 9, totalSteps: 10,
    dimension: 'LISTENING', difficulty: 3, stemText: '听辨模拟：The speaker says the meeting was moved because of a delayed flight. Why was it moved?', helperText: '听力理解 · B1',
    options: [{ key: 'A', text: 'A room was closed.' }, { key: 'B', text: 'A flight was late.' }, { key: 'C', text: 'The speaker was ill.' }, { key: 'D', text: 'The topic changed.' }], correctKey: 'B', timeLimitSec: 25,
  },
  {
    questionId: 'local-listening-03', sessionId: 'local-placement', stepIndex: 10, totalSteps: 10,
    dimension: 'LISTENING', difficulty: 4, stemText: '听辨模拟：The advice is to reserve a seat in advance. What should the learner do?', helperText: '听力理解 · B2',
    options: [{ key: 'A', text: 'Arrive later.' }, { key: 'B', text: 'Change the route.' }, { key: 'C', text: 'Book a seat early.' }, { key: 'D', text: 'Cancel the trip.' }], correctKey: 'C', timeLimitSec: 25,
  },
]

export function createDefaultOnboarding(): OnboardingProfile {
  return {
    ageConfirmed: false,
    privacyConsent: false,
    termsConsent: false,
    birthYear: null,
    targetGoal: null,
    subTags: [],
    dailyQuotaMinutes: null,
    completed: false,
    updatedAt: null,
  }
}

export function createDefaultAssessment(): AssessmentSnapshot {
  return { status: 'idle', sessionId: null, currentQuestion: null, answers: [], report: null, lastSavedAt: null, resumed: false }
}

export function createDefaultPrivacy(): PrivacySettings {
  return {
    leaderboardVisibility: 'NICKNAME',
    feedVisibility: 'ROOM_ONLY',
    showMinutes: true,
    showStreak: true,
    showCourse: false,
    showAssessment: false,
  }
}

export function createDefaultDeletion(): DeletionStatus {
  return { state: 'ACTIVE', executeAt: null }
}

export function createDefaultProfile(onboarding: OnboardingProfile): ProfileSnapshot {
  return {
    nickname: '学习者',
    accentPref: 'US',
    dailyQuotaMinutes: onboarding.dailyQuotaMinutes ?? 15,
    targetGoal: onboarding.targetGoal ?? 'ZERO_BASIS',
    profileVersion: 'local-1',
  }
}

export function createDefaultContinueContext(): ContinueContext {
  return {
    moduleId: 'core-vocab',
    moduleLabel: '核心词汇',
    lessonId: 'lesson-airport-checkin',
    lessonTitle: '机场值机：先掌握 6 个高频表达',
    stepIndex: 2,
    totalSteps: 5,
    elapsedTimeMs: 45200,
    updatedAt: new Date().toISOString(),
    status: 'ACTIVE',
  }
}

export function getTargetLabel(target: TargetGoal | null): string {
  return targetGoals.find((item) => item.value === target)?.label ?? '成人零基础'
}

export function getDailyQuotaXp(minutes: DailyQuotaMinutes): number {
  return minutes === 5 ? 10 : minutes === 15 ? 30 : minutes === 30 ? 60 : 100
}

export function getLocalQuestion(stepIndex: number, sessionId = 'local-placement'): PlacementQuestion | null {
  const source = assessmentQuestions[stepIndex]
  return source ? { ...source, sessionId } : null
}

function scoreToLevel(score: number): { level: number; cefrLevel: AssessmentReport['cefrLevel'] } {
  if (score < 25) return { level: 1, cefrLevel: 'A1' }
  if (score < 45) return { level: 2, cefrLevel: 'A2' }
  if (score < 65) return { level: 3, cefrLevel: 'B1' }
  if (score < 80) return { level: 4, cefrLevel: 'B2' }
  if (score < 92) return { level: 5, cefrLevel: 'C1' }
  return { level: 6, cefrLevel: 'C2' }
}

export function calculateAssessmentReport(answers: AnswerRecord[], source: AssessmentSource = 'PLACEMENT'): AssessmentReport {
  const knownAnswers = answers.filter((answer) => answer.correct !== null)
  const correctCount = knownAnswers.filter((answer) => answer.correct === true).length
  const accuracy = answers.length ? correctCount / answers.length : 0
  const speedScore = answers.length ? answers.reduce((total, answer) => total + Math.max(0, 1 - answer.timeSpentSec / 25), 0) / answers.length : 0
  const score = Math.round(Math.min(100, accuracy * 70 + speedScore * 30))
  const { level, cefrLevel } = scoreToLevel(score)
  const vocabularyBases = [500, 1000, 2200, 4500, 6500, 9000]
  const vocabularyRanges = [500, 1200, 2300, 2000, 2500, 3000]
  const dimensionScore = (dimension: AssessmentDimension): number => {
    const items = answers.filter((answer) => answer.dimension === dimension)
    if (!items.length) return 0
    return Math.round(items.reduce((total, item) => total + (item.correct === true ? 1 : 0), 0) / items.length * 100)
  }
  const vocab = dimensionScore('VOCABULARY')
  const grammar = dimensionScore('GRAMMAR')
  const listening = dimensionScore('LISTENING')
  const weakest = [
    { label: '词汇', value: vocab },
    { label: '语法', value: grammar },
    { label: '听力', value: listening },
  ].sort((left, right) => left.value - right.value)[0]
  return {
    score,
    level,
    cefrLevel,
    estimatedVocabulary: Math.round(vocabularyBases[level - 1] + vocabularyRanges[level - 1] * (vocab / 100)),
    radarScores: { vocab, grammar, listening, speed: Math.round(speedScore * 100), scenario: Math.round((accuracy * 0.7 + speedScore * 0.3) * 100) },
    recommendedAdvice: weakest && weakest.value < 70 ? `最近的${weakest.label}表现更需要巩固，首周已为你增加对应的短任务。` : '基础较均衡，首周会按目标保持新学、复习与错题修复的节奏。',
    source,
    completedAt: new Date().toISOString(),
  }
}

export function createDefaultHome(onboarding: OnboardingProfile, report: AssessmentReport | null): HomeSnapshot {
  const target = onboarding.targetGoal ?? 'ZERO_BASIS'
  const minutes = onboarding.dailyQuotaMinutes ?? 15
  const tasks: DailyTask[] = [
    { id: 'today-new', contentCode: null, title: '新知输入', description: '掌握今日核心词与短语', kind: 'NEW', minutes: Math.max(3, Math.round(minutes * 0.4)), count: 12, completed: false },
    { id: 'today-review', contentCode: null, title: '到期复习', description: '用主动回忆修复即将遗忘内容', kind: 'REVIEW', minutes: Math.max(2, Math.round(minutes * 0.35)), count: 8, completed: false },
    { id: 'today-mistake', contentCode: null, title: '错题修复', description: '重新理解最近答错的知识点', kind: 'MISTAKE', minutes: Math.max(2, minutes - Math.max(3, Math.round(minutes * 0.4)) - Math.max(2, Math.round(minutes * 0.35))), count: report ? 3 : 0, completed: false },
  ]
  return {
    streakDays: 3,
    starCoins: 120,
    currentXp: report ? 160 : 80,
    levelTitle: report ? `L${report.level} 探索者` : 'L1 起点探索者',
    dailyStream: { dueNewCount: tasks[0].count, dueReviewCount: tasks[1].count, mistakeCount: tasks[2].count, completedMinutes: 0, targetMinutes: minutes, tasks },
    orderedWidgets: getWidgetOrder(target),
    lastSyncedAt: null,
  }
}

export function getWidgetOrder(target: TargetGoal): string[] {
  const common = ['CONTINUE_LEARNING', 'DAILY_STREAM']
  if (target === 'CET_4_6') return [...common, 'EXAM_COUNTDOWN', 'CORE_VOCAB', 'WORLD_MAP', 'MISTAKE_REPAIR']
  if (target === 'POSTGRADUATE') return [...common, 'XRAY_GRAMMAR', 'CORE_VOCAB', 'WORLD_MAP', 'MISTAKE_REPAIR']
  if (target === 'WORKPLACE_DAILY') return [...common, 'SCENARIO_PACKS', 'SPEAKING', 'CORE_VOCAB', 'WORLD_MAP']
  return [...common, 'PHONICS', 'CORE_VOCAB', 'WORLD_MAP', 'SCENARIO_PACKS']
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}
