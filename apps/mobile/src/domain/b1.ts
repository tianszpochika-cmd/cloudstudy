export type MobileB1Page = 'home' | 'onboarding' | 'assessment' | 'today' | 'learn' | 'settings'
export interface MobileB1State { onboardingDone: boolean; assessmentDone: boolean; goal: string; quota: number; progress: number; lessonTitle: string }
export const MOBILE_B1_KEY = 'yx.b1.mobile.v1'
export const mobileGoals = ['成人零基础', '四六级备考', '考研英语', '职场与日常'] as const
export const mobileQuotas = [5, 15, 30, 45] as const
export function createMobileB1State(): MobileB1State { return { onboardingDone: false, assessmentDone: false, goal: '', quota: 15, progress: 0, lessonTitle: '机场值机：先掌握 6 个高频表达' } }
