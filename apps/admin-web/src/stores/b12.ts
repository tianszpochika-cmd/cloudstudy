import { defineStore } from 'pinia'
import { AdminApiError } from '../api/client'
import { listB12ModerationReports, type B12ModerationReportPage } from '../api/b12'
import { parseModerationReport, type B12ModerationReport } from '../domain/b12'
import { b12T } from '../platform/b12-i18n'
import { useAdminStore } from './admin'

type GovernanceReadState = 'idle' | 'loading' | 'ready' | 'empty' | 'permission' | 'error'
export const B12_MODERATION_STATUSES = ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const
type ModerationStatus = (typeof B12_MODERATION_STATUSES)[number]

function isModerationStatus(value: string): value is ModerationStatus {
  return B12_MODERATION_STATUSES.some((status) => status === value)
}

function reportRows(page: B12ModerationReportPage): B12ModerationReport[] {
  const reports = page.items.map(parseModerationReport)
  if (reports.some((report) => report === null)) throw new Error('B12_REPORT_PAGE_INVALID')
  return reports.filter((report): report is B12ModerationReport => report !== null)
}

export const useB12AdminStore = defineStore('b12-admin', {
  state: () => ({
    viewState: 'idle' as GovernanceReadState,
    status: 'OPEN' as ModerationStatus,
    reports: [] as B12ModerationReport[],
    nextCursor: null as string | null,
    usedCursors: [] as string[],
    loadingMore: false,
    lastError: null as string | null,
    moreError: null as string | null,
    requestVersion: 0,
  }),
  actions: {
    clearPages(): void {
      ++this.requestVersion
      this.reports = []
      this.nextCursor = null
      this.usedCursors = []
      this.loadingMore = false
      this.lastError = null
      this.moreError = null
      this.viewState = 'idle'
    },
    denyAccess(): void {
      this.clearPages()
      this.viewState = 'permission'
      this.lastError = b12T('permission')
    },
    async setStatus(status: string): Promise<void> {
      if (!isModerationStatus(status) || status === this.status) return
      this.status = status
      await this.load()
    },
    async load(): Promise<void> {
      const session = useAdminStore()
      this.clearPages()
      const requestVersion = this.requestVersion
      if (!session.isAuthenticated || !session.can('admin.moderation.read')) {
        this.denyAccess()
        return
      }

      this.viewState = 'loading'
      try {
        const page = await listB12ModerationReports(this.status)
        if (requestVersion !== this.requestVersion) return
        if (!session.isAuthenticated || !session.can('admin.moderation.read')) {
          this.denyAccess()
          return
        }
        this.reports = reportRows(page)
        this.nextCursor = page.nextCursor
        this.viewState = this.reports.length ? 'ready' : 'empty'
      } catch (error) {
        if (requestVersion !== this.requestVersion) return
        if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
          this.denyAccess()
        } else {
          this.clearPages()
          this.viewState = 'error'
          this.lastError = b12T('error')
        }
      }
    },
    async loadMore(): Promise<void> {
      const session = useAdminStore()
      if (!session.isAuthenticated || !session.can('admin.moderation.read')) {
        this.denyAccess()
        return
      }
      const cursor = this.nextCursor
      if (this.viewState !== 'ready' || cursor === null || this.loadingMore) return
      const requestVersion = this.requestVersion
      this.loadingMore = true
      this.moreError = null
      try {
        const page = await listB12ModerationReports(this.status, cursor)
        if (requestVersion !== this.requestVersion) return
        if (!session.isAuthenticated || !session.can('admin.moderation.read')) {
          this.denyAccess()
          return
        }
        const reports = reportRows(page)
        if (page.nextCursor !== null
          && (page.nextCursor === cursor || this.usedCursors.includes(page.nextCursor))) {
          throw new Error('B12_REPORT_CURSOR_REPEATED')
        }
        const existing = new Set(this.reports.map((report) => report.reportId))
        this.reports = [...this.reports, ...reports.filter((report) => !existing.has(report.reportId))]
        this.usedCursors.push(cursor)
        this.nextCursor = page.nextCursor
      } catch (error) {
        if (requestVersion !== this.requestVersion) return
        if (!session.isAuthenticated || !session.can('admin.moderation.read')
          || error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
          this.denyAccess()
        } else {
          this.moreError = b12T('moreError')
        }
      } finally {
        if (requestVersion === this.requestVersion) this.loadingMore = false
      }
    },
  },
})
