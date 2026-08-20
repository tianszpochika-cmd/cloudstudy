import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const ACCESS_TOKEN_KEY = 'yx.session.access-token'
const REFRESH_TOKEN_KEY = 'yx.session.refresh-token'
const DEVICE_ID_KEY = 'yx.session.device-id'
const USER_ID_KEY = 'yx.session.user-id'

function readStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const token = window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  return token && token.trim().length > 0 ? token : null
}

function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') return null
  const value = window.sessionStorage.getItem(key)
  return value && value.trim() ? value : null
}

export const useSessionStore = defineStore('session', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const deviceId = ref<string | null>(null)
  const userId = ref<string | null>(null)
  const restored = ref(false)
  const isAuthenticated = computed(() => Boolean(accessToken.value))

  function restore(): void {
    if (restored.value) {
      return
    }

    accessToken.value = readStoredToken()
    refreshToken.value = readStoredValue(REFRESH_TOKEN_KEY)
    deviceId.value = readStoredValue(DEVICE_ID_KEY)
    userId.value = readStoredValue(USER_ID_KEY)
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

  function setTokenPair(tokens: { accessToken: string; refreshToken: string; devicePublicId: string; userId?: string }): void {
    const access = tokens.accessToken.trim()
    const refresh = tokens.refreshToken.trim()
    const device = tokens.devicePublicId.trim()
    if (!access || !refresh || !device) {
      clear()
      return
    }
    accessToken.value = access
    refreshToken.value = refresh
    deviceId.value = device
    userId.value = tokens.userId?.trim() || null
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, access)
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh)
      window.sessionStorage.setItem(DEVICE_ID_KEY, device)
      if (userId.value) window.sessionStorage.setItem(USER_ID_KEY, userId.value)
      else window.sessionStorage.removeItem(USER_ID_KEY)
    }
  }

  function clear(): void {
    accessToken.value = null
    refreshToken.value = null
    deviceId.value = null
    userId.value = null
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY)
      window.sessionStorage.removeItem(DEVICE_ID_KEY)
      window.sessionStorage.removeItem(USER_ID_KEY)
    }
  }

  return {
    accessToken,
    refreshToken,
    deviceId,
    userId,
    restored,
    isAuthenticated,
    restore,
    setAccessToken,
    setTokenPair,
    clear,
  }
})

export function readAccessToken(): string | null {
  return readStoredToken()
}

export function readRefreshToken(): string | null {
  return readStoredValue(REFRESH_TOKEN_KEY)
}

export function readDeviceId(): string | null {
  return readStoredValue(DEVICE_ID_KEY)
}
