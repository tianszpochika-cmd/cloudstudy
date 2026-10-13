<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import { useExperienceText } from '../platform/experience-ui'
const t = useExperienceText()
</script>
<template>
  <main class="auth-layout v2-auth">
    <div class="auth-content v2-auth-form"><div class="auth-topline v2-auth-topline"><RouterLink class="brand" :to="{ name: 'login' }"><AppIcon name="spark" :size="25" /><span>{{ t('brand') }}</span></RouterLink><span>{{ t('authNote') }}</span></div><slot /></div>
  </main>
</template>
<style>
.auth-layout.v2-auth { display: flex; justify-content: flex-start; background: var(--v2-bg); color: var(--v2-ink); font-family: var(--v2-font); gap: 0; padding: 32px 40px 64px; min-height: 100dvh; }
.auth-content.v2-auth-form { display: block; width: 100%; max-width: 1080px; margin: 0 auto; padding: 0; min-height: auto; background: transparent; border: 0; border-radius: 0; box-shadow: none; }
.v2-auth-topline { width: 100%; margin-bottom: 80px; align-items: center; }
.v2-auth-form .login-card { width: min(420px, 100%); margin: 0 auto; }
.v2-auth-form .field { gap: 8px; font-weight: 500; }
.v2-auth-form .field input { min-height: 48px; border-radius: 10px; border-color: var(--v2-line); background: var(--v2-card); font-size: var(--v2-text-md); font-weight: 400; }
.v2-auth-form .field input:focus { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.v2-auth-topline .brand { flex-shrink: 0; min-height: 44px; white-space: nowrap; color: var(--v2-ink); }
.v2-auth-topline .brand svg { color: var(--v2-brand); }
.v2-auth-topline > span { min-width: 0; overflow-wrap: anywhere; color: var(--v2-mut); }
.v2-auth-form .field input[aria-invalid="true"] { border-color: var(--v2-bad); }
.v2-auth-form .password-field input { padding-right: 58px !important; }
.v2-auth-form .password-field button { top: 50%; transform: translateY(-50%); width: 44px; height: 44px; }
.v2-auth .v2-auth-title{margin:0 0 8px;font-size:28px;line-height:1.4;letter-spacing:0;font-weight:650;text-align:center;color:var(--v2-ink)}
.v2-auth .v2-auth-lead{margin:0;line-height:1.75;font-size:14px;text-align:center;color:var(--v2-mut)}
.v2-auth .v2-auth-fields{margin-top:32px;gap:20px}
.v2-auth .v2-field>span,.v2-auth .v2-field>label{color:var(--v2-ink);font-size:14px;font-weight:500;line-height:1.6}
.v2-auth .v2-auth-links{display:flex;justify-content:space-between;font-size:13px}
.v2-auth .v2-auth-links{flex-wrap:wrap;gap:8px 16px}
.v2-auth .v2-auth-links a{display:inline-flex;align-items:center;min-height:44px;color:var(--v2-brand);font-weight:600;text-decoration:none}
.v2-auth .v2-auth-links a:hover{text-decoration:underline}
.v2-auth .v2-auth-status{margin-top:0;padding:12px 14px;background:var(--v2-soft);border-radius:8px;color:var(--v2-ink)}
.v2-auth .v2-auth-status.login-status--error{background:var(--v2-bad-soft);color:var(--v2-bad)}
.v2-auth .v2-btn--primary{min-height:48px;padding:12px 20px;background:var(--v2-brand);color:var(--v2-inverse);border-radius:10px;box-shadow:none;font-size:16px;line-height:1.5;font-weight:600;transition:background var(--v2-motion-fast)}
.v2-auth .v2-btn--primary:hover:not(:disabled){background:var(--v2-brand2)}
.v2-auth .v2-btn--block{width:100%}
.v2-auth .v2-auth-micro{color:var(--v2-mut);font-size:14px;line-height:1.6}
.v2-auth .v2-btn--ghost{background:var(--v2-card);color:var(--v2-brand);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);font-weight:600}
.v2-auth .v2-btn--ghost:hover{background:var(--v2-soft)}
.v2-auth .v2-auth-micro a{color:var(--v2-brand);font-weight:600}
@media (max-width: 820px) {
  .auth-layout.v2-auth { padding: 24px 28px 48px; }
  .v2-auth-topline { margin-bottom: 56px; }
}
@media (max-width: 520px) {
  .auth-layout.v2-auth { padding: 20px 24px 40px; }
  .v2-auth-topline { flex-direction: column; align-items: flex-start; gap: 0; margin-bottom: 40px; }
}
</style>
