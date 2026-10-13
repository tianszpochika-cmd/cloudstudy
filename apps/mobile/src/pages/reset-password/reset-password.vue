<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const step = ref<'request' | 'confirm'>('request')
const identifier = ref('')
const token = ref('')
const newPassword = ref('')
const submitting = ref(false)
const done = ref(false)
const resetCompleted = ref(false)
const error = ref<string | null>(null)

function initialize(options?: { token?: string }): void {
  if (typeof options?.token === 'string' && options.token) {
    token.value = options.token
    step.value = 'confirm'
  }
}

onLoad((options) => { initialize(options) })

async function send(): Promise<void> {
  if (submitting.value) return
  error.value = null
  if (!identifier.value.trim()) {
    error.value = mobileT('auth.resetPassword.requiredIdentifier')
    return
  }
  submitting.value = true
  try {
    done.value = await session.requestPasswordReset(identifier.value)
    if (!done.value) error.value = mobileAuthFailureCopy('resetRequest', session.lastError, mobileT)
  } finally {
    submitting.value = false
  }
}

async function confirm(): Promise<void> {
  if (submitting.value) return
  error.value = null
  if (!identifier.value.trim() || !token.value.trim() || !newPassword.value) {
    error.value = mobileT('auth.resetPassword.requiredFields')
    return
  }
  if (newPassword.value.length < 12) {
    error.value = mobileT('auth.resetPassword.shortPassword')
    return
  }
  submitting.value = true
  try {
    done.value = await session.confirmPasswordReset(identifier.value, token.value, newPassword.value)
    if (done.value) { resetCompleted.value = true; identifier.value = ''; token.value = ''; newPassword.value = '' }
    if (!done.value) error.value = mobileAuthFailureCopy('resetConfirm', session.lastError, mobileT)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="yx-page yx-login-page v2-reset" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="reset-password" />

    <view class="v2-reset-brand" aria-hidden="true"><text class="v2-reset-brand-mark">✦</text></view>

    <view class="yx-card yx-login-card v2-reset-card" :aria-busy="submitting">
      <text class="v2-reset-title">{{ mobileT('auth.resetPassword.resetAction') }}</text>
      <text class="mobile-auth-note v2-reset-desc">{{ mobileT('adultNote') }}</text>
      <text v-if="resetCompleted" class="mobile-success-note v2-reset-note" role="status" aria-live="polite">{{ mobileT('resetComplete') }}</text>
      <text v-else-if="done && step === 'request'" class="mobile-success-note v2-reset-note" role="status" aria-live="polite">{{ mobileT('resetSent') }}</text>
      <text v-if="!resetCompleted && !(done && step === 'request')" class="mobile-auth-note v2-reset-note">{{ mobileT(step === 'request' ? 'auth.resetPassword.requestHint' : 'auth.resetPassword.confirmHint') }}</text>
      <form v-if="!resetCompleted && step === 'request'" class="v2-reset-form" @submit="send" :aria-busy="submitting">
        <label class="yx-field v2-reset-field">
          <text>{{ mobileT('auth.resetPassword.identifier') }}</text>
          <input class="v2-reset-input" :aria-label="mobileT('auth.resetPassword.identifier')" v-model="identifier" type="text" autocomplete="username" :placeholder="mobileT('auth.resetPassword.requestIdentifierPlaceholder')" :disabled="submitting" />
        </label>
        <text v-if="error" class="yx-login-error v2-reset-error" role="alert" aria-live="polite">{{ error }}</text>
        <button tabindex="0" role="button" class="yx-button v2-reset-primary" form-type="submit" :disabled="submitting">{{ submitting ? mobileT('auth.resetPassword.sending') : mobileT('auth.resetPassword.sendInstructions') }}</button>
        <button tabindex="0" role="button" class="mobile-text-button v2-reset-secondary" type="button" @click="step = 'confirm'">{{ mobileT('auth.resetPassword.receivedCode') }}</button>
      </form>
      <form v-else-if="!resetCompleted" class="v2-reset-form" @submit="confirm" :aria-busy="submitting">
        <label class="yx-field v2-reset-field">
          <text>{{ mobileT('auth.resetPassword.identifier') }}</text>
          <input class="v2-reset-input" :aria-label="mobileT('auth.resetPassword.identifier')" v-model="identifier" type="text" autocomplete="username" :placeholder="mobileT('auth.resetPassword.confirmIdentifierPlaceholder')" :disabled="submitting" />
        </label>
        <label class="yx-field v2-reset-field">
          <text>{{ mobileT('auth.resetPassword.token') }}</text>
          <input class="v2-reset-input" :aria-label="mobileT('auth.resetPassword.token')" v-model="token" type="text" autocomplete="one-time-code" :placeholder="mobileT('auth.resetPassword.tokenPlaceholder')" :disabled="submitting" />
        </label>
        <label class="yx-field v2-reset-field">
          <text>{{ mobileT('auth.resetPassword.newPassword') }}</text>
          <input class="v2-reset-input" :aria-label="mobileT('auth.resetPassword.newPassword')" v-model="newPassword" type="password" autocomplete="new-password" :placeholder="mobileT('auth.resetPassword.newPasswordPlaceholder')" :disabled="submitting" />
        </label>
        <text v-if="error" class="yx-login-error v2-reset-error" role="alert" aria-live="polite">{{ error }}</text>
        <button tabindex="0" role="button" class="yx-button v2-reset-primary" form-type="submit" :disabled="submitting">{{ submitting ? mobileT('auth.resetPassword.resetting') : mobileT('auth.resetPassword.resetAction') }}</button>
        <button tabindex="0" role="button" class="mobile-text-button v2-reset-secondary" type="button" @click="step = 'request'">{{ mobileT('auth.resetPassword.back') }}</button>
      </form>
      <button tabindex="0" role="button" class="mobile-text-button v2-reset-secondary" @click="openUniPage('/pages/login/login')">{{ mobileT('toLogin') }}</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* v2 重置密码页换皮：对齐 register.vue 中 v2-register-* 规则（同值换类名），
 * 成功提示用 var(--v2-ok)/var(--v2-ok-soft) 补齐。
 * 颜色/间距/圆角/字体/阴影一律取 var(--v2-*)，深色经 .yx-theme-dark 自动切换。 */
.v2-reset {
  box-sizing: border-box;
  background: var(--v2-bg);
  color: var(--v2-ink);
  font-family: var(--v2-font);
  padding: var(--v2-space-5) var(--v2-space-4) var(--v2-space-8);
}
.v2-reset-brand {
  display: flex;
  justify-content: center;
  padding: var(--v2-space-4) var(--v2-space-2) var(--v2-space-2);
}
.v2-reset-brand-mark {
  display: grid;
  place-items: center;
  width: var(--v2-space-12);
  height: var(--v2-space-12);
  border-radius: var(--v2-radius-lg);
  background: var(--v2-grad);
  color: var(--v2-inverse);
  font-size: var(--v2-text-xl);
  box-shadow: var(--v2-shadow-pop);
}
.v2-reset-card {
  box-sizing: border-box;
  background: var(--v2-card);
  border: 1px solid var(--v2-line);
  border-radius: var(--v2-radius-lg);
  padding: var(--v2-space-6);
  box-shadow: var(--v2-shadow-pop);
  margin-top: var(--v2-space-4);
}
.v2-reset-title {
  display: block;
  margin: 0 0 var(--v2-space-2);
  color: var(--v2-ink);
  font-family: var(--v2-font);
  font-size: var(--v2-text-lg);
  font-weight: 700;
  line-height: 1.35;
}
.v2-reset-desc,
.v2-reset-note {
  display: block;
  margin: 0 0 var(--v2-space-4);
  color: var(--v2-mut);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  line-height: 1.6;
}
.mobile-success-note.v2-reset-note {
  color: var(--v2-ok);
  background: var(--v2-ok-soft);
  border-radius: var(--v2-radius-md);
  padding: var(--v2-space-2) var(--v2-space-3);
}
.v2-reset-form {
  display: grid;
  gap: var(--v2-space-4);
  margin-top: var(--v2-space-4);
}
.v2-reset-field {
  display: grid;
  gap: var(--v2-space-2);
  margin: 0;
  color: var(--v2-ink);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  font-weight: 600;
}
.v2-reset-input {
  box-sizing: border-box;
  width: 100%;
  min-height: var(--v2-space-12);
  padding: var(--v2-space-3);
  border: 1px solid var(--v2-line);
  border-radius: var(--v2-radius-md);
  background: var(--v2-card);
  color: var(--v2-ink);
  font-family: var(--v2-font);
  font-size: var(--v2-text-md);
  line-height: 1.5;
  &::placeholder {
    color: var(--v2-mut);
  }
  &:focus {
    border-color: var(--v2-brand);
    box-shadow: var(--v2-focus);
    outline: none;
  }
  &:focus-visible {
    border-color: var(--v2-brand);
    box-shadow: var(--v2-focus);
    outline: none;
  }
  &:disabled {
    opacity: 0.55;
  }
}
.v2-reset-error {
  display: block;
  margin-top: var(--v2-space-2);
  color: var(--v2-bad);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  line-height: 1.55;
}
.v2-reset-primary {
  box-sizing: border-box;
  width: 100%;
  min-height: var(--v2-space-12);
  margin-top: var(--v2-space-2);
  padding: var(--v2-space-3) var(--v2-space-4);
  border: 1px solid transparent;
  border-radius: var(--v2-radius-md);
  background: var(--v2-grad);
  color: var(--v2-inverse);
  font-family: var(--v2-font);
  font-size: var(--v2-text-md);
  font-weight: 700;
  text-align: center;
  box-shadow: var(--v2-shadow);
  cursor: pointer;
  &:hover {
    filter: brightness(0.94);
  }
  &:active {
    transform: scale(0.97);
  }
  &:focus-visible {
    box-shadow: var(--v2-focus);
    outline: none;
  }
  &:disabled {
    background: var(--v2-surface);
    color: var(--v2-mut);
    border: 1px dashed var(--v2-line);
    box-shadow: none;
    filter: none;
    opacity: 1;
    cursor: not-allowed;
  }
}
.v2-reset-secondary {
  display: block;
  width: 100%;
  min-height: var(--v2-space-8);
  margin-top: var(--v2-space-2);
  padding: var(--v2-space-2) var(--v2-space-3);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--v2-radius-md);
  color: var(--v2-brand);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  &:last-of-type {
    color: var(--v2-mut);
  }
  &:focus-visible {
    box-shadow: var(--v2-focus);
    outline: none;
  }
}
</style>
