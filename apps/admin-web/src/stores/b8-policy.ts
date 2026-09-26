import { defineStore } from 'pinia'
import type { B8PolicyVersion } from '@englishflow/contracts'
import { AdminApiError } from '../api/client'
import { listB8PolicyVersions } from '../api/b8-policy'
import { b8PolicyT } from '../platform/b8-policy-i18n'
import { useAdminStore } from './admin'

type PolicyReadState = 'idle' | 'loading' | 'ready' | 'empty' | 'permission' | 'error'

export const useB8PolicyStore = defineStore('b8-policy-read', {
  state: () => ({
    viewState: 'idle' as PolicyReadState,
    items: [] as B8PolicyVersion[],
    nextCursor: null as string | null,
    loadingMore: false,
    lastError: null as string | null,
    moreError: null as string | null,
    requestVersion: 0,
  }),
  actions: {
    async load(): Promise<void> {
      const session = useAdminStore()
      const version = ++this.requestVersion
      this.items = []
      this.nextCursor = null
      this.loadingMore = false
      this.lastError = null
      this.moreError = null
      if (!session.isAuthenticated || !session.can('iam.policy.read')) {
        this.viewState = 'permission'
        this.lastError = b8PolicyT('permission')
        return
      }
      this.viewState = 'loading'
      try {
        const page = await listB8PolicyVersions()
        if (version !== this.requestVersion) return
        if (!session.isAuthenticated || !session.can('iam.policy.read')) {
          this.viewState = 'permission'
          this.lastError = b8PolicyT('permission')
          return
        }
        this.items = page.items
        this.nextCursor = page.nextCursor
        this.viewState = page.items.length ? 'ready' : 'empty'
      } catch (error) {
        if (version !== this.requestVersion) return
        this.items = []
        this.nextCursor = null
        this.viewState = error instanceof AdminApiError && error.status === 403 ? 'permission' : 'error'
        this.lastError = b8PolicyT(this.viewState === 'permission' ? 'permission' : 'error')
      }
    },
    async loadMore(): Promise<void> {
      const session = useAdminStore()
      const cursor = this.nextCursor
      if (this.viewState !== 'ready' || !cursor || this.loadingMore) return
      if (!session.isAuthenticated || !session.can('iam.policy.read')) {
        ++this.requestVersion
        this.items = []
        this.nextCursor = null
        this.viewState = 'permission'
        this.lastError = b8PolicyT('permission')
        return
      }
      const version = this.requestVersion
      this.loadingMore = true
      this.moreError = null
      try {
        const page = await listB8PolicyVersions(cursor)
        if (version !== this.requestVersion) return
        if (!session.isAuthenticated || !session.can('iam.policy.read')) {
          ++this.requestVersion
          this.items = []
          this.nextCursor = null
          this.viewState = 'permission'
          this.lastError = b8PolicyT('permission')
          return
        }
        this.items = [...this.items, ...page.items]
        this.nextCursor = page.nextCursor
      } catch (error) {
        if (version !== this.requestVersion) return
        if (!session.isAuthenticated || !session.can('iam.policy.read')
          || error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
          this.items = []
          this.nextCursor = null
          this.viewState = 'permission'
          this.lastError = b8PolicyT('permission')
        } else {
          this.moreError = b8PolicyT('moreError')
        }
      } finally {
        if (version === this.requestVersion) this.loadingMore = false
      }
    },
  },
})
