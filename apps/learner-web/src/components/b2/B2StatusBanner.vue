<script setup lang="ts">
import type { B2ViewStatus, PerformanceLevel } from '../../domain/b2'

withDefaults(defineProps<{ status: B2ViewStatus; message?: string | null; queueCount?: number; checkpointPending?: boolean; performanceLevel?: PerformanceLevel }>(), { message: null, queueCount: 0, checkpointPending: false, performanceLevel: 'High' })
const emit = defineEmits<{ retry: []; sync: []; performance: [level: PerformanceLevel] }>()
</script>

<template>
  <div class="status-banner" :class="`status-banner--${status}`" role="status" aria-live="polite">
    <div class="status-banner__copy">
      <strong v-if="status === 'loading'">正在读取服务端学习数据</strong>
      <strong v-else-if="status === 'empty'">当前没有可用的已发布内容</strong>
      <strong v-else-if="status === 'offline'">网络暂时不可用</strong>
      <strong v-else-if="status === 'error'">服务端暂时不可用</strong>
      <strong v-else>服务端数据状态：{{ status }}</strong>
      <span>{{ message ?? (status === 'offline' ? '本地断点仍可保留；待同步事件不代表已掌握。' : status === 'empty' ? '没有使用本地样例填充页面，请稍后重试或联系内容管理员。' : '掌握、判分与报告以服务端返回为准。') }}</span>
    </div>
    <div class="status-banner__actions">
      <span v-if="queueCount" class="status-banner__queue">待同步 {{ queueCount }}</span>
      <span v-if="checkpointPending" class="status-banner__checkpoint">断点已保存本地</span>
      <button v-if="status === 'offline' || status === 'error'" class="status-banner__button" type="button" @click="emit('retry')">重试</button>
      <button v-if="queueCount" class="status-banner__button" type="button" @click="emit('sync')">同步队列</button>
      <select :value="performanceLevel" aria-label="性能档位" @change="emit('performance', ($event.target as HTMLSelectElement).value as PerformanceLevel)">
        <option value="Ultra">Ultra</option><option value="High">High</option><option value="Medium">Medium</option><option value="Performance">Performance</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.status-banner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; border: 1px solid #e6e8f0; border-radius: 14px; background: #fff; }
.status-banner--offline, .status-banner--error { border-color: #f3c7ce; background: #fff8f9; }
.status-banner--empty { border-style: dashed; background: #fbfbfd; }
.status-banner__copy { display: grid; gap: 4px; min-width: 220px; }
.status-banner__copy span { color: #666d80; font-size: 13px; line-height: 1.5; }
.status-banner__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.status-banner__queue, .status-banner__checkpoint { color: #9b5b00; font-size: 12px; font-weight: 700; }
.status-banner__button { min-height: 36px; padding: 0 12px; border: 1px solid #d9dce7; border-radius: 10px; color: #596bff; background: #fff; font-weight: 700; }
select { min-height: 36px; padding: 0 8px; border: 1px solid #d9dce7; border-radius: 10px; color: #666d80; background: #fff; }
</style>
