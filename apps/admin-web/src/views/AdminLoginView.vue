<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authT } from "../auth/i18n";
import { safeAdminReturnTo } from "../auth/gateway-auth";
import { useAdminStore } from "../stores/admin";
import { adminPages, ui } from "../platform/experience";
import AdminIcon from "../components/AdminIcon.vue";
import AdminPreferences from "../components/AdminPreferences.vue";
import AdminLocaleSwitcher from "../components/AdminLocaleSwitcher.vue";
const route = useRoute();
const router = useRouter();
const session = useAdminStore();
const identifier = ref("");
const password = ref("");
const showPassword = ref(false);
const capsLock = ref(false);
const submitting = ref(false);
const attempted = ref(false);
const errorMessage = ref<string | null>(null);
const accountInput = ref<HTMLInputElement | null>(null);
const passwordInput = ref<HTMLInputElement | null>(null);
const returnTo = computed(() => safeAdminReturnTo(route.query.redirect));
async function submit() {
  if (submitting.value) return;
  attempted.value = true;
  errorMessage.value = null;
  if (!identifier.value.trim() || !password.value) {
    await nextTick();
    (!identifier.value.trim()
      ? accountInput.value
      : passwordInput.value
    )?.focus();
    return;
  }
  submitting.value = true;
  session.setReturnTo(returnTo.value);
  try {
    const ok = await session.login(identifier.value, password.value);
    if (!ok) {
      errorMessage.value = ui("login.failed");
      return;
    }
    const target = session.consumeReturnTo();
    const targetPage = adminPages.find(
      (page) => page.path === target.split("?")[0],
    );
    await router.replace(
      targetPage && session.can(targetPage.permission)
        ? target
        : (adminPages.find((page) => session.can(page.permission))?.path ??
            "/forbidden"),
    );
  } catch {
    errorMessage.value = ui("login.failed");
  } finally {
    submitting.value = false;
    password.value = "";
    showPassword.value = false;
  }
}
</script>
<template>
  <main class="login-page">
    <header class="login-topbar">
      <div class="admin-brand">
        <span class="admin-brand__mark"
          ><AdminIcon name="spark" :size="24" /></span
        ><span
          ><strong>{{ ui("brand") }}</strong
          ><small>{{ ui("workspace") }}</small></span
        >
      </div>
      <div class="admin-header__actions">
        <AdminPreferences /><AdminLocaleSwitcher />
      </div>
    </header>
    <div class="login-layout">
      <section class="login-story">
        <span class="story-eyebrow"
          ><span></span>{{ ui("login.eyebrow") }}</span
        >
        <h2>{{ ui("login.story") }}</h2>
        <p>{{ ui("login.storyBody") }}</p>
        <div class="login-illustration" aria-hidden="true">
          <div class="orbit orbit-one"></div>
          <div class="orbit orbit-two"></div>
          <span class="illustration-spark">✦</span>
          <div class="editorial-card">
            <span class="editorial-card__icon"
              ><AdminIcon name="book" :size="35" /></span
            ><small>LEARN · GROW · CONNECT</small
            ><strong>Every day,<br />a little further.</strong>
            <div class="editorial-lines"><i></i><i></i></div>
            <span class="editorial-footer"
              >语学星 <AdminIcon name="spark"
            /></span>
          </div>
          <div class="floating-review">
            <AdminIcon name="shield" :size="23" /><span>{{
              ui("login.second")
            }}</span
            ><b>✓</b>
          </div>
          <div class="floating-word">
            <span>Aa</span><AdminIcon name="audio" :size="24" />
          </div>
        </div>
        <div class="story-steps">
          <span><b>01</b>{{ ui("login.first") }}</span
          ><span><b>02</b>{{ ui("login.second") }}</span
          ><span><b>03</b>{{ ui("login.third") }}</span>
        </div>
      </section>
      <section class="login-form-panel">
        <form
          class="login-card"
          novalidate
          :aria-busy="submitting"
          @submit.prevent="submit"
        >
          <span class="admin-header__eyebrow">{{ ui("workspace") }}</span>
          <h1>{{ ui("login.title") }}<span class="login-title-dot">.</span></h1>
          <p class="login-description">{{ ui("login.description") }}</p>
          <p
            v-if="route.query.reason === 'expired'"
            class="login-status"
            role="status"
          >
            {{ ui("login.expired") }}
          </p>
          <label class="admin-login-field"
            ><span>{{ authT("login.identifier") }}</span
            ><input
              ref="accountInput"
              v-model="identifier"
              name="identifier"
              type="text"
              autocomplete="username"
              :placeholder="authT('login.identifierPlaceholder')"
              :disabled="submitting"
              :aria-invalid="attempted && !identifier.trim()"
              :aria-describedby="
                attempted && !identifier.trim() ? 'account-error' : undefined
              "
            /><small
              v-if="attempted && !identifier.trim()"
              id="account-error"
              class="field-error"
              >{{ ui("login.accountRequired") }}</small
            ></label
          >
          <div class="admin-login-field">
            <label for="admin-password">{{ authT("login.password") }}</label>
            <div class="password-input">
              <input
                id="admin-password"
                ref="passwordInput"
                v-model="password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                :placeholder="authT('login.passwordPlaceholder')"
                :disabled="submitting"
                :aria-invalid="attempted && !password && !errorMessage"
                @keydown="capsLock = $event.getModifierState('CapsLock')"
                @keyup="capsLock = $event.getModifierState('CapsLock')"
              /><button
                type="button"
                :aria-label="ui(showPassword ? 'login.hide' : 'login.show')"
                :aria-pressed="showPassword"
                :disabled="submitting"
                @click="showPassword = !showPassword"
              >
                {{ ui(showPassword ? "login.hide" : "login.show") }}
              </button>
            </div>
            <small
              v-if="attempted && !password && !errorMessage"
              class="field-error"
              >{{ ui("login.passwordRequired") }}</small
            ><small v-if="capsLock" class="muted">{{ ui("login.caps") }}</small>
          </div>
          <p v-if="errorMessage" class="login-status" role="alert">
            {{ errorMessage }}
          </p>
          <button class="login-submit" type="submit" :disabled="submitting">
            <span>{{
              submitting ? authT("login.submitting") : authT("login.start")
            }}</span
            ><AdminIcon name="arrow" :size="20" />
          </button>
          <p class="login-help">{{ ui("login.access") }}</p>
          <div class="login-security">
            <AdminIcon name="shield" :size="16" />{{ ui("login.secure") }}
          </div>
        </form>
      </section>
    </div>
    <footer class="login-footer">
      {{ ui("brand") }} · {{ ui("login.eyebrow") }}
    </footer>
  </main>
</template>
