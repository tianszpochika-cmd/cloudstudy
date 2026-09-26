<script setup lang="ts">
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  getB6AccessibilityChecklist,
  getB6ObservabilityDashboard,
  getB6PerformanceBudget,
  getB6ReleaseMatrix,
  getB6ResponsiveChecklist,
} from "../api/b6";
import {
  toDashboard,
  toMatrix,
  type B6AdminDashboard,
  type B6AdminMatrix,
} from "../domain/b6";

const loading = ref(true);
const matrix = ref<B6AdminMatrix>(toMatrix({}));
const dashboard = ref<B6AdminDashboard>(toDashboard({}));
const checklists = ref({
  accessibility: 0,
  responsive: 0,
  performanceLevels: 0,
});

function evidenceStatus(value: string): string {
  return {
    READY_FOR_TEST_STAGE: "待实际验收",
    PENDING_TEST_STAGE: "待实际验收",
    READY: "代码就绪",
    PENDING: "待检查",
  }[value] ?? value;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [
      matrixResponse,
      dashboardResponse,
      performanceResponse,
      accessibilityResponse,
      responsiveResponse,
    ] = await Promise.all([
      getB6ReleaseMatrix(),
      getB6ObservabilityDashboard(),
      getB6PerformanceBudget(),
      getB6AccessibilityChecklist(),
      getB6ResponsiveChecklist(),
    ]);
    matrix.value = toMatrix(matrixResponse);
    dashboard.value = toDashboard(dashboardResponse);
    const performanceData =
      performanceResponse &&
      typeof performanceResponse === "object" &&
      "data" in performanceResponse &&
      typeof performanceResponse.data === "object" &&
      performanceResponse.data !== null
        ? (performanceResponse.data as Record<string, unknown>)
        : {};
    const accessibilityData =
      accessibilityResponse &&
      typeof accessibilityResponse === "object" &&
      "data" in accessibilityResponse &&
      typeof accessibilityResponse.data === "object" &&
      accessibilityResponse.data !== null
        ? (accessibilityResponse.data as Record<string, unknown>)
        : {};
    const responsiveData =
      responsiveResponse &&
      typeof responsiveResponse === "object" &&
      "data" in responsiveResponse &&
      typeof responsiveResponse.data === "object" &&
      responsiveResponse.data !== null
        ? (responsiveResponse.data as Record<string, unknown>)
        : {};
    checklists.value = {
      accessibility: Array.isArray(accessibilityData.checks)
        ? accessibilityData.checks.length
        : 0,
      responsive: Array.isArray(responsiveData.checks)
        ? responsiveData.checks.length
        : 0,
      performanceLevels: Array.isArray(performanceData.levels)
        ? performanceData.levels.length
        : 0,
    };
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : "B6 发布证据读取失败",
    );
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
    <AdminPageIntro
      ><el-button :loading="loading" @click="load"
        >刷新</el-button
      ></AdminPageIntro
    >
    <el-alert
      description="本页为既有代码基线摘要，不代表当前环境构建成功、零告警或已通过上线验收。"
      title="发布前请完成质量检查与实际设备验证"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-row :gutter="16"
      ><el-col :span="6"
        ><el-card shadow="never" class="metric-card"
          ><span>目标平台</span><strong>{{ matrix.targets.length }}</strong
          ><small>{{ evidenceStatus(matrix.codeLayerStatus) }}</small></el-card
        ></el-col
      ><el-col :span="6"
        ><el-card shadow="never" class="metric-card"
          ><span>告警</span><strong>{{ dashboard.alerts.length }}</strong
          ><small>历史代码基线，非实时监控</small></el-card
        ></el-col
      ><el-col :span="6"
        ><el-card shadow="never" class="metric-card"
          ><span>无障碍检查</span><strong>{{ checklists.accessibility }}</strong
          ><small>上线阻断项</small></el-card
        ></el-col
      ><el-col :span="6"
        ><el-card shadow="never" class="metric-card"
          ><span>性能档位</span
          ><strong>{{ checklists.performanceLevels }}</strong
          ><small>按设备能力选择</small></el-card
        ></el-col
      ></el-row
    >
    <el-card shadow="never"
      ><template #header
        ><div class="card-header">
          <span>平台构建矩阵</span
          ><el-tag type="info" effect="plain">{{
            evidenceStatus(matrix.realDeviceEvidenceStatus)
          }}</el-tag>
        </div></template
      ><el-table :data="matrix.targets" empty-text="暂无平台记录" stripe
        ><el-table-column
          prop="platformCode"
          label="平台"
          width="190" /><el-table-column
          prop="priority"
          label="优先级"
          width="100" /><el-table-column
          prop="implementation"
          label="实现归属"
          min-width="220" /><el-table-column
          prop="sharedBusinessCode"
          label="共享业务代码"
          min-width="190" /><el-table-column label="代码状态" width="150"
          ><template #default="scope"
            ><el-tag
              :type="scope.row.buildStatus === 'READY' ? 'success' : 'warning'"
              effect="plain"
              >{{ evidenceStatus(scope.row.buildStatus) }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column
          prop="installability"
          label="安装/访问证据"
          min-width="180" /></el-table
    ></el-card>
    <el-row :gutter="16"
      ><el-col :span="12"
        ><el-card shadow="never"
          ><template #header
            ><div class="card-header">
              <span>质量告警</span
              ><el-tag :type="dashboard.alerts.length ? 'danger' : 'success'">{{
                dashboard.alerts.length ? "需处理" : "无开放告警"
              }}</el-tag>
            </div></template
          ><el-empty
            v-if="dashboard.alerts.length === 0"
            description="当前无代码层开放告警" /><el-table
            v-else
            :data="dashboard.alerts"
            size="small"
            ><el-table-column prop="alertCode" label="告警" /><el-table-column
              prop="severity"
              label="级别" /><el-table-column
              prop="errorCode"
              label="错误码" /></el-table></el-card></el-col
      ><el-col :span="12"
        ><el-card shadow="never"
          ><template #header><span>运行关联字段</span></template>
          <div class="b6-admin-chip-list">
            <el-tag
              v-for="field in dashboard.correlationFields"
              :key="field"
              effect="plain"
              >{{ field }}</el-tag
            >
          </div>
          <p class="b6-admin-note">
            观测、审计与发布 Gate 使用同一 requestId/traceId
            关联语义，原始隐私和媒体内容不进入日志。
          </p></el-card
        ></el-col
      ></el-row
    >
  </div>
</template>
