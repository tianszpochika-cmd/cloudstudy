<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAdminStore } from './stores/admin'
import { authT } from './auth/i18n'
import { adminT } from './platform/admin-i18n'
import './platform/i18n-batch-b'
import AdminIcon, { type AdminIconName } from './components/AdminIcon.vue'
import AdminLocaleSwitcher from './components/AdminLocaleSwitcher.vue'
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
const pageTitle = computed(() => ({ '/dashboard': adminT('app.pageDashboard'), '/content': adminT('app.pageContent'), '/commerce': adminT('app.pageCommerce'), '/audit': adminT('app.pageAudit'), '/release': adminT('app.pageRelease'), '/governance': adminT('app.pageGovernance'), '/support': adminT('app.pageSupport'), '/recovery': adminT('app.pageRecovery') }[route.path] ?? adminT('app.pageFallback')))
const menuItems = computed<Array<{ path: string; label: string; icon: AdminIconName; permission: string }>>(() => [
  { path: '/dashboard', label: adminT('app.menuDashboard'), icon: 'chart', permission: 'admin.dashboard.read' },
  { path: '/content', label: adminT('app.menuContent'), icon: 'content', permission: 'admin.content.read' },
  { path: '/commerce', label: adminT('app.menuCommerce'), icon: 'wallet', permission: 'admin.commerce.read' },
  { path: '/audit', label: adminT('app.menuAudit'), icon: 'audit', permission: 'admin.audit.read' },
  { path: '/release', label: adminT('app.menuRelease'), icon: 'release', permission: 'admin.release.read' },
  { path: '/governance', label: adminT('app.menuGovernance'), icon: 'flag', permission: 'admin.moderation.read' },
  { path: '/support', label: adminT('app.menuSupport'), icon: 'support', permission: 'admin.support.read' },
  { path: '/recovery', label: adminT('app.menuRecovery'), icon: 'help', permission: 'admin.recovery.read' },
])
const visibleMenuItems = computed(() => menuItems.value.filter((item) => session.can(item.permission)))
const themeLabel = computed(() => resolvedTheme.value === 'dark' ? adminT('app.themeToLight') : adminT('app.themeToDark'))

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
    <h1>{{ adminT('app.brandTitle') }}</h1>
    <p>{{ adminT('app.bootingNote') }}</p>
  </main>
  <el-container v-else-if="session.isAuthenticated" class="admin-shell">
    <el-aside width="248px" class="admin-aside">
      <RouterLink class="admin-brand" to="/dashboard" :aria-label="adminT('app.brandHomeAria')"><span class="admin-brand__mark"><AdminIcon name="spark" :size="20" /></span><span><strong>{{ adminT('app.brandName') }}</strong><small>{{ adminT('app.brandSub') }}</small></span></RouterLink>
      <div class="admin-context"><span class="status-dot"></span><span>{{ session.status === 'authenticated' ? authT('session.restored') : authT('session.restoring') }} · {{ authT('session.permissionSnapshot', { count: session.permissions.length }) }}</span></div>
      <el-menu :default-active="route.path" router class="admin-menu">
        <el-menu-item v-for="item in visibleMenuItems" :key="item.path" :index="item.path"><span class="admin-menu__icon"><AdminIcon :name="item.icon" :size="18" /></span><span>{{ item.label }}</span></el-menu-item>
      </el-menu>
      <div class="admin-aside__footer"><el-button text @click="signOut">{{ adminT('app.signOut') }}</el-button></div>
    </el-aside>
    <el-container>
      <el-header class="admin-header">
        <div class="admin-header__heading"><span class="admin-header__eyebrow">OPERATIONS CONTROL PLANE</span><h1>{{ pageTitle }}</h1></div>
        <div class="admin-header__actions">
          <label class="admin-search"><AdminIcon name="search" :size="17" /><input type="search" :placeholder="adminT('app.searchPlaceholder')" :aria-label="adminT('app.searchPlaceholder')" /></label>
          <button class="admin-icon-button" type="button" :aria-label="themeLabel" @click="toggleTheme"><AdminIcon name="spark" :size="18" /></button>
          <AdminLocaleSwitcher />
          <button class="admin-icon-button admin-icon-button--notification" type="button" :aria-label="adminT('app.notificationsAria')" :aria-expanded="showNotifications" @click="showNotifications = !showNotifications"><span class="notification-dot"></span><AdminIcon name="support" :size="18" /></button>
          <span class="admin-role-chip"><span class="status-dot"></span>{{ adminT('app.guardEnabled') }}</span>
        </div>
        <div v-if="showNotifications" class="admin-notification-popover" role="status"><strong>{{ adminT('app.notifTitle') }}</strong><span>{{ adminT('app.notifBody') }}</span><button type="button" @click="showNotifications = false">{{ adminT('app.notifDismiss') }}</button></div>
      </el-header>
      <el-main class="admin-main"><RouterView /></el-main>
    </el-container>
  </el-container>
  <RouterView v-else />
</template>
