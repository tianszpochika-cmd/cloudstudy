import type {
  MobileContentDetail,
  MobileFirstDayModel,
  MobileHomeModel,
  MobileLearnerAccount,
  MobileMotionMode,
  MobileOnboardingModel,
  MobilePlacementModel,
  MobilePlacementQuestion,
  MobileThemeMode,
} from '../domain/learner-content'

/**
 * 学习域静态数据（fixture 模式，无后端）。
 * 与网关同语义：画像→定级 2 题→报告→首页任务→完成。
 * 开关：`VITE_MOBILE_API_MODE=fixture`（见 learner-content.ts 末尾选择器）。
 */
const GOALS = [
  { value: 'ZERO_BASIS', label: '成人零基础', description: '从发音和日常表达开始' },
  { value: 'CET_4_6', label: '四六级备考', description: '词汇语法双线' },
  { value: 'POSTGRADUATE', label: '考研英语', description: '长难句与写作' },
]
const QUOTAS = [5, 15, 30, 45]

const QUESTIONS: MobilePlacementQuestion[] = [
  { questionId: 'b25-item-001', stemText: 'Choose the greeting.', options: [{ key: 'A', text: 'Hello' }, { key: 'B', text: 'Goodbye' }], dimension: 'VOCABULARY', difficulty: 1, stepIndex: 1, totalSteps: 2, timeLimitSec: 60 },
  { questionId: 'b25-item-002', stemText: 'Choose the farewell.', options: [{ key: 'A', text: 'Hello' }, { key: 'B', text: 'Goodbye' }], dimension: 'VOCABULARY', difficulty: 1, stepIndex: 2, totalSteps: 2, timeLimitSec: 60 },
]
const ANSWERS: Record<string, string> = { 'b25-item-001': 'A', 'b25-item-002': 'B' }

const state = {
  goal: null as string | null,
  quota: null as number | null,
  answers: {} as Record<string, string>,
  sessionId: null as string | null,
  tasksDone: new Set<string>(),
}

function onboarding(): MobileOnboardingModel {
  return { goal: state.goal, quota: state.quota, goals: GOALS, quotas: QUOTAS, birthYear: 1995, ageConfirmed: true, privacyConsent: true, termsConsent: true, uiLocale: 'zh-CN', contentLocale: 'en-US', completed: state.goal !== null, stateVersion: 1 }
}

function account(): MobileLearnerAccount {
  return { uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL', goal: state.goal, quota: state.quota, stateVersion: 1 }
}

function placement(): MobilePlacementModel {
  const keys = Object.keys(state.answers)
  if (keys.length >= QUESTIONS.length) {
    const correct = QUESTIONS.filter((q) => state.answers[q.questionId] === ANSWERS[q.questionId]).length
    return { sessionId: state.sessionId, status: 'COMPLETED', currentQuestion: null, report: { reportId: 'fixture-report-01', sessionId: state.sessionId ?? 'fixture-placement-01', resultKind: 'ASSESSED', cefrLevel: correct === 2 ? 'A1' : 'A0', score: correct / QUESTIONS.length, requestedStartingLevel: null, mistakes: QUESTIONS.filter((q) => state.answers[q.questionId] !== ANSWERS[q.questionId]).map((q) => q.questionId) }, isCompleted: true }
  }
  if (!state.sessionId) return { sessionId: null, status: 'EMPTY', currentQuestion: null, report: null, isCompleted: false }
  return { sessionId: state.sessionId, status: 'IN_PROGRESS', currentQuestion: QUESTIONS[keys.length], report: null, isCompleted: false }
}

function home(): MobileHomeModel {
  return {
    projectionVersion: 1, contentEpoch: 1,
    tasks: [
      { id: 'task-01', type: 'LESSON', title: 'English Foundations · 今日学习', description: '15 分钟', minutes: 15, status: state.tasksDone.has('task-01') ? 'COMPLETED' : 'AVAILABLE', contentCode: 'course-b25-basics' },
      { id: 'task-02', type: 'REVIEW', title: '昨日复习', description: '10 分钟', minutes: 10, status: state.tasksDone.has('task-02') ? 'COMPLETED' : 'AVAILABLE', contentCode: 'course-b25-basics' },
    ],
    content: ['四级词汇 B1', '零基础 A1', '六级 B2', '商务口语', '雅思备考', '生活英语'].map((title, i) => ({ contentCode: `demo-course-0${i + 1}`, contentType: 'COURSE', title, summary: '演示课程', contentLocale: 'en-US', contentVersionId: 1000 + i, availability: 'PUBLISHED' as const })),
    contentStatus: 'READY', completedMinutes: state.tasksDone.size * 10, targetMinutes: 15, stale: false,
  }
}

export const fixtureMobileLearnerContentApi = {
  async readOnboarding(): Promise<MobileOnboardingModel> { return onboarding() },
  async saveOnboarding(input: { goal: string; quota: number; clientEventId: string; birthYear?: number; ageConfirmed?: boolean; privacyConsent?: boolean; termsConsent?: boolean }, _isCurrent?: () => boolean): Promise<MobileOnboardingModel> {
    if (!input.birthYear || !input.ageConfirmed || !input.privacyConsent || !input.termsConsent || !input.goal || !input.quota) throw new Error('请先完成成人确认、同意事项和学习目标。')
    state.goal = input.goal
    state.quota = input.quota
    return onboarding()
  },
  async readAccount(): Promise<MobileLearnerAccount> { return account() },
  async savePreferences(input: { themeMode?: MobileThemeMode; highContrast?: boolean; motionMode?: MobileMotionMode; contentLocale?: string; clientEventId: string }, _isCurrent?: () => boolean): Promise<MobileLearnerAccount> { return account() },
  async readFirstDay(_contentLocale = 'en-US'): Promise<MobileFirstDayModel> { return { state: 'READY', profileReady: true, targetReady: state.goal !== null, placementStatus: state.sessionId ? 'STARTED' : 'NOT_STARTED', taskCount: 2, contentEpoch: 1, projectionVersion: 1 } },
  async readPlacement(_contentLocale = 'en-US', _sessionId?: string | null): Promise<MobilePlacementModel> { return placement() },
  async startPlacement(_contentLocale = 'en-US', _clientEventId = ''): Promise<MobilePlacementModel> { state.sessionId = 'fixture-placement-01'; state.answers = {}; return placement() },
  async submitPlacementAnswer(input: { sessionId: string; questionId: string; selectedKey: string; timeSpentSec: number; contentLocale: string; clientEventId: string }): Promise<MobilePlacementModel> {
    state.answers[input.questionId] = input.selectedKey
    return placement()
  },
  async readHome(_contentLocale = 'en-US'): Promise<MobileHomeModel> { return home() },
  async readContent(contentCode: string): Promise<MobileContentDetail> {
    return { contentCode, contentVersionId: 1001, contentType: 'COURSE', title: '演示课程', summary: '静态演示内容', contentLocale: 'en-US', items: [] }
  },
  async completeTask(taskId: string, _clientEventId: string): Promise<MobileHomeModel | null> { state.tasksDone.add(taskId); return home() },
}
