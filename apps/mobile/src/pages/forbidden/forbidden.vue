<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { authT } from '../../auth/i18n'
import { useSessionStore } from '../../stores/session'
import { openUniPage } from '../../platform/uni-runtime'
const session = useSessionStore()
onLoad((options) => { if (options?.returnTo) session.setReturnTo(options.returnTo) })
function returnToLogin(): void { session.clear(); openUniPage('/pages/login/login') }
</script>

<template><view class="yx-page"><text class="yx-title">{{ authT('forbidden.title') }}</text><text class="yx-description">{{ authT('forbidden.description') }}</text><text v-if="!session.permissions.length" class="yx-description">{{ authT('forbidden.empty') }}</text><button class="yx-button" type="button" @click="returnToLogin">{{ authT('forbidden.login') }}</button></view></template>
