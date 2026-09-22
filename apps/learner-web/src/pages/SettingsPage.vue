<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { useExperienceText } from '../platform/experience-ui'
const router = useRouter()
const session = useSessionStore()
const et = useExperienceText()
async function logout() { await session.logout(); await router.replace({ name: 'login' }) }
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import LearningPreferences from '../components/LearningPreferences.vue'
import { useB1Store } from '../stores/b1'
import { dailyQuotaOptions, type DailyQuotaMinutes } from '../domain/b1'

const props = defineProps<{ section?: string }>()
const b1 = useB1Store()
const nickname = ref('')
const accent = ref<'US' | 'UK'>('US')
const quota = ref<DailyQuotaMinutes>(15)
const showMinutes = ref(true)
const saving = ref(false)
const saved = ref(false)
const privacySaving = ref(false)
const privacySaved = ref(false)
const section = computed(() => props.section ?? 'profile')

onMounted(async () => {
  b1.restore()
  await b1.loadAccountData()
  nickname.value = b1.profile.nickname
  accent.value = b1.profile.accentPref
  quota.value = b1.profile.dailyQuotaMinutes
  showMinutes.value = b1.privacy.showMinutes
})

async function save(): Promise<void> {
  saving.value = true
  saved.value = false
  try {
    await b1.saveProfile({ nickname: nickname.value.trim() || '学习者', accentPref: accent.value, dailyQuotaMinutes: quota.value })
    saved.value = b1.syncState === 'synced'
  } finally {
    saving.value = false
  }
}

async function savePrivacy(): Promise<void> {
  privacySaving.value = true
  privacySaved.value = false
  try {
    await b1.savePrivacy({ ...b1.privacy, showMinutes: showMinutes.value })
    privacySaved.value = b1.syncState === 'synced'
  } finally {
    privacySaving.value = false
  }
}

async function exportData(): Promise<void> { await b1.exportData() }

async function revokeDevice(deviceId: string): Promise<void> { await b1.removeDevice(deviceId) }
async function revokeOthers(): Promise<void> { await b1.removeOtherDevices() }
async function refreshDevices(): Promise<void> { await b1.refreshDevices() }
</script>

<template>
  <section class="page-stack" aria-labelledby="settings-title">
    <ExperienceHeader page="Settings" icon="user" title-id="settings-title" />
    <nav class="settings-nav"><RouterLink :class="{ active: section === 'profile' }" to="/settings/profile">学习资料</RouterLink><RouterLink :class="{ active: section === 'privacy' }" to="/settings/privacy">隐私与数据</RouterLink><RouterLink :class="{ active: section === 'devices' }" to="/settings/devices">设备会话</RouterLink><RouterLink to="/platform">显示与性能</RouterLink></nav>
    <article v-if="section === 'profile'" class="form-card">
      <h3>学习资料</h3>
      <label>昵称<input v-model="nickname" /></label>
      <label>发音偏好<select v-model="accent"><option value="US">美式英语</option><option value="UK">英式英语</option></select></label>
      <label>每日目标<select v-model="quota"><option v-for="item in dailyQuotaOptions" :key="item" :value="item">{{ item }} 分钟</option></select></label>
      <button class="button button--primary" type="button" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存修改' }}</button>
      <p v-if="saved" class="success-text" role="status">资料已保存。</p>
      <h3>显示偏好</h3>
      <p class="muted">选择习惯的语言和阅读主题，让学习更舒服。</p>
      <LearningPreferences />
    </article>
    <article v-else-if="section === 'privacy'" class="form-card">
      <h3>隐私与数据</h3>
      <label class="privacy-toggle"><input v-model="showMinutes" type="checkbox" />展示学习时长</label>
      <p class="muted">当前展示范围：{{ b1.privacy.leaderboardVisibility === 'NICKNAME' ? '昵称' : '匿名' }}；学习时长展示：{{ showMinutes ? '开启' : '关闭' }}。</p>
      <button class="button button--primary" type="button" :disabled="privacySaving" @click="savePrivacy">{{ privacySaving ? '保存中…' : '保存偏好' }}</button>
      <p v-if="privacySaved" class="success-text" role="status">偏好已保存。</p>
      <button class="button button--secondary" type="button" @click="exportData">申请导出我的数据</button>
    </article>
    <article v-else class="form-card">
      <h3>设备会话</h3>
      <p class="muted">移除后，该设备需要重新登录才能使用账号。</p>
      <p v-if="!b1.devices.length" class="muted">暂无可展示的设备，请刷新列表重试。</p>
      <div v-for="device in b1.devices" :key="device.deviceId" class="device"><div><strong>{{ device.deviceName }}</strong><p>{{ device.region }} · {{ device.clientVersion }}</p></div><span>{{ device.current ? '当前设备' : device.status }}</span><button v-if="!device.current" class="button button--ghost" type="button" @click="revokeDevice(device.deviceId)">撤销</button></div>
      <div class="device-actions"><button class="button button--secondary" type="button" @click="refreshDevices">刷新设备列表</button><button class="button button--secondary" type="button" @click="revokeOthers">撤销其他设备</button></div>
    </article>
    <div class="account-signout"><span>{{ et('authNote') }}</span><button class="button button--ghost" type="button" @click="logout">{{ et('logout') }}</button></div>
    <p v-if="b1.lastError" class="error-text" role="alert">{{ b1.lastError }}</p>
  </section>
</template>

<style scoped>.muted{color:var(--yx-color-text-secondary)}.settings-nav{display:flex;gap:8px;flex-wrap:wrap}.settings-nav a{padding:10px 14px;border-radius:10px;color:var(--yx-color-text-secondary)}.settings-nav a.active{color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.form-card{display:grid;gap:18px;padding:28px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.form-card h3{margin:0 0 6px;font-size:24px}.form-card label{display:grid;gap:8px;color:var(--yx-color-text-secondary);font-weight:600}.form-card input,.form-card select{padding:12px;border:1px solid var(--yx-color-border);border-radius:10px;background:var(--yx-color-surface-card);color:inherit}.privacy-toggle{display:flex!important;align-items:center;gap:8px}.privacy-toggle input{width:auto}.device{display:flex;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--yx-color-border)}.device p{margin:6px 0 0;color:var(--yx-color-text-secondary);font-size:13px}.device>span{color:var(--yx-color-success);font-size:13px}.success-text{color:var(--yx-color-success)}.error-text{color:var(--yx-color-danger)}</style>
