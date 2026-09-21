<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { adminT } from '../platform/admin-i18n'
import '../platform/i18n-batch-b'
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

const LANGUAGES = computed(() => [
  { value: '', label: adminT('phoneticsView.langEnDefault') },
  { value: 'fr-FR', label: adminT('phoneticsView.langFr') },
])

const groupSummary = computed(() => {
  const counts = new Map<string, number>()
  phonemes.value.forEach((row) => counts.set(row.group, (counts.get(row.group) ?? 0) + 1))
  return [...counts.entries()].map(([group, count]) => `${group} ${count}`).join(' · ')
})

function mouthSummary(row: PhonemeRow): string {
  const profile = row.mouthProfile
  if (!profile || typeof profile !== 'object') return adminT('phoneticsView.mouthEmpty')
  return 'mouth-v1'
}

async function load(): Promise<void> {
  if (!canRead.value) { state.value = 'permission'; lastError.value = adminT('phoneticsView.noReadPermission'); return }
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
    lastError.value = error instanceof Error ? error.message : adminT('phoneticsView.loadFailed')
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack">
    <div class="view-intro">
      <div>
        <span class="admin-header__eyebrow">B4 · PHONETICS</span>
        <h2>{{ adminT('phoneticsView.heading') }}</h2>
        <p>{{ adminT('phoneticsView.intro') }}</p>
      </div>
    </div>

    <el-card shadow="never">
      <el-space wrap>
        <el-select v-model="language" :placeholder="adminT('phoneticsView.languagePlaceholder')" style="width: 220px" @change="load()">
          <el-option v-for="lang in LANGUAGES" :key="lang.value" :label="lang.label" :value="lang.value" />
        </el-select>
        <el-button :disabled="!canRead" @click="load()">{{ adminT('phoneticsView.refresh') }}</el-button>
        <span v-if="groupSummary" class="admin-header__eyebrow">{{ groupSummary }}</span>
      </el-space>
    </el-card>

    <el-alert v-if="state === 'permission'" :title="adminT('phoneticsView.permissionTitle')" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'error'" :title="lastError ?? adminT('phoneticsView.dataUnavailable')" type="error" :closable="false" show-icon />

    <el-card shadow="never">
      <el-table v-if="phonemes.length" :data="phonemes" stripe>
        <el-table-column prop="symbol" :label="adminT('phoneticsView.colSymbol')" width="100" />
        <el-table-column prop="group" :label="adminT('phoneticsView.colGroup')" width="170" />
        <el-table-column prop="exampleWord" :label="adminT('phoneticsView.colExample')" min-width="140" />
        <el-table-column prop="description" :label="adminT('phoneticsView.colDescription')" min-width="220" show-overflow-tooltip />
        <el-table-column :label="adminT('phoneticsView.colMouth')" width="120">
          <template #default="scope">{{ mouthSummary(scope.row) }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-else :description="state === 'empty' ? adminT('phoneticsView.emptyNoPhonemes') : adminT('phoneticsView.emptyWaiting')" />
    </el-card>

    <el-card v-if="pairs.length" shadow="never">
      <template #header><span>{{ adminT('phoneticsView.minimalPairs', { count: pairs.length }) }}</span></template>
      <el-space wrap>
        <el-tag v-for="pair in pairs" :key="String(pair.pairId)" effect="plain">
          {{ String(pair.leftWord ?? '') }} ↔ {{ String(pair.rightWord ?? '') }}
        </el-tag>
      </el-space>
    </el-card>
  </div>
</template>
