<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getUniRuntime } from '../../platform/uni-runtime'
import { authT } from '../../auth/i18n'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const error = ref<string | null>(null)
onLoad(async (options) => {
  if (await session.completeLogin({ code: options?.code, state: options?.state, error: options?.error, errorDescription: options?.error_description, returnTo: options?.returnTo ?? options?.redirect })) getUniRuntime().navigateTo({ url: session.consumeReturnTo() })
  else error.value = session.lastError ?? authT('callback.failed')
})
</script>

<template><view class="yx-page"><text class="yx-title">{{ authT('callback.title') }}</text><text v-if="!error" class="yx-description">{{ authT('callback.restoring') }}</text><text v-else class="yx-error" role="alert">{{ error }}</text><button v-if="error" class="yx-button" type="button" @click="getUniRuntime().navigateTo({ url: '/pages/login/login' })">{{ authT('forbidden.login') }}</button></view></template>
