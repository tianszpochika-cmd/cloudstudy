import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const ACCESS_TOKEN_KEY = 'yx.session.access-token'

function readStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const token = window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  return token && token.trim().length > 0 ? token : null
}

export const useSessionStore = defineStore('session', () => {
  const accessToken = ref<string | null>(null)
  const restored = ref(false)
  const isAuthenticated = computed(() => Boolean(accessToken.value))

  function restore(): void {
    if (restored.value) {
      return
    }

    accessToken.value = readStoredToken()
    restored.value = true
  }

  function setAccessToken(token: string): void {
    const normalized = token.trim()
    if (!normalized) {
      clear()
      return
    }

    accessToken.value = normalized
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, normalized)
    }
  }

  function clear(): void {
    accessToken.value = null
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    }
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
  return readStoredToken()
}
