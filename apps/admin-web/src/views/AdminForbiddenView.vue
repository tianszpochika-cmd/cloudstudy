<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAdminStore } from "../stores/admin";
import { adminPages, ui } from "../platform/experience";
import AdminIcon from "../components/AdminIcon.vue";
const session = useAdminStore();
const router = useRouter();
const busy = ref(false);
async function retry() {
  busy.value = true;
  try {
    await session.refreshSilently();
    await router.replace(
      session.isAuthenticated
        ? (adminPages.find((p) => session.can(p.permission))?.path ??
            "/forbidden")
        : "/login",
    );
  } finally {
    busy.value = false;
  }
}
async function logout() {
  await session.logout();
  await router.replace("/login");
}
</script>
<template>
  <section class="forbidden-page">
    <span class="shortcut-icon"><AdminIcon name="shield" :size="25" /></span
    ><span class="admin-header__eyebrow">403</span>
    <h1>{{ ui("access.title") }}</h1>
    <p class="muted">{{ ui("access.description") }}</p>
    <div class="login-actions">
      <el-button type="primary" :loading="busy" @click="retry">{{
        ui("access.retry")
      }}</el-button
      ><el-button @click="logout">{{ ui("access.switchAccount") }}</el-button>
    </div>
  </section>
</template>
