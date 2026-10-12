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
  { name: 'vocabulary', key: 'vocabulary', icon: 'cards' },
  { name: 'b3-reading', key: 'reading', icon: 'book' },
  { name: 'b3-grammar', key: 'grammar', icon: 'spark' },
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
  <div class="app-shell experience-shell v2-shell">
    <a class="skip-link" href="#learning-content" @click.prevent="skipToContent">{{ t('skip') }}</a>
    <aside class="app-shell__sidebar v2-side" :aria-label="t('workspace')">
      <RouterLink class="brand v2-side-brand" :to="{ name: isRestricted ? 'forbidden' : 'home' }"><AppIcon name="spark" :size="32" /><span>{{ t('brand') }}<small>LEARN A LITTLE. EVERY DAY.</small></span></RouterLink>
      <nav class="nav-list v2-side-nav">
        <div class="nav-group v2-side-group"><p class="nav-group__label v2-side-label">{{ t('learnGroup') }}</p>
          <RouterLink v-for="item in primary" :key="item.name" class="nav-item v2-side-item" :class="{ 'is-current': active(item), 'is-disabled': isRestricted }" :to="{ name: isRestricted ? 'forbidden' : item.name }"><AppIcon :name="item.icon" :size="19" /><span>{{ t(item.key) }}</span><i v-if="active(item)"></i></RouterLink>
        </div>
        <div class="nav-group v2-side-group"><button class="nav-group__toggle v2-side-label v2-side-toggle" type="button" :aria-expanded="practiceOpen" aria-controls="practice-navigation" @click="practiceOpen = !practiceOpen"><span>{{ t('practiceGroup') }}</span><AppIcon name="chevron" :size="14" :class="{ 'is-open': practiceOpen }" /></button>
          <div v-show="practiceOpen" id="practice-navigation"><RouterLink v-for="item in practices" :key="item.name" class="nav-item v2-side-item" :class="{ 'is-current': active(item), 'is-disabled': isRestricted }" :to="{ name: isRestricted ? 'forbidden' : item.name }"><AppIcon :name="item.icon" :size="19" /><span>{{ t(item.key) }}</span></RouterLink></div>
        </div>
        <div class="nav-group v2-side-group"><p class="nav-group__label v2-side-label">{{ t('growthGroup') }}</p>
          <RouterLink v-for="item in growth" :key="item.name" class="nav-item v2-side-item" :class="{ 'is-current': active(item), 'is-disabled': isRestricted }" :to="{ name: isRestricted ? 'forbidden' : item.name }"><AppIcon :name="item.icon" :size="19" /><span>{{ t(item.key) }}</span></RouterLink>
        </div>
      </nav>
      <div class="sidebar-footer v2-side-footer">
        <RouterLink class="sidebar-note v2-side-note" :class="{ 'is-disabled': isRestricted }" :to="{ name: isRestricted ? 'forbidden' : 'today' }"><AppIcon name="spark" :size="20" /><span>{{ t('tagline') }}</span><AppIcon name="arrow" :size="16" /></RouterLink>
        <RouterLink class="nav-item v2-side-item" :to="{ name: 'support' }"><AppIcon name="help" :size="19" /><span>{{ t('support') }}</span></RouterLink>
        <RouterLink class="nav-item v2-side-item" :to="{ name: 'settings', params: { section: 'profile' } }"><AppIcon name="settings" :size="19" /><span>{{ t('settings') }}</span></RouterLink>
      </div>
    </aside>
    <div class="app-shell__main v2-main">
      <header class="topbar v2-topbar">
        <div class="topbar__title v2-crumb"><button type="button" class="icon-button mobile-menu-trigger v2-icon-btn" :aria-label="t('openMenu')" @click="mobileDialog?.showModal()"><AppIcon name="menu" /></button><span>{{ t('workspace') }}</span><AppIcon name="chevron" :size="13" /><strong>{{ current ? t(current) : route.meta.title }}</strong></div>
        <div class="topbar__actions">
          <button class="topbar-search v2-search" type="button" :aria-label="t('searchLabel')" @click="openSearch"><AppIcon name="search" :size="18" /><span>{{ t('search') }}</span><kbd>⌘ K</kbd></button>
          <button class="icon-button v2-icon-btn" type="button" :aria-label="t(theme === 'light' ? 'dark' : 'light')" @click="learnerThemeController.setTheme(theme === 'light' ? 'dark' : 'light')"><AppIcon :name="theme === 'light' ? 'moon' : 'sun'" :size="19" /></button>
          <button class="icon-button icon-button--notification v2-icon-btn" type="button" :aria-label="t('notification')" @click="openMessages"><AppIcon name="bell" :size="19" /><span v-if="unread" class="notification-dot"></span></button>
          <RouterLink class="profile-chip v2-user" :to="{ name: 'settings', params: { section: 'profile' } }" :aria-label="t('profile')"><span class="profile-chip__avatar"><AppIcon name="user" :size="19" /></span></RouterLink>
        </div>
      </header>
      <main id="learning-content" class="app-shell__content v2-content" tabindex="-1"><slot /></main>
      <footer class="workspace-footer v2-footer"><span>© {{ new Date().getFullYear() }} {{ t('brand') }}</span><span>{{ t('tagline') }}</span><RouterLink :to="{ name: 'commerce' }">{{ t('commerce') }}</RouterLink></footer>
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

<style>
.app-shell.v2-shell { --sidebar-width: 236px; background: var(--v2-bg); color: var(--v2-ink); font-family: var(--v2-font); }
.app-shell.v2-shell .v2-side { background: var(--v2-side); color: var(--v2-side-ink); padding: 28px 18px; border-right: 0; }
.app-shell.v2-shell .v2-side-brand { color: var(--v2-side-ink); padding: 0 10px; }
.app-shell.v2-shell .v2-side-brand small { color: var(--v2-side-muted); }
.app-shell.v2-shell .v2-side-label { color: var(--v2-side-muted); font-size: 10px; letter-spacing: 1.5px; padding: 0 12px; background: transparent; }
.app-shell.v2-shell .v2-side-item { color: var(--v2-side-ink); font-size: 13px; border-radius: 9px; min-height: 40px; padding: 9px 12px; transition: background var(--v2-motion-fast), color var(--v2-motion-fast); }
.app-shell.v2-shell .v2-side-item:hover { background: rgba(255, 255, 255, .08); color: var(--v2-side-ink); }
.app-shell.v2-shell .v2-side-item.is-current { background: var(--v2-card); color: var(--v2-brand); font-weight: 700; }
.app-shell.v2-shell .v2-side-item.is-current i { display: none; }
.app-shell.v2-shell .v2-side-item:focus-visible,
.app-shell.v2-shell .v2-icon-btn:focus-visible,
.app-shell.v2-shell .v2-search:focus-visible { outline: 2px solid var(--v2-focus); outline-offset: 2px; }
.app-shell.v2-shell .v2-side-footer { border-top: 1px solid var(--v2-side-muted); padding-top: 16px; }
.app-shell.v2-shell .v2-side-note { background: rgba(255, 255, 255, .06); color: var(--v2-side-ink); border-radius: var(--v2-radius-md); }
.app-shell.v2-shell .v2-topbar { background: var(--v2-card); border-bottom: 1px solid var(--v2-line); padding: 20px 38px; min-height: 76px; }
.app-shell.v2-shell .v2-crumb { color: var(--v2-mut); font-size: 12px; }
.app-shell.v2-shell .v2-crumb strong { color: var(--v2-ink); font-size: 20px; font-weight: 700; letter-spacing: -.4px; }
.app-shell.v2-shell .v2-search { border: 1px solid var(--v2-line); background: var(--v2-surface); color: var(--v2-mut); border-radius: 9px; }
.app-shell.v2-shell .v2-icon-btn { border: 1px solid var(--v2-line); border-radius: 10px; background: var(--v2-card); color: var(--v2-ink); }
.app-shell.v2-shell .v2-icon-btn:hover { background: var(--v2-soft); }
.app-shell.v2-shell .v2-user .profile-chip__avatar { background: var(--v2-soft); color: var(--v2-brand); }
.app-shell.v2-shell .v2-content { padding: 28px 38px; }
.app-shell.v2-shell .v2-footer { color: var(--v2-mut); border-top: 1px solid var(--v2-line); font-size: 12px; }
@media (min-width: 1400px) {
  .app-shell.v2-shell .v2-content { padding: 32px 46px; }
  .app-shell.v2-shell .v2-topbar { padding-left: 46px; padding-right: 46px; }
}
@media (max-width: 820px) {
  .app-shell.v2-shell .v2-content { padding: 20px 16px; }
  .app-shell.v2-shell .v2-topbar { padding: 14px 16px; }
}
@media (max-width: 1190px) { .app-shell.v2-shell { --sidebar-width: 205px; } .app-shell.v2-shell .v2-side { width: var(--sidebar-width); align-items: stretch; padding: 24px 12px; } .app-shell.v2-shell .v2-side-brand { padding-inline: 10px; } .app-shell.v2-shell .v2-side-brand > span:last-child, .app-shell.v2-shell .v2-side-label, .app-shell.v2-shell .v2-side-item > span:last-child, .app-shell.v2-shell .v2-side-footer { display: revert; } .app-shell.v2-shell .v2-side-item > span { display: inline; } .app-shell.v2-shell .v2-side-footer { display: block; } .app-shell.v2-shell .v2-side-item { justify-content: flex-start; padding-inline: 12px; } .app-shell.v2-shell .v2-main { width: calc(100% - var(--sidebar-width)); margin-left: var(--sidebar-width); } .app-shell.v2-shell .v2-content { padding: 24px; } .app-shell.v2-shell .v2-topbar { padding-left: 24px; padding-right: 24px; } .app-shell.v2-shell .v2-side-toggle { display: flex; justify-content: space-between; width: 100%; padding: 0 12px; } .app-shell.v2-shell .v2-side-toggle > span { display: inline; } }
@media (max-width: 900px) { .app-shell.v2-shell { --sidebar-width: 170px; } .app-shell.v2-shell .v2-side-brand small { display: none; } .app-shell.v2-shell .v2-search kbd { display: none; } .app-shell.v2-shell .v2-side-note { display: none; } }
@media (min-width: 651px) and (max-width: 820px) { .app-shell.v2-shell .v2-side { display: flex; } .app-shell.v2-shell .v2-main { width: calc(100% - var(--sidebar-width)); margin-left: var(--sidebar-width); padding-bottom: 0; } .app-shell.v2-shell .mobile-tabbar, .app-shell.v2-shell .mobile-menu-trigger { display: none; } }
.app-shell.v2-shell .v2-crumb { min-width: 0; white-space: nowrap; overflow: hidden; }
.app-shell.v2-shell .v2-crumb strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 1000px) { .app-shell.v2-shell .v2-crumb > span, .app-shell.v2-shell .v2-crumb > svg { display: none; } .app-shell.v2-shell .v2-search { width: 40px; min-width: 40px; justify-content: center; padding: 0; } .app-shell.v2-shell .v2-search > span, .app-shell.v2-shell .v2-search kbd { display: none; } }
</style>
