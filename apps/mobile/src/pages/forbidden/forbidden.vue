<script setup lang="ts">
import { authT } from '../../auth/i18n'
import { useSessionStore } from '../../stores/session'
const session = useSessionStore()
</script>

<template><view class="yx-page"><text class="yx-title">{{ authT('forbidden.title') }}</text><text class="yx-description">{{ authT('forbidden.description') }}</text><text v-if="!session.permissions.length" class="yx-description">{{ authT('forbidden.empty') }}</text><button class="yx-button" type="button" @click="session.clear()">{{ authT('forbidden.login') }}</button></view></template>

