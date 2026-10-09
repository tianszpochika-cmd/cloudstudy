<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon, { type AppIconName } from '../components/AppIcon.vue'
import { learnerThemeController } from '../platform/v2-foundation'
import { useExperienceText } from '../platform/experience-ui'
import { listInboxMessages, type InboxMessage } from '../api/notifications'
import { useSessionStore } from '../stores/session'
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const t = useExperienceText()
const isRestricted = computed(() => session.adultGate === 'REJECTED')
const theme = ref(learnerThemeController.resolvedTheme)
const stopTheme = learnerThemeController.subscribe(s => { theme.value = s.resolvedTheme })
type Link = { name: string; key: string; icon: AppIconName; params?: { section: string } }
const primary: Link[] = [
  { name: 'home', key: 'home', icon: 'home' }, { name: 'today', key: 'today', icon: 'target' },
  { name: 'courses', key: 'courses', icon: 'book' }, { name: 'learn', key: 'learn', icon: 'route' },
]
const practices: Link[] = [
  { name: 'vocabulary', key: 'vocabulary', icon: 'cards' }, { name: 'b3-listening', key: 'listening', icon: 'headphones' },
  { name: 'b3-reading', key: 'reading', icon: 'book' }, { name: 'b3-speaking', key: 'speaking', icon: 'mic' },
  { name: 'b3-grammar', key: 'grammar', icon: 'spark' }, { name: 'b3-writing', key: 'writing', icon: 'pen' },
  { name: 'b2-practice', key: 'practice', icon: 'check' },
]
const growth: Link[] = [
  { name: 'world', key: 'world', icon: 'globe' }, { name: 'b2-report', key: 'report', icon: 'chart' },
  { name: 'mistakes', key: 'mistakes', icon: 'bookmark' }, { name: 'mastery', key: 'mastery', icon: 'star' },
  { name: 'plan-map', key: 'plan', icon: 'route' },
]
const account: Link[] = [
  { name: 'settings', key: 'settings', icon: 'settings', params: { section: 'profile' } },
  { name: 'commerce', key: 'commerce', icon: 'wallet' }, { name: 'support', key: 'support', icon: 'help' },
  { name: 'messages', key: 'messages', icon: 'bell' }, { name: 'platform', key: 'platform', icon: 'monitor' },
]
const links = [...primary, ...practices, ...growth, ...account]
const practiceOpen = ref(practices.some(i => i.name === route.name))
const search = ref('')
const selected = ref(0)
const searchDialog = ref<HTMLDialogElement>()
const mobileDialog = ref<HTMLDialogElement>()
const messagesDialog = ref<HTMLDialogElement>()
const searchInput = ref<HTMLInputElement>()
const searchAliases: Record<string, string> = { settings: 'searchSettings', courses: 'searchCoursesAliases', world: 'searchWorld' }
const hits = computed(() => links.filter(i => (t(i.key) + ' ' + i.name + ' ' + i.key + ' ' + (searchAliases[i.name] ? t(searchAliases[i.name]) : '')).toLowerCase().includes(search.value.trim().toLowerCase())))
const current = computed(() => links.find(i => i.name === route.name)?.key)
const inbox = ref<InboxMessage[]>([])
const inboxState = ref<'idle' | 'loading' | 'error'>('idle')
const unread = computed(() => inbox.value.filter(m => !m.read).length)
function active(item: Link) {
  if (item.name === 'b2-report') return ['b2-report', 'weakness-report'].includes(String(route.name))
  if (item.name === 'b3-writing') return ['b3-writing', 'writing-practice'].includes(String(route.name))
  if (item.name === 'b3-reading') return ['b3-reading', 'reader'].includes(String(route.name))
  return item.name === route.name
}
async function openSearch() { search.value = ''; selected.value = 0; searchDialog.value?.showModal(); await nextTick(); searchInput.value?.focus() }
function choose(item: Link) {
  searchDialog.value?.close()
  mobileDialog.value?.close()
  if (isRestricted.value && (primary.some(p => p.name === item.name) || practices.some(p => p.name === item.name) || growth.some(g => g.name === item.name))) {
    void router.push({ name: 'forbidden' })
    return
  }
  void router.push({ name: item.name, params: item.params })
}
function moveResult(delta: number) { selected.value = hits.value.length ? (selected.value + delta + hits.value.length) % hits.value.length : 0 }
watch(search, () => { selected.value = 0 })
watch(() => route.fullPath, () => { mobileDialog.value?.close(); messagesDialog.value?.close(); if(practices.some(active)) practiceOpen.value = true })
function keyboard(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); void openSearch() } }
function skipToContent() { document.getElementById('learning-content')?.focus() }
async function openMessages() {
  messagesDialog.value?.showModal(); inboxState.value = 'loading'
  try { inbox.value = (await listInboxMessages()).slice(0, 6); inboxState.value = 'idle' } catch { inboxState.value = 'error' }
}
onMounted(() => window.addEventListener('keydown', keyboard))
onUnmounted(() => { stopTheme(); window.removeEventListener('keydown', keyboard) })
</script>

<template>
  <div class="app-shell experience-shell">
    <a class="skip-link" href="#learning-content" @click.prevent="skipToContent">{{ t('skip') }}</a>
    <aside class="app-shell__sidebar" :aria-label="t('workspace')">
      <RouterLink class="brand" :to="{ name: isRestricted ? 'forbidden' : 'home' }"><AppIcon name="spark" :size="32" /><span>{{ t('brand') }}<small>LEARN A LITTLE. EVERY DAY.</small></span></RouterLink>
      <nav class="nav-list">
        <div class="nav-group"><p class="nav-group__label">{{ t('learnGroup') }}</p>
          <RouterLink v-for="item in primary" :key="item.name" class="nav-item" :class="{ 'is-current': active(item), 'is-disabled': isRestricted }" :to="{ name: isRestricted ? 'forbidden' : item.name }"><AppIcon :name="item.icon" :size="19" /><span>{{ t(item.key) }}</span><i v-if="active(item)"></i></RouterLink>
        </div>
        <div class="nav-group"><button class="nav-group__toggle" type="button" :aria-expanded="practiceOpen" aria-controls="practice-navigation" @click="practiceOpen = !practiceOpen"><span>{{ t('practiceGroup') }}</span><AppIcon name="chevron" :size="14" :class="{ 'is-open': practiceOpen }" /></button>
          <div v-show="practiceOpen" id="practice-navigation"><RouterLink v-for="item in practices" :key="item.name" class="nav-item" :class="{ 'is-current': active(item), 'is-disabled': isRestricted }" :to="{ name: isRestricted ? 'forbidden' : item.name }"><AppIcon :name="item.icon" :size="19" /><span>{{ t(item.key) }}</span></RouterLink></div>
        </div>
        <div class="nav-group"><p class="nav-group__label">{{ t('growthGroup') }}</p>
          <RouterLink v-for="item in growth" :key="item.name" class="nav-item" :class="{ 'is-current': active(item), 'is-disabled': isRestricted }" :to="{ name: isRestricted ? 'forbidden' : item.name }"><AppIcon :name="item.icon" :size="19" /><span>{{ t(item.key) }}</span></RouterLink>
        </div>
      </nav>
      <div class="sidebar-footer">
        <RouterLink class="sidebar-note" :class="{ 'is-disabled': isRestricted }" :to="{ name: isRestricted ? 'forbidden' : 'today' }"><AppIcon name="spark" :size="20" /><span>{{ t('tagline') }}</span><AppIcon name="arrow" :size="16" /></RouterLink>
        <RouterLink class="nav-item" :to="{ name: 'support' }"><AppIcon name="help" :size="19" /><span>{{ t('support') }}</span></RouterLink>
        <RouterLink class="nav-item" :to="{ name: 'settings', params: { section: 'profile' } }"><AppIcon name="settings" :size="19" /><span>{{ t('settings') }}</span></RouterLink>
      </div>
    </aside>
    <div class="app-shell__main">
      <header class="topbar">
        <div class="topbar__title"><button type="button" class="icon-button mobile-menu-trigger" :aria-label="t('openMenu')" @click="mobileDialog?.showModal()"><AppIcon name="menu" /></button><span>{{ t('workspace') }}</span><AppIcon name="chevron" :size="13" /><strong>{{ current ? t(current) : route.meta.title }}</strong></div>
        <div class="topbar__actions">
          <button class="topbar-search" type="button" :aria-label="t('searchLabel')" @click="openSearch"><AppIcon name="search" :size="18" /><span>{{ t('search') }}</span><kbd>⌘ K</kbd></button>
          <button class="icon-button" type="button" :aria-label="t(theme === 'light' ? 'dark' : 'light')" @click="learnerThemeController.setTheme(theme === 'light' ? 'dark' : 'light')"><AppIcon :name="theme === 'light' ? 'moon' : 'sun'" :size="19" /></button>
          <button class="icon-button icon-button--notification" type="button" :aria-label="t('notification')" @click="openMessages"><AppIcon name="bell" :size="19" /><span v-if="unread" class="notification-dot"></span></button>
          <RouterLink class="profile-chip" :to="{ name: 'settings', params: { section: 'profile' } }" :aria-label="t('profile')"><span class="profile-chip__avatar"><AppIcon name="user" :size="19" /></span></RouterLink>
        </div>
      </header>
      <main id="learning-content" class="app-shell__content" tabindex="-1"><slot /></main>
      <footer class="workspace-footer"><span>© {{ new Date().getFullYear() }} {{ t('brand') }}</span><span>{{ t('tagline') }}</span><RouterLink :to="{ name: 'commerce' }">{{ t('commerce') }}</RouterLink></footer>
    </div>
    <nav class="mobile-tabbar" :aria-label="t('workspace')">
      <RouterLink v-for="item in [primary[0], primary[2], growth[0], account[0]]" :key="item.name" class="mobile-tabbar__item" :class="{ 'is-current': active(item) }" :to="{ name: item.name, params: item.params }"><AppIcon :name="item.icon" :size="20" /><span>{{ t(item.name === 'settings' ? 'profile' : item.key) }}</span></RouterLink>
      <button class="mobile-tabbar__item" type="button" @click="mobileDialog?.showModal()"><AppIcon name="menu" :size="20" /><span>{{ t('all') }}</span></button>
    </nav>
    <dialog :aria-label="t('searchLabel')" ref="searchDialog" class="experience-dialog search-dialog" @click="e => { if(e.target === searchDialog) searchDialog?.close() }">
      <div class="dialog-heading"><h2>{{ t('searchLabel') }}</h2><button type="button" class="icon-button" :aria-label="t('close')" @click="searchDialog?.close()"><AppIcon name="close" /></button></div>
      <label class="search-field"><AppIcon name="search" /><input ref="searchInput" v-model="search" type="search" :placeholder="t('search')" :aria-label="t('searchLabel')" @keydown.down.prevent="moveResult(1)" @keydown.up.prevent="moveResult(-1)" @keydown.enter.prevent="hits[selected] && choose(hits[selected])" /></label>
      <div class="search-results"><button v-for="(item, index) in hits" :key="item.name" type="button" :class="{ selected: index === selected }" @click="choose(item)"><AppIcon :name="item.icon" /><span>{{ t(item.key) }}</span><AppIcon name="arrow" :size="16" /></button><p v-if="!hits.length" class="muted">{{ t('searchEmpty') }}</p></div>
    </dialog>
    <dialog :aria-label="t('workspace')" ref="mobileDialog" class="experience-dialog navigation-dialog" @click="e => { if(e.target === mobileDialog) mobileDialog?.close() }">
      <div class="dialog-heading"><h2>{{ t('workspace') }}</h2><button type="button" class="icon-button" :aria-label="t('closeMenu')" @click="mobileDialog?.close()"><AppIcon name="close" /></button></div>
      <nav class="navigation-directory"><button v-for="item in links" :key="item.name" type="button" :class="{ selected: active(item) }" @click="choose(item)"><AppIcon :name="item.icon" /><span>{{ t(item.key) }}</span></button></nav>
    </dialog>
    <dialog :aria-label="t('messages')" ref="messagesDialog" class="experience-dialog messages-dialog" @click="e => { if(e.target === messagesDialog) messagesDialog?.close() }">
      <div class="dialog-heading"><h2>{{ t('messages') }}</h2><button type="button" class="icon-button" :aria-label="t('close')" @click="messagesDialog?.close()"><AppIcon name="close" /></button></div>
      <p v-if="inboxState !== 'idle'" role="status">{{ t(inboxState === 'loading' ? 'loading' : 'messageError') }}</p><p v-else-if="!inbox.length" class="muted">{{ t('noMessages') }}</p>
      <ul v-else class="notification-popover__list"><li v-for="message in inbox" :key="message.messageId"><strong>{{ message.title }}</strong><p>{{ message.safeBody }}</p></li></ul>
      <RouterLink class="button button--primary" :to="{ name: 'messages' }">{{ t('allMessages') }}<AppIcon name="arrow" :size="17" /></RouterLink>
    </dialog>
  </div>
</template>

<style scoped>
.nav-item.is-disabled, .sidebar-note.is-disabled {
  opacity: .45;
  pointer-events: none;
}
</style>
