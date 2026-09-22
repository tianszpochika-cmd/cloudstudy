<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter, RouterView } from "vue-router";
import { ElMessage } from "element-plus";
import { useAdminStore } from "./stores/admin";
import { authT } from "./auth/i18n";
import { adminPages, ui } from "./platform/experience";
import AdminIcon from "./components/AdminIcon.vue";
import AdminLocaleSwitcher from "./components/AdminLocaleSwitcher.vue";
import AdminPreferences from "./components/AdminPreferences.vue";
import AdminNavigation from "./components/AdminNavigation.vue";
const route = useRoute();
const router = useRouter();
const session = useAdminStore();
const booting = ref(true);
const menuOpen = ref(false);
const searchOpen = ref(false);
const search = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const offline = ref(!navigator.onLine);
const page = computed(() =>
  adminPages.find((item) => item.path === route.path),
);
const results = computed(() =>
  adminPages.filter(
    (item) =>
      session.can(item.permission) &&
      `${ui(`nav.${item.key}.title`)} ${item.keywords}`
        .toLowerCase()
        .includes(search.value.trim().toLowerCase()),
  ),
);
void router.isReady().finally(() => {
  booting.value = false;
});
watch(
  () => route.fullPath,
  async () => {
    menuOpen.value = false;
    searchOpen.value = false;
    document.title = `${page.value ? ui(`nav.${page.value.key}.title`) : ui("workspace")} · ${ui("brand")}`;
    await nextTick();
    document
      .querySelector<HTMLElement>("#admin-main")
      ?.focus({ preventScroll: true });
  },
);
function onNetwork() {
  offline.value = !navigator.onLine;
}
function keyboard(event: KeyboardEvent) {
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "k" &&
    session.isAuthenticated
  ) {
    event.preventDefault();
    searchOpen.value = !searchOpen.value;
  }
}
async function signOut() {
  const ok = await session.logout();
  menuOpen.value = false;
  await router.push({
    name: "admin-login",
    query: ok ? undefined : { reason: "logout-failed" },
  });
  ElMessage[ok ? "info" : "warning"](
    authT(ok ? "session.logout" : "session.logoutFailed"),
  );
}
onMounted(() => {
  window.addEventListener("online", onNetwork);
  window.addEventListener("offline", onNetwork);
  window.addEventListener("keydown", keyboard);
});
onUnmounted(() => {
  window.removeEventListener("online", onNetwork);
  window.removeEventListener("offline", onNetwork);
  window.removeEventListener("keydown", keyboard);
});
</script>
<template>
  <main v-if="booting" class="admin-startup" role="status" aria-live="polite">
    <span class="admin-brand__mark"><AdminIcon name="spark" :size="26" /></span>
    <h1>{{ ui("workspace") }}</h1>
    <p>{{ ui("loading") }}</p>
  </main>
  <div v-else-if="session.isAuthenticated" class="admin-shell">
    <a class="skip-link" href="#admin-main">{{ ui("skip") }}</a>
    <aside class="admin-aside"><AdminNavigation @logout="signOut" /></aside>
    <div class="admin-workspace">
      <header class="admin-header">
        <div class="admin-header__heading">
          <button
            class="admin-icon-button mobile-menu-trigger"
            type="button"
            :aria-label="ui('menu')"
            :aria-expanded="menuOpen"
            @click="menuOpen = true"
          >
            <AdminIcon name="menu" /></button
          ><span class="admin-breadcrumb"
            >{{ ui("workspace") }}<span aria-hidden="true">/</span
            ><strong>{{
              page ? ui(`nav.${page.key}.title`) : "—"
            }}</strong></span
          >
        </div>
        <div class="admin-header__actions">
          <button
            class="admin-search-trigger"
            type="button"
            :aria-label="ui('search')"
            @click="searchOpen = true"
          >
            <AdminIcon name="search" :size="17" /><span>{{ ui("search") }}</span
            ><kbd>Ctrl K</kbd></button
          ><AdminPreferences /><AdminLocaleSwitcher /><span
            class="admin-avatar header-avatar"
            ><AdminIcon name="people"
          /></span>
        </div>
      </header>
      <main id="admin-main" class="admin-main" tabindex="-1">
        <el-alert
          v-if="offline"
          :title="ui('offline')"
          type="warning"
          :closable="false"
          show-icon
          class="offline-banner"
        /><RouterView />
      </main>
      <footer class="workspace-footer">
        <span>{{ ui("brand") }} · {{ ui("workspace") }}</span
        ><span>{{ ui("currentAccess") }}</span>
      </footer>
    </div>
    <el-drawer
      v-model="menuOpen"
      direction="ltr"
      :size="280"
      :title="ui('workspace')"
      class="admin-mobile-nav"
      ><AdminNavigation @navigate="menuOpen = false" @logout="signOut"
    /></el-drawer>
    <el-dialog
      v-model="searchOpen"
      :title="ui('search')"
      width="560px"
      class="feature-search"
      @opened="searchInput?.focus()"
      @closed="search = ''"
    >
      <label class="feature-search-input"
        ><AdminIcon name="search" /><input
          ref="searchInput"
          v-model="search"
          type="search"
          :aria-label="ui('searchHint')"
          :placeholder="ui('searchHint')"
          @keydown.enter="results[0] && router.push(results[0].path)"
      /></label>
      <p class="muted">{{ ui("searchScope") }}</p>
      <div class="feature-search-results">
        <RouterLink
          v-for="item in results"
          :key="item.path"
          :to="item.path"
          class="feature-search-result"
          ><AdminIcon :name="item.icon" /><span
            >{{ ui(`nav.${item.key}.title`)
            }}<small>{{ ui(`group.${item.group}`) }}</small></span
          ><AdminIcon name="arrow" :size="16" /></RouterLink
        ><el-empty
          v-if="!results.length"
          :description="ui('noResults')"
          :image-size="70"
        />
      </div>
    </el-dialog>
  </div>
  <RouterView v-else />
</template>
