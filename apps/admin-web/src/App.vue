<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAdminStore } from './stores/admin'
import { authT } from './auth/i18n'

const route = useRoute()
const router = useRouter()
const session = useAdminStore()
const booting = ref(true)
void router.isReady().finally(() => {
  booting.value = false
})
const pageTitle = computed(() => ({ '/dashboard': '运营总览', '/content': '教研内容与双审', '/commerce': '商业化与风险', '/audit': '审计与合规', '/release': '跨端发布与质量', '/governance': '社群治理与恢复', '/support': '客服工单与恢复' }[route.path] ?? '中台'))
const menuItems = [
  { path: '/dashboard', label: '运营总览', icon: '▦', permission: 'admin.dashboard.read' },
  { path: '/content', label: '内容与双审', icon: '✎', permission: 'admin.content.read' },
  { path: '/commerce', label: '商业化与风险', icon: '◈', permission: 'admin.commerce.read' },
  { path: '/audit', label: '审计与合规', icon: '⌁', permission: 'admin.audit.read' },
  { path: '/release', label: '跨端发布与质量', icon: '◇', permission: 'admin.release.read' },
  { path: '/governance', label: '社群治理与恢复', icon: '⚑', permission: 'admin.moderation.read' },
  { path: '/support', label: '客服工单', icon: '⌂', permission: 'admin.support.read' },
]
const visibleMenuItems = computed(() => menuItems.filter((item) => session.can(item.permission)))
async function signOut(): Promise<void> {
  const ok = await session.logout()
  await router.push({ name: 'admin-login', query: ok ? undefined : { reason: 'logout-failed' } })
  ElMessage[ok ? 'info' : 'warning'](authT(ok ? 'session.logout' : 'session.logoutFailed'))
}
</script>

<template>
  <main v-if="booting" class="admin-startup" role="status" aria-live="polite">
    <span class="admin-brand__mark" aria-hidden="true">✦</span>
    <h1>语学星教研与运营中台</h1>
    <p>正在恢复管理员会话并检查权限…</p>
  </main>
  <el-container v-else-if="session.isAuthenticated" class="admin-shell">
    <el-aside width="248px" class="admin-aside">
      <div class="admin-brand"><span class="admin-brand__mark">✦</span><div><strong>语学星</strong><small>教研与运营中台</small></div></div>
      <div class="admin-context"><span class="status-dot"></span><span>{{ session.status === 'authenticated' ? authT('session.restored') : authT('session.restoring') }} · {{ authT('session.permissionSnapshot', { count: session.permissions.length }) }}</span></div>
      <el-menu :default-active="route.path" router class="admin-menu">
        <el-menu-item v-for="item in visibleMenuItems" :key="item.path" :index="item.path"><span>{{ item.icon }}</span><span>{{ item.label }}</span></el-menu-item>
      </el-menu>
      <div class="admin-aside__footer"><el-button text @click="signOut">退出管理员会话</el-button></div>
    </el-aside>
    <el-container>
      <el-header class="admin-header"><div><span class="admin-header__eyebrow">OPERATIONS CONTROL PLANE</span><h1>{{ pageTitle }}</h1></div><el-tag type="info" effect="plain">权限守卫已启用</el-tag></el-header>
      <el-main class="admin-main"><RouterView /></el-main>
    </el-container>
  </el-container>
  <RouterView v-else />
</template>
