<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAdminStore } from './stores/admin'
import { authT } from './auth/i18n'
import AdminIcon, { type AdminIconName } from './components/AdminIcon.vue'
import { adminThemeController } from './platform/v2-foundation'

const route = useRoute()
const router = useRouter()
const session = useAdminStore()
const booting = ref(true)
const showNotifications = ref(false)
const resolvedTheme = ref(adminThemeController.resolvedTheme)
const unsubscribeTheme = adminThemeController.subscribe((state) => {
  resolvedTheme.value = state.resolvedTheme
})
void router.isReady().finally(() => {
  booting.value = false
})
const pageTitle = computed(() => ({ '/dashboard': '运营总览', '/content': '教研内容与双审', '/commerce': '商业化与风险', '/audit': '审计与合规', '/release': '跨端发布与质量', '/governance': '社群治理与恢复', '/support': '客服工单与恢复', '/recovery': '人工恢复台' }[route.path] ?? '中台'))
const menuItems: Array<{ path: string; label: string; icon: AdminIconName; permission: string }> = [
  { path: '/dashboard', label: '运营总览', icon: 'chart', permission: 'admin.dashboard.read' },
  { path: '/content', label: '内容与双审', icon: 'content', permission: 'admin.content.read' },
  { path: '/commerce', label: '商业化与风险', icon: 'wallet', permission: 'admin.commerce.read' },
  { path: '/audit', label: '审计与合规', icon: 'audit', permission: 'admin.audit.read' },
  { path: '/release', label: '跨端发布与质量', icon: 'release', permission: 'admin.release.read' },
  { path: '/governance', label: '社群治理与恢复', icon: 'flag', permission: 'admin.moderation.read' },
  { path: '/support', label: '客服工单', icon: 'support', permission: 'admin.support.read' },
  { path: '/recovery', label: '人工恢复台', icon: 'help', permission: 'admin.recovery.read' },
]
const visibleMenuItems = computed(() => menuItems.filter((item) => session.can(item.permission)))
const themeLabel = computed(() => resolvedTheme.value === 'dark' ? '切换到浅色模式' : '切换到深色模式')

function toggleTheme(): void {
  adminThemeController.setTheme(resolvedTheme.value === 'dark' ? 'light' : 'dark')
}

async function signOut(): Promise<void> {
  const ok = await session.logout()
  await router.push({ name: 'admin-login', query: ok ? undefined : { reason: 'logout-failed' } })
  ElMessage[ok ? 'info' : 'warning'](authT(ok ? 'session.logout' : 'session.logoutFailed'))
}

onUnmounted(unsubscribeTheme)
</script>

<template>
  <main v-if="booting" class="admin-startup" role="status" aria-live="polite">
    <span class="admin-brand__mark" aria-hidden="true"><AdminIcon name="spark" :size="22" /></span>
    <h1>语学星教研与运营中台</h1>
    <p>正在恢复管理员会话并检查权限…</p>
  </main>
  <el-container v-else-if="session.isAuthenticated" class="admin-shell">
    <el-aside width="248px" class="admin-aside">
      <RouterLink class="admin-brand" to="/dashboard" aria-label="返回运营总览"><span class="admin-brand__mark"><AdminIcon name="spark" :size="20" /></span><span><strong>语学星</strong><small>教研与运营中台</small></span></RouterLink>
      <div class="admin-context"><span class="status-dot"></span><span>{{ session.status === 'authenticated' ? authT('session.restored') : authT('session.restoring') }} · {{ authT('session.permissionSnapshot', { count: session.permissions.length }) }}</span></div>
      <el-menu :default-active="route.path" router class="admin-menu">
        <el-menu-item v-for="item in visibleMenuItems" :key="item.path" :index="item.path"><span class="admin-menu__icon"><AdminIcon :name="item.icon" :size="18" /></span><span>{{ item.label }}</span></el-menu-item>
      </el-menu>
      <div class="admin-aside__footer"><el-button text @click="signOut">退出管理员会话</el-button></div>
    </el-aside>
    <el-container>
      <el-header class="admin-header">
        <div class="admin-header__heading"><span class="admin-header__eyebrow">OPERATIONS CONTROL PLANE</span><h1>{{ pageTitle }}</h1></div>
        <div class="admin-header__actions">
          <label class="admin-search"><AdminIcon name="search" :size="17" /><input type="search" placeholder="搜索内容、工单或发布批次" aria-label="搜索内容、工单或发布批次" /></label>
          <button class="admin-icon-button" type="button" :aria-label="themeLabel" @click="toggleTheme"><AdminIcon name="spark" :size="18" /></button>
          <button class="admin-icon-button admin-icon-button--notification" type="button" aria-label="查看后台提醒" :aria-expanded="showNotifications" @click="showNotifications = !showNotifications"><span class="notification-dot"></span><AdminIcon name="support" :size="18" /></button>
          <span class="admin-role-chip"><span class="status-dot"></span>权限守卫已启用</span>
        </div>
        <div v-if="showNotifications" class="admin-notification-popover" role="status"><strong>后台提醒</strong><span>发布、审计和客服操作都需要服务端权限快照。</span><button type="button" @click="showNotifications = false">知道了</button></div>
      </el-header>
      <el-main class="admin-main"><RouterView /></el-main>
    </el-container>
  </el-container>
  <RouterView v-else />
</template>
