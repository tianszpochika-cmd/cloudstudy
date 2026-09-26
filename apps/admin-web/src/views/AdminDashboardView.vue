<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { getDashboardMetrics } from "../api/b5";
import { isRecord, unwrap } from "../domain/b5";
import { adminPages, ui } from "../platform/experience";
import { useAdminStore } from "../stores/admin";
import { adminI18n } from "../platform/v2-foundation";
import AdminIcon from "../components/AdminIcon.vue";
const session = useAdminStore();
const showAll = ref(false);
const loading = ref(true);
const error = ref(false);
const metricRows = ref<Record<string, unknown>[]>([]);
const updated = ref("");
const shortcuts = computed(() =>
  adminPages.filter(
    (page) => page.key !== "dashboard" && session.can(page.permission),
  ),
);
async function load() {
  if (!loading.value) error.value = false;
  loading.value = true;
  try {
    const data = unwrap(await getDashboardMetrics());
    const list = Array.isArray(data)
      ? data
      : isRecord(data)
        ? (data.rows ?? data.items ?? [])
        : [];
    metricRows.value = Array.isArray(list) ? list.filter(isRecord) : [];
    updated.value = new Intl.DateTimeFormat(adminI18n.locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
    error.value = false;
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  void load();
});
</script>
<template>
  <div class="view-stack">
    <section class="dashboard-hero">
      <div>
        <small>{{ ui("workspace") }}</small>
        <h2>{{ ui("dashboard.welcome") }}</h2>
        <p>{{ ui("dashboard.subtitle") }}</p>
      </div>
      <div class="dashboard-hero-art" aria-hidden="true">
        <span>Aa<span style="font-size: 28px">✦</span></span>
      </div>
    </section>
    <div class="dashboard-metrics">
      <el-card class="metric-card"
        ><span>{{ ui("dashboard.count") }}</span
        ><strong>{{ loading || error ? "—" : metricRows.length }}</strong
        ><small>{{ ui("dashboard.source") }}</small></el-card
      >
      <el-card class="metric-card"
        ><span>{{ ui("dashboard.modules") }}</span
        ><strong>{{ shortcuts.length }}</strong
        ><small>{{ ui("dashboard.scope") }}</small></el-card
      >
      <el-card class="metric-card"
        ><span>{{ ui("dashboard.session") }}</span
        ><strong>{{ ui("dashboard.connected") }}</strong
        ><small>{{ ui("currentAccess") }}</small></el-card
      >
    </div>
    <div class="dashboard-columns">
      <el-card
        ><template #header
          ><div class="card-header">
            <span>{{ ui("quick") }}</span
            ><el-button text type="primary" @click="showAll = !showAll"
              >{{ ui(showAll ? "showLess" : "allTools") }}
              <span aria-hidden="true">↗</span></el-button
            >
          </div></template
        >
        <div class="shortcut-grid">
          <RouterLink
            v-for="item in showAll ? shortcuts : shortcuts.slice(0, 6)"
            :key="item.path"
            :to="item.path"
            class="shortcut-card"
            ><span class="shortcut-icon"
              ><AdminIcon :name="item.icon" :size="21" /></span
            ><strong>{{ ui(`nav.${item.key}.title`) }}</strong
            ><small
              >{{ ui(`group.${item.group}`) }}
              <span aria-hidden="true">↗</span></small
            ></RouterLink
          >
        </div>
        <el-empty v-if="!shortcuts.length" :description="ui('empty')"
      /></el-card>
      <el-card class="dashboard-journey"
        ><template #header>{{ ui("dashboard.journey") }}</template>
        <div
          v-for="(step, index) in ['draft', 'review', 'publish']"
          :key="step"
          class="journey-step"
        >
          <b>0{{ index + 1 }}</b
          ><span>{{ ui(`dashboard.${step}`) }}</span>
        </div>
        <p class="muted">{{ ui("dashboard.journeyHint") }}</p></el-card
      >
    </div>
    <el-card
      ><template #header
        ><div class="card-header">
          <span>{{ ui("dashboard.metrics") }}</span>
          <div class="admin-header__actions">
            <small v-if="updated && !error" class="muted">{{
              ui("dashboard.updated", { time: updated })
            }}</small
            ><el-button :loading="loading" @click="load">{{
              ui("refresh")
            }}</el-button>
          </div>
        </div></template
      >
      <el-skeleton v-if="loading" :rows="3" animated />
      <el-alert
        v-else-if="error"
        :title="ui('unavailable')"
        :description="ui('dashboard.unavailable')"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-table v-else-if="metricRows.length" :data="metricRows"
        ><el-table-column
          label="指标"
          min-width="200"
          ><template #default="scope">{{ scope.row.metricCode ?? scope.row.metricId ?? "—" }}</template></el-table-column
        ><el-table-column
          prop="metricVersion"
          label="统计口径"
          width="140" /><el-table-column
          prop="state"
          label="状态"
          width="130" /><el-table-column
          label="数值"
          width="140"
          ><template #default="scope">{{ scope.row.value ?? scope.row.totalValue ?? "—" }}</template></el-table-column
        ><el-table-column
          prop="periodStart"
          label="统计日期"
          min-width="160"
      /></el-table>
      <el-empty v-else :description="ui('dashboard.empty')" :image-size="80" />
    </el-card>
  </div>
</template>
