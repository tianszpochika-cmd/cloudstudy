<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listPhonemes, listPhoneticPairs, type PhonemeRow, type MinimalPairRow } from '../api/phonetics'
import { useAdminStore } from '../stores/admin'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error'

const session = useAdminStore()
const language = ref('')
const phonemes = ref<PhonemeRow[]>([])
const pairs = ref<MinimalPairRow[]>([])
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)

const canRead = computed(() => session.can('admin.content.read'))

const LANGUAGES = [
  { value: '', label: '英语（默认 48 音素）' },
  { value: 'fr-FR', label: '法语（37 音素）' },
]

const groupSummary = computed(() => {
  const counts = new Map<string, number>()
  phonemes.value.forEach((row) => counts.set(row.group, (counts.get(row.group) ?? 0) + 1))
  return [...counts.entries()].map(([group, count]) => `${group} ${count}`).join(' · ')
})

function mouthSummary(row: PhonemeRow): string {
  const profile = row.mouthProfile
  if (!profile || typeof profile !== 'object') return '—（可空）'
  return 'mouth-v1'
}

async function load(): Promise<void> {
  if (!canRead.value) { state.value = 'permission'; lastError.value = '当前会话没有内容读取权限。'; return }
  state.value = 'loading'
  lastError.value = null
  try {
    const lang = language.value || undefined
    const [phonemeRows, pairRows] = await Promise.all([listPhonemes(lang), listPhoneticPairs(lang)])
    phonemes.value = phonemeRows
    pairs.value = pairRows
    state.value = phonemeRows.length ? 'ready' : 'empty'
  } catch (error) {
    state.value = 'error'
    lastError.value = error instanceof Error ? error.message : '音标库读取失败。'
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack">
    <div class="view-intro">
      <div>
        <span class="admin-header__eyebrow">B4 · PHONETICS</span>
        <h2>音标库：分语言只读浏览</h2>
        <p>已发布音素投影经既有 learner 通道只读展示，不写库、不新增网关路径。英语默认 48 项保持不变；法语读 PHONETICS-FR 域（含鼻化元音与半元音全覆盖）。音频字节不经过本页。</p>
      </div>
    </div>

    <el-card shadow="never">
      <el-space wrap>
        <el-select v-model="language" placeholder="语言" style="width: 220px" @change="load()">
          <el-option v-for="lang in LANGUAGES" :key="lang.value" :label="lang.label" :value="lang.value" />
        </el-select>
        <el-button :disabled="!canRead" @click="load()">刷新</el-button>
        <span v-if="groupSummary" class="admin-header__eyebrow">{{ groupSummary }}</span>
      </el-space>
    </el-card>

    <el-alert v-if="state === 'permission'" title="当前会话没有内容读取权限" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'error'" :title="lastError ?? '音标数据暂时不可用'" type="error" :closable="false" show-icon />

    <el-card shadow="never">
      <el-table v-if="phonemes.length" :data="phonemes" stripe>
        <el-table-column prop="symbol" label="音素" width="100" />
        <el-table-column prop="group" label="分组" width="170" />
        <el-table-column prop="exampleWord" label="例词" min-width="140" />
        <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
        <el-table-column label="口型" width="120">
          <template #default="scope">{{ mouthSummary(scope.row) }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-else :description="state === 'empty' ? '该语言暂无已发布音素' : '正在等待服务端投影'" />
    </el-card>

    <el-card v-if="pairs.length" shadow="never">
      <template #header><span>最小对立对（{{ pairs.length }}）</span></template>
      <el-space wrap>
        <el-tag v-for="pair in pairs" :key="String(pair.pairId)" effect="plain">
          {{ String(pair.leftWord ?? '') }} ↔ {{ String(pair.rightWord ?? '') }}
        </el-tag>
      </el-space>
    </el-card>
  </div>
</template>
