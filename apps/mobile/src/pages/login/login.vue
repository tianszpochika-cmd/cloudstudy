<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import { authT } from '../../auth/i18n'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { continueAfterLogin } from '../../auth/navigation'
import { safeMobileRouteReturnTo } from '../../auth/gateway-auth'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const showPassword = ref(false)
const identifier = ref('')
const password = ref('')
const returnTo = ref('/pages/home/home')
const submitting = ref(false)
const initialized = ref(false)
const error = ref<string | null>(null)

function timeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds)),
  ])
}

async function initialize(options?: { returnTo?: string; redirect?: string }): Promise<void> {
  if (initialized.value) return
  initialized.value = true
  const requested = safeMobileRouteReturnTo(options?.returnTo ?? options?.redirect, '')
  returnTo.value = requested || safeMobileRouteReturnTo(session.peekReturnTo())
  session.setReturnTo(returnTo.value)
  try {
    await timeout(session.restore(), 1500, '会话恢复超时')
    if (session.isAuthenticated) {
      await continueAfterLogin(session.consumeReturnTo())
    }
  } catch {
    // The form remains available when an existing cookie/session cannot be restored.
  }
}

onLoad((options) => { void initialize(options) })
onMounted(() => { void initialize() })

async function submit(): Promise<void> {
  if (submitting.value) return
  if (!identifier.value.trim() || !password.value) {
    error.value = authT('login.required')
    return
  }
  submitting.value = true
  error.value = null
  try {
    const success = await timeout(session.login(identifier.value, password.value), 10000, '登录服务响应超时，请稍后重试。')
    if (!success) {
      error.value = mobileAuthFailureCopy('login', session.lastError, mobileT)
      return
    }
    password.value = ''
    await continueAfterLogin(session.consumeReturnTo())
  } catch (cause) {
    error.value = mobileAuthFailureCopy('login', cause, mobileT)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="yx-page yx-login-page v2-login" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="login" compact />

    <view class="v2-login-brand" aria-hidden="true"><AppIcon name="spark" :size="28" /></view>

    <view class="yx-card yx-login-card v2-login-card">
      <text class="v2-login-title">{{ mobileT('account') }}</text>
      <text class="mobile-auth-note v2-login-desc">{{ mobileT('adultNote') }}</text>
      <!-- No .prevent here: uni emits submit as a component event whose payload has no
           preventDefault, and Vue skips a handler guarded by a modifier that does not apply to a
           non-DOM event. There is also no native default action left to cancel. -->
      <form class="v2-login-form" @submit="submit">
        <label class="yx-field v2-login-field">
          <text>{{ authT('login.identifier') }}</text>
          <input class="v2-login-input" :aria-label="authT('login.identifier')" v-model="identifier" type="text" autocomplete="username" :placeholder="authT('login.identifierPlaceholder')" :disabled="submitting" />
        </label>
        <label class="yx-field v2-login-field">
          <text>{{ authT('login.password') }}</text>
          <view class="mobile-password v2-login-password"><input class="v2-login-input" :aria-label="authT('login.password')" v-model="password" :password="!showPassword" type="text" autocomplete="current-password" :placeholder="authT('login.passwordPlaceholder')" :disabled="submitting" @confirm="submit" /><button tabindex="0" role="button" class="mobile-text-button mobile-password-toggle v2-login-toggle" :aria-pressed="showPassword" @click="showPassword = !showPassword">{{ mobileT(showPassword ? 'hide' : 'show') }}</button></view>
        </label>
        <text v-if="error" class="yx-login-error v2-login-error" role="alert">{{ error }}</text>
        <!-- uni-app resolves form submission from the form-type prop, not from the HTML type
             attribute: its button component only calls form.submit() when props.formType is
             'submit'. A plain type="submit" therefore looks right on H5 but never submits. -->
        <button tabindex="0" role="button" class="yx-button v2-login-primary" form-type="submit" :disabled="submitting">
          {{ submitting ? authT('login.submitting') : authT('login.start') }}
        </button>
      </form>
      <button tabindex="0" role="button" class="mobile-text-button v2-login-secondary" @click="openUniPage('/pages/register/register')">{{ mobileT('register') }} ↗</button>
      <button tabindex="0" role="button" class="mobile-text-button v2-login-secondary" @click="openUniPage('/pages/reset-password/reset-password')">{{ mobileT('forgot') }}</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* v2 登录页换皮：对齐 webDemo shared/components.css 中 .card/.lb/input/.btn/.btn.ghost，
 * 与 mobile/refine.css 登录区（品牌区居中、表单卡抬升、主按钮 50px、次按钮文本化）。
 * 颜色/间距/圆角/字体/阴影一律取 var(--v2-*)，深色经 .yx-theme-dark 自动切换。 */
.v2-login {
  box-sizing: border-box;
  background: var(--v2-bg);
  color: var(--v2-ink);
  font-family: var(--v2-font);
  padding: var(--v2-space-5) var(--v2-space-4) var(--v2-space-8);
}
.v2-login-brand {
  display: flex;
  justify-content: center;
  padding: var(--v2-space-4) var(--v2-space-2) var(--v2-space-2);
  color: #fff;
}
.v2-login-brand-mark {
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
.v2-login-card {
  box-sizing: border-box;
  background: var(--v2-card);
  border: 1px solid var(--v2-line);
  border-radius: var(--v2-radius-lg);
  padding: var(--v2-space-6);
  box-shadow: var(--v2-shadow-pop);
  margin-top: var(--v2-space-4);
}
.v2-login-title {
  display: block;
  margin: 0 0 var(--v2-space-2);
  color: var(--v2-ink);
  font-family: var(--v2-font);
  font-size: var(--v2-text-lg);
  font-weight: 700;
  line-height: 1.35;
}
.v2-login-desc {
  display: block;
  margin: 0 0 var(--v2-space-4);
  color: var(--v2-mut);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  line-height: 1.6;
}
.v2-login-form {
  display: grid;
  gap: var(--v2-space-4);
  margin-top: var(--v2-space-4);
}
.v2-login-field {
  display: grid;
  gap: var(--v2-space-2);
  margin: 0;
  color: var(--v2-ink);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  font-weight: 600;
}
.v2-login-input {
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
.v2-login-password {
  display: flex;
  align-items: center;
  gap: var(--v2-space-2);
  .v2-login-input {
    flex: 1;
    min-width: 0;
  }
}
.v2-login-toggle {
  flex: none;
  min-height: var(--v2-space-8);
  padding: var(--v2-space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--v2-radius-sm);
  color: var(--v2-brand);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  font-weight: 600;
  &:focus-visible {
    box-shadow: var(--v2-focus);
    outline: none;
  }
}
.v2-login-error {
  display: block;
  margin-top: var(--v2-space-2);
  color: var(--v2-bad);
  font-family: var(--v2-font);
  font-size: var(--v2-text-sm);
  line-height: 1.55;
}
.v2-login-primary {
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
.v2-login-secondary {
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
