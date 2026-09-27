import { defineStore } from 'pinia'
import { AdminApiError } from '../api/client'
import {
  decideRiskCase,
  evaluateRiskRules,
  fileRiskCase,
  listRiskCases,
  type RiskCaseRecord,
  type RiskDecisionInput,
  type RiskFileInput,
} from '../api/risk'
import { useAdminStore } from './admin'

type RiskReadState = 'idle' | 'loading' | 'ready' | 'empty' | 'permission' | 'error'

export const RISK_CATEGORIES = [
  'ACCOUNT_SECURITY',
  'DEVICE_ANOMALY',
  'PAYMENT_ANOMALY',
  'ACTIVATION_ABUSE',
  'EXPORT_ANOMALY',
  'CONTENT_RIGHTS',
] as const

export const RISK_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

export const RISK_COMMANDS = ['TRIAGE', 'ISOLATE', 'UNISOLATE', 'ESCALATE', 'CLOSE'] as const

export const useRiskAdminStore = defineStore('risk-admin', {
  state: () => ({
    viewState: 'idle' as RiskReadState,
    cases: [] as RiskCaseRecord[],
    lastError: null as string | null,
    lastNotice: null as string | null,
    busy: false as boolean,
    requestVersion: 0,
  }),
  actions: {
    denyAccess(): void {
      ++this.requestVersion
      this.cases = []
      this.viewState = 'permission'
      this.lastError = '当前账号没有风险案件读取权限。'
    },
    canRead(): boolean {
      const session = useAdminStore()
      return session.isAuthenticated && session.can('admin.risk.read')
    },
    canWrite(): boolean {
      const session = useAdminStore()
      return session.isAuthenticated && session.can('admin.risk.write')
    },
    async load(): Promise<void> {
      const requestVersion = ++this.requestVersion
      this.cases = []
      this.lastError = null
      if (!this.canRead()) {
        this.denyAccess()
        return
      }
      this.viewState = 'loading'
      try {
        const page = await listRiskCases()
        if (requestVersion !== this.requestVersion) return
        if (!this.canRead()) {
          this.denyAccess()
          return
        }
        this.cases = page.items
        this.viewState = this.cases.length ? 'ready' : 'empty'
      } catch (error) {
        if (requestVersion !== this.requestVersion) return
        if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
          this.denyAccess()
        } else {
          this.viewState = 'error'
          this.lastError = error instanceof Error ? error.message : '风险队列读取失败。'
        }
      }
    },
    async fileCase(input: RiskFileInput): Promise<boolean> {
      if (!this.canWrite()) return false
      this.busy = true
      this.lastError = null
      try {
        await fileRiskCase(input)
        this.lastNotice = '风险案件已建档。'
        await this.load()
        return true
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '建档失败。'
        return false
      } finally {
        this.busy = false
      }
    },
    async decide(caseId: string, input: RiskDecisionInput): Promise<boolean> {
      if (!this.canWrite()) return false
      this.busy = true
      this.lastError = null
      try {
        await decideRiskCase(caseId, input)
        this.lastNotice = '处置已记录并审计。'
        await this.load()
        return true
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '处置失败。'
        return false
      } finally {
        this.busy = false
      }
    },
    async evaluate(): Promise<boolean> {
      if (!this.canWrite()) return false
      this.busy = true
      this.lastError = null
      try {
        await evaluateRiskRules()
        this.lastNotice = '规则评估完成，新命中已建档。'
        await this.load()
        return true
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : '规则评估失败。'
        return false
      } finally {
        this.busy = false
      }
    },
  },
})
