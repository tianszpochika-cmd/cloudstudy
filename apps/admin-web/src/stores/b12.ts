import { defineStore } from 'pinia'
import { adminT } from '../platform/admin-i18n'
import { AdminApiError } from '../api/client'
import { listB12ModerationReports, listB12RecoveryTasks, runB12ModerationCommand, runB12RecoveryCommand } from '../api/b12'
import { recordList, parseModerationReport, parseRecoveryTask, responseRequestId, type B12AdminViewState, type B12ModerationCommand, type B12ModerationReport, type B12RecoveryCommand, type B12RecoveryTask } from '../domain/b12'
import { useAdminStore } from './admin'

function errorMessage(error: unknown, fallback: string): string { return error instanceof Error && error.message ? error.message : fallback }

export const useB12AdminStore = defineStore('b12-admin', {
  state: () => ({
    viewState: 'idle' as B12AdminViewState,
    reports: [] as B12ModerationReport[],
    recoveryTasks: [] as B12RecoveryTask[],
    busyKey: null as string | null,
    lastError: null as string | null,
    lastSuccess: null as string | null,
    lastRequestId: null as string | null,
  }),
  actions: {
    canReadModeration(): boolean { return useAdminStore().can('admin.moderation.read') },
    canCommandModeration(): boolean { return useAdminStore().can('admin.moderation.command') },
    canReadRecovery(): boolean { return useAdminStore().can('admin.recovery.read') },
    canCommandRecovery(): boolean { return useAdminStore().can('admin.recovery.command') },
    async load(): Promise<void> {
      const session = useAdminStore()
      const canReadAny = this.canReadModeration() || this.canReadRecovery()
      if (!session.isAuthenticated || !canReadAny) { this.viewState = 'permission'; this.lastError = adminT('storeB12.noGovernanceRead'); return }
      this.viewState = 'loading'; this.lastError = null; this.lastSuccess = null
      const failures: unknown[] = []
      const requests: Array<Promise<void>> = []
      if (this.canReadModeration()) requests.push(listB12ModerationReports().then((value) => { this.reports = recordList(value).map(parseModerationReport).filter((item): item is B12ModerationReport => Boolean(item)) }).catch((error) => { failures.push(error) }))
      if (this.canReadRecovery()) requests.push(listB12RecoveryTasks().then((value) => { this.recoveryTasks = recordList(value).map(parseRecoveryTask).filter((item): item is B12RecoveryTask => Boolean(item)) }).catch((error) => { failures.push(error) }))
      await Promise.all(requests)
      if (failures.length) {
        const forbidden = failures.some((error) => error instanceof AdminApiError && error.status === 403)
        const recovering = failures.some((error) => error instanceof AdminApiError && error.status === 409)
        this.viewState = forbidden ? 'permission' : recovering ? 'recovery' : 'error'
        this.lastError = errorMessage(failures[0], adminT('storeB12.loadFailed'))
      } else this.viewState = this.reports.length || this.recoveryTasks.length ? 'ready' : 'empty'
    },
    async runModerationCommand(reportId: string, commandCode: B12ModerationCommand): Promise<void> {
      if (!this.canCommandModeration()) { this.viewState = 'permission'; this.lastError = adminT('storeB12.noModerationCommand'); return }
      if (this.busyKey || !reportId.trim()) return
      this.busyKey = `moderation.${reportId}.${commandCode}`; this.lastError = null; this.lastSuccess = null
      try { const result = await runB12ModerationCommand(reportId, commandCode); this.lastRequestId = responseRequestId(result); await this.load(); this.lastSuccess = adminT('storeB12.commandConfirmed'); this.viewState = 'success' }
      catch (error) { this.viewState = error instanceof AdminApiError && error.status === 403 ? 'permission' : error instanceof AdminApiError && error.status === 409 ? 'recovery' : 'error'; this.lastError = errorMessage(error, adminT('storeB12.moderationCommandFailed')) }
      finally { this.busyKey = null }
    },
    async runRecoveryCommand(taskId: string, commandCode: B12RecoveryCommand): Promise<void> {
      if (!this.canCommandRecovery()) { this.viewState = 'permission'; this.lastError = adminT('storeB12.noRecoveryCommand'); return }
      if (this.busyKey || !taskId.trim()) return
      this.busyKey = `recovery.${taskId}.${commandCode}`; this.lastError = null; this.lastSuccess = null
      try { const result = await runB12RecoveryCommand(taskId, commandCode); this.lastRequestId = responseRequestId(result); await this.load(); this.lastSuccess = adminT('storeB12.commandConfirmed'); this.viewState = 'success' }
      catch (error) { this.viewState = error instanceof AdminApiError && error.status === 403 ? 'permission' : error instanceof AdminApiError && error.status === 409 ? 'recovery' : 'error'; this.lastError = errorMessage(error, adminT('storeB12.recoveryCommandFailed')) }
      finally { this.busyKey = null }
    },
  },
})
