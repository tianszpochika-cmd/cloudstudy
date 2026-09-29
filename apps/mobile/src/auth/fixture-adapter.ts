import type {
  B8AdultGateRequest,
  B8LogoutRequest,
  B8PasswordResetConfirmRequest,
  B8RefreshRequest,
} from '@englishflow/contracts'
import type {
  MobileAuthAdapter,
  MobileAuthSnapshot,
  MobileLoginCredentials,
  MobileTokenPair,
} from './gateway-auth'

/**
 * 静态数据适配器（IC 全幕本地验收用，不连网关）。
 * 语义与网关一致：注册/登录 201 只建会话、不开学习能力；
 * adultGate 初始 REQUIRED；refresh 轮换 sessionId。
 * 翻开关：`.env` 配 `VITE_MOBILE_API_MODE=fixture`（默认 gateway）。
 */
const PAIR: MobileTokenPair = {
  accessToken: 'fixture-access-token',
  refreshToken: 'fixture-refresh-token',
  deviceId: 'fixture-device-01',
  sessionId: 'fixture-session-01',
  adultGate: 'REQUIRED',
}

const SNAPSHOT: MobileAuthSnapshot = {
  principal: { subject: 'fixture-subject-01', roles: [], permissions: [], adultGate: 'REQUIRED' },
  roles: [],
  permissions: [],
  adultGate: 'REQUIRED',
  tokenPair: PAIR,
}

export function createFixtureMobileAuthAdapter(): MobileAuthAdapter {
  return {
    async login(input: MobileLoginCredentials): Promise<MobileTokenPair> {
      if (!input.identifier.trim() || !input.password) throw new Error('账号或密码不对。')
      return { ...PAIR, sessionId: `fixture-session-${Date.now()}` }
    },
    async register(input: MobileLoginCredentials): Promise<MobileTokenPair> {
      if (!input.identifier.trim() || input.password.length < 8) throw new Error('账号或密码不对。')
      return { ...PAIR, sessionId: `fixture-session-${Date.now()}` }
    },
    async requestPasswordReset(): Promise<{ accepted: boolean }> {
      return { accepted: true }
    },
    async confirmPasswordReset(_input: B8PasswordResetConfirmRequest): Promise<void> {},
    async restoreSession(): Promise<MobileAuthSnapshot | null> {
      return null
    },
    async refresh(_input?: B8RefreshRequest): Promise<MobileTokenPair> {
      return { ...PAIR, sessionId: `fixture-session-${Date.now()}` }
    },
    async getPermissions(): Promise<MobileAuthSnapshot | null> {
      return SNAPSHOT
    },
    async confirmAdultGate(_input: B8AdultGateRequest): Promise<MobileAuthSnapshot | null> {
      return { ...SNAPSHOT, adultGate: 'PASSED', principal: { subject: 'fixture-subject-01', roles: ['learner'], permissions: [], adultGate: 'PASSED' } }
    },
    async logout(_input?: B8LogoutRequest): Promise<void> {},
    async revoke(_sessionId: string): Promise<void> {},
  }
}

export function isFixtureApiMode(): boolean {
  return import.meta.env?.VITE_MOBILE_API_MODE === 'fixture'
}
