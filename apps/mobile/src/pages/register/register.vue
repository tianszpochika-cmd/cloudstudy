<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { continueAfterLogin } from '../../auth/navigation'
import { safeMobileReturnTo } from '../../auth/gateway-auth'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const identifier = ref('')
const password = ref('')
const confirm = ref('')
const returnTo = ref('/pages/home/home')
const submitting = ref(false)
const error = ref<string | null>(null)
const hint = computed(() => {
  if (error.value) return error.value
  if (submitting.value) return mobileT('auth.register.submitting')
  return mobileT('auth.register.passwordHint')
})

function initialize(options?: { returnTo?: string; redirect?: string }): void {
  returnTo.value = safeMobileReturnTo(options?.returnTo ?? options?.redirect ?? session.peekReturnTo())
  session.setReturnTo(returnTo.value)
}

onLoad((options) => { initialize(options) })

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = null
  if (!identifier.value.trim() || !password.value) {
    error.value = mobileT('auth.register.required')
    return
  }
  if (password.value.length < 12) {
    error.value = mobileT('auth.register.shortPassword')
    return
  }
  if (password.value !== confirm.value) {
    error.value = mobileT('auth.register.mismatch')
    return
  }
  submitting.value = true
  try {
    const ok = await session.register(identifier.value, password.value)
    if (!ok) {
      error.value = mobileAuthFailureCopy('register', session.lastError, mobileT)
      return
    }
    password.value = ''
    confirm.value = ''
    continueAfterLogin(session.consumeReturnTo())
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="yx-page yx-login-page v2-register" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="register" />

    <view class="v2-register-brand" aria-hidden="true"><text class="v2-register-brand-mark">✦</text></view>

    <view class="yx-card yx-login-card v2-register-card" :aria-busy="submitting">
      <text class="v2-register-title">{{ mobileT('register') }}</text>
      <text class="mobile-auth-note v2-register-desc">{{ mobileT('adultNote') }}</text>
      <text class="mobile-auth-note v2-register-note">{{ mobileT('auth.register.passwordHint') }}</text>
      <form class="v2-register-form" @submit="submit" :aria-busy="submitting">
        <label class="yx-field v2-register-field">
          <text>{{ mobileT('auth.register.identifier') }}</text>
          <input class="v2-register-input" :aria-label="mobileT('auth.register.identifier')" v-model="identifier" type="text" autocomplete="username" :placeholder="mobileT('auth.register.identifierPlaceholder')" :disabled="submitting" />
        </label>
        <label class="yx-field v2-register-field">
          <text>{{ mobileT('auth.register.password') }}</text>
          <input class="v2-register-input" :aria-label="mobileT('auth.register.password')" v-model="password" type="password" autocomplete="new-password" :placeholder="mobileT('auth.register.passwordPlaceholder')" :disabled="submitting" />
        </label>
        <label class="yx-field v2-register-field">
          <text>{{ mobileT('auth.register.confirmPassword') }}</text>
          <input class="v2-register-input" :aria-label="mobileT('auth.register.confirmPassword')" v-model="confirm" type="password" autocomplete="new-password" :placeholder="mobileT('auth.register.confirmPasswordPlaceholder')" :disabled="submitting" />
        </label>
        <text v-if="error" class="yx-login-error v2-register-error" role="alert" aria-live="polite">{{ hint }}</text>
        <text v-else-if="submitting" class="mobile-auth-note v2-register-note" role="status" aria-live="polite">{{ hint }}</text>
        <button tabindex="0" role="button" class="yx-button v2-register-primary" form-type="submit" :disabled="submitting">
          {{ submitting ? mobileT('auth.register.submitting') : mobileT('auth.register.start') }}
        </button>
      </form>
      <button tabindex="0" role="button" class="mobile-text-button v2-register-secondary" @click="openUniPage('/pages/login/login')">{{ mobileT('toLogin') }}</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* v2 注册页换皮：对齐 webDemo shared/components.css 中 .card/.lb/input/.btn/.btn.ghost，
 * 与 mobile/refine.css 登录区（品牌区居中、表单卡抬升、主按钮 50px、次按钮文本化）。
 * 颜色/间距/圆角/字体/阴影一律取 var(--v2-*)，深色经 .yx-theme-dark 自动切换。 */
.v2-register {
  box-sizing: border-box;
  background: var(--v2-bg);
  color: var(--v2-ink);
  font-family: var(--v2-font);
  padding: var(--v2-space-5) var(--v2-space-4) var(--v2-space-8);
}
.v2-register-brand {
  display: flex;
  justify-content: center;
  padding: var(--v2-space-4) var(--v2-space-2) var(--v2-space-2);
}
.v2-register-brand-mark {
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
.v2-register-card {
  box-sizing: border-box;
  background: var(--v2-card);
  border: 1px solid var(--v2-line);
  border-radius: var(--v2-radius-lg);
  padding: var(--v2-space-6);
  box-shadow: var(--v2-shadow-pop);
  margin-top: var(--v2-space-4);
}
.v2-register-title {
  display: block;
  margin: 0 0 var(--v2-space-2);
  color: var(--v2-ink);
  font-family: var(--v2-font);
  font-size: var(--v2-text-lg);
  font-weight: 700;
  line-height: 1.35;
}
.v2-register-desc,
.v2-register-note {
  display: block;
  margin: 0 0 var(--v2-space-4);
  color: var(--v2-mut);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  line-height: 1.6;
}
.v2-register-form {
  display: grid;
  gap: var(--v2-space-4);
  margin-top: var(--v2-space-4);
}
.v2-register-field {
  display: grid;
  gap: var(--v2-space-2);
  margin: 0;
  color: var(--v2-ink);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  font-weight: 600;
}
.v2-register-input {
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
.v2-register-error {
  display: block;
  margin-top: var(--v2-space-2);
  color: var(--v2-bad);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  line-height: 1.55;
}
.v2-register-primary {
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
.v2-register-secondary {
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
