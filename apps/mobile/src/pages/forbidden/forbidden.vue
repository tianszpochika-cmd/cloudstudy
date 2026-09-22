<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { authT } from '../../auth/i18n'
import { useSessionStore } from '../../stores/session'
import { openUniPage } from '../../platform/uni-runtime'
const session = useSessionStore()
onLoad((options) => { if (options?.returnTo) session.setReturnTo(options.returnTo) })
function returnToLogin(): void { session.clear(); openUniPage('/pages/login/login') }
</script>

<template><view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion"><MobilePageHeader page="forbidden" /><text v-if="!session.permissions.length" class="yx-description">如果你认为这是误判，请联系帮助中心。</text><button tabindex="0" role="button" class="yx-button" type="button" @click="returnToLogin">{{ authT('forbidden.login') }}</button></view></template>
