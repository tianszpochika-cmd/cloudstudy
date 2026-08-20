import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getUniRuntime } from '../platform/uni-runtime'

const ACCESS_TOKEN_KEY = 'yx.session.access-token'

export const useSessionStore = defineStore('session', () => {
  const accessToken = ref<string | null>(null)
  const restored = ref(false)
  const isAuthenticated = computed(() => Boolean(accessToken.value))

  function restore(): void {
    if (restored.value) {
      return
    }

    const stored = getUniRuntime().getStorageSync(ACCESS_TOKEN_KEY)
    accessToken.value = typeof stored === 'string' && stored.trim() ? stored : null
    restored.value = true
  }

  function setAccessToken(token: string): void {
    const normalized = token.trim()
    if (!normalized) {
      clear()
      return
    }

    accessToken.value = normalized
    getUniRuntime().setStorageSync(ACCESS_TOKEN_KEY, normalized)
  }

  function clear(): void {
    accessToken.value = null
    getUniRuntime().removeStorageSync(ACCESS_TOKEN_KEY)
  }

  return {
    accessToken,
    restored,
    isAuthenticated,
    restore,
    setAccessToken,
    clear,
  }
})

export function readAccessToken(): string | null {
  const value = getUniRuntime().getStorageSync(ACCESS_TOKEN_KEY)
  return typeof value === 'string' && value.trim() ? value : null
}
