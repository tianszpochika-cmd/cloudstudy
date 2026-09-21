<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listLexemes,
  upsertLexeme,
  lexemeLifecycle,
  lexemeReview,
  upsertPronunciation,
  qcPronunciation,
  LEXEME_PACK,
  type LexemeFields,
  type LexemeRow,
} from '../api/lexeme'
import { useAdminStore } from '../stores/admin'
import SchedulePanel from '../components/SchedulePanel.vue'
import AudioPreview from '../components/AudioPreview.vue'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error'

const session = useAdminStore()
const rows = ref<LexemeRow[]>([])
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)

const q = ref('')
const cefr = ref('')
const availability = ref('')

const canRead = computed(() => session.can('admin.content.read'))
const canWrite = computed(() => session.can('admin.content.write'))
const canPublish = computed(() => session.can('admin.content.publish'))

const dialogVisible = ref(false)
const editing = ref<LexemeRow | null>(null)
const form = ref<LexemeFields>({ headword: '' })
const formBusy = ref(false)

const pronVisible = ref(false)
const pronTarget = ref<LexemeRow | null>(null)
const pronForm = ref({ accent: 'US', ipa: '', audioAssetId: '', sourceType: 'HUMAN' })
const pronBusy = ref(false)

const diffVisible = ref(false)
const diffTarget = ref<LexemeRow | null>(null)

interface DiffLine { path: string; before: string; after: string }
const diffLines = ref<DiffLine[]>([])

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value || '—'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function buildDiff(before: unknown, after: unknown, prefix: string, out: DiffLine[]): void {
  if (JSON.stringify(before) === JSON.stringify(after)) return
  if (
    typeof before === 'object' && before !== null && !Array.isArray(before) &&
    typeof after === 'object' && after !== null && !Array.isArray(after)
  ) {
    const keys = new Set([...Object.keys(before as object), ...Object.keys(after as object)])
    keys.forEach((key) => {
      buildDiff(
        (before as Record<string, unknown>)[key],
        (after as Record<string, unknown>)[key],
        prefix ? `${prefix}.${key}` : key,
        out,
      )
    })
    return
  }
  out.push({ path: prefix || '(root)', before: stringify(before), after: stringify(after) })
}

function openDiff(row: LexemeRow): void {
  diffTarget.value = row
  const lines: DiffLine[] = []
  if (!row.publishedFields) {
    lines.push({ path: '(snapshot)', before: '从未发布', after: '当前草稿即首版' })
  } else {
    buildDiff(row.publishedFields, row.fields, '', lines)
    if (!lines.length) lines.push({ path: '(equal)', before: '与已发布一致', after: '无差异' })
  }
  diffLines.value = lines.slice(0, 200)
  diffVisible.value = true
}

const scheduleTargets = computed(() => [
  { type: 'PACK' as const, ref: LEXEME_PACK, label: `词包 ${LEXEME_PACK}` },
  ...rows.value
    .filter((row) => row.availability === 'APPROVED')
    .slice(0, 50)
    .map((row) => ({ type: 'LEXEME' as const, ref: row.lexemeId, label: `单词 ${row.headword}` })),
])

const CEFRS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const STATES = ['', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']

const tagsText = computed({
  get: () => (form.value.tags ?? []).join(','),
  set: (value: string) => {
    form.value.tags = value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20)
  },
})

const meaningCnText = computed({
  get: () => {
    const senses = form.value.senses ?? []
    return senses.length && typeof senses[0]?.meaningCn === 'string' ? senses[0].meaningCn : ''
  },
  set: (value: string) => {
    const senses = [...(form.value.senses ?? [])]
    const first = { ...(senses[0] ?? { pos: 'NOUN', meaningCn: '' }) }
    first.meaningCn = value
    senses[0] = first
    form.value.senses = senses
  },
})

const stateTag = (value: string): 'success' | 'warning' | 'danger' | 'info' => {
  if (value === 'PUBLISHED' || value === 'APPROVED') return 'success'
  if (value === 'ARCHIVED') return 'info'
  if (value === 'IN_REVIEW') return 'warning'
  return 'info'
}

function pronSummary(row: LexemeRow): string {
  const clean = row.pronunciations.filter((item) => item.qcStatus === 'CLEAN').length
  return `${row.pronunciations.length} 个 · ${clean} 已质检`
}

async function load(reset = true): Promise<void> {
  if (!canRead.value) { state.value = 'permission'; lastError.value = '当前会话没有内容读取权限。'; return }
  state.value = reset ? 'loading' : state.value
  lastError.value = null
  try {
    const page = await listLexemes({
      q: q.value, cefr: cefr.value || undefined,
      availability: availability.value || undefined, limit: 50,
    })
    rows.value = page.rows
    nextCursor.value = page.nextCursor
    state.value = page.rows.length ? 'ready' : 'empty'
  } catch (error) {
    state.value = 'error'
    lastError.value = error instanceof Error ? error.message : '单词列表读取失败。'
  }
}

async function loadMore(): Promise<void> {
  if (!nextCursor.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const page = await listLexemes({
      q: q.value, cefr: cefr.value || undefined,
      availability: availability.value || undefined, limit: 50, cursor: nextCursor.value,
    })
    rows.value = [...rows.value, ...page.rows]
    nextCursor.value = page.nextCursor
    if (rows.value.length) state.value = 'ready'
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载更多失败。')
  } finally {
    loadingMore.value = false
  }
}

function openCreate(): void {
  editing.value = null
  form.value = { headword: '', cefr: 'A1', difficulty: 1, senses: [{ pos: 'NOUN', meaningCn: '' }] }
  dialogVisible.value = true
}

function openEdit(row: LexemeRow): void {
  editing.value = row
  form.value = JSON.parse(JSON.stringify(row.fields)) as LexemeFields
  dialogVisible.value = true
}

async function save(): Promise<void> {
  if (!form.value.headword?.trim()) { ElMessage.error('请填写单词。'); return }
  formBusy.value = true
  try {
    await upsertLexeme(form.value, editing.value?.lexemeId)
    ElMessage.success('单词已保存为草稿。')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败。')
  } finally {
    formBusy.value = false
  }
}

async function runLifecycle(row: LexemeRow, command: 'LEXEME_SUBMIT_REVIEW' | 'LEXEME_PUBLISH' | 'LEXEME_UNPUBLISH' | 'LEXEME_ARCHIVE'): Promise<void> {
  const labels: Record<string, string> = {
    LEXEME_SUBMIT_REVIEW: '提交审核', LEXEME_PUBLISH: '发布', LEXEME_UNPUBLISH: '下线', LEXEME_ARCHIVE: '归档',
  }
  try {
    await ElMessageBox.confirm(`确认对「${row.headword}」执行${labels[command]}？该动作将写入服务端审计。`, '单词生命周期', { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' })
  } catch { return }
  try {
    await lexemeLifecycle(row, command)
    ElMessage.success(`${labels[command]}已提交。`)
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '命令提交失败。')
  }
}

async function runReview(row: LexemeRow, stage: 'FIRST' | 'FINAL'): Promise<void> {
  try {
    await ElMessageBox.confirm(`以${stage === 'FIRST' ? '一级' : '二级'}审核身份批准「${row.headword}」？作者不能审核自己的版本。`, '双审确认', { type: 'warning', confirmButtonText: '批准', cancelButtonText: '取消' })
  } catch { return }
  try {
    await lexemeReview(row, stage)
    ElMessage.success('审核已提交。')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '审核提交失败。')
  }
}

function openPronunciations(row: LexemeRow): void {
  pronTarget.value = row
  pronForm.value = { accent: 'US', ipa: row.fields.phoneticUS ?? '', audioAssetId: '', sourceType: 'HUMAN' }
  pronVisible.value = true
}

async function addPronunciation(): Promise<void> {
  if (!pronTarget.value) return
  if (!pronForm.value.ipa.trim() || !pronForm.value.audioAssetId.trim()) { ElMessage.error('请填写音标与音频资产 ID。'); return }
  pronBusy.value = true
  try {
    await upsertPronunciation(pronTarget.value, {
      accent: pronForm.value.accent as 'US' | 'UK' | 'SLOW',
      ipa: pronForm.value.ipa.trim(),
      audioAssetId: pronForm.value.audioAssetId.trim(),
      sourceType: pronForm.value.sourceType as 'HUMAN' | 'TTS',
    })
    ElMessage.success('发音已登记，等待质检。')
    await load()
    const fresh = rows.value.find((row) => row.lexemeId === pronTarget.value?.lexemeId)
    if (fresh) pronTarget.value = fresh
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '发音登记失败。')
  } finally {
    pronBusy.value = false
  }
}

async function qc(row: LexemeRow, pronunciationId: string, verdict: 'READY' | 'CLEAN' | 'FAILED'): Promise<void> {
  try {
    await qcPronunciation(row, pronunciationId, verdict)
    ElMessage.success(`质检结论 ${verdict} 已提交。`)
    await load()
    const fresh = rows.value.find((item) => item.lexemeId === row.lexemeId)
    if (fresh) pronTarget.value = fresh
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '质检提交失败。')
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack">
    <div class="view-intro">
      <div>
        <span class="admin-header__eyebrow">B1 · WORD MASTER</span>
        <h2>单词总控：每个单词、每个音标、每个播音</h2>
        <p>行级单词主数据归 content-service 所有；发音只存 media 资产引用，音频字节不经过内容服务。全部写动作需幂等键与审计。</p>
      </div>
      <el-button type="primary" :disabled="!canWrite" @click="openCreate">新建单词</el-button>
    </div>

    <el-card shadow="never">
      <el-space wrap>
        <el-input v-model="q" placeholder="搜索单词" clearable style="width: 220px" @keyup.enter="load()" />
        <el-select v-model="cefr" placeholder="CEFR" clearable style="width: 130px">
          <el-option v-for="level in CEFRS" :key="level" :label="level || '全部'" :value="level" />
        </el-select>
        <el-select v-model="availability" placeholder="状态" clearable style="width: 150px">
          <el-option v-for="item in STATES" :key="item" :label="item || '全部'" :value="item" />
        </el-select>
        <el-button :disabled="!canRead" @click="load()">查询</el-button>
        <el-button @click="load()">刷新</el-button>
      </el-space>
    </el-card>

    <el-alert v-if="state === 'permission'" title="当前会话没有内容读取权限" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'error'" :title="lastError ?? '单词数据暂时不可用'" type="error" :closable="false" show-icon />

    <el-card shadow="never">
      <el-table v-if="rows.length" :data="rows" stripe>
        <el-table-column prop="headword" label="单词" min-width="140" />
        <el-table-column prop="cefr" label="CEFR" width="80" />
        <el-table-column label="音标 US/UK" min-width="160">
          <template #default="scope">{{ scope.row.fields.phoneticUS ?? '—' }} / {{ scope.row.fields.phoneticUK ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="发音" width="110">
          <template #default="scope">{{ pronSummary(scope.row) }}</template>
        </el-table-column>
        <el-table-column prop="availability" label="状态" width="120">
          <template #default="scope"><el-tag :type="stateTag(scope.row.availability)" effect="plain">{{ scope.row.availability }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="stateVersion" label="版本" width="80" />
        <el-table-column label="动作" width="330" fixed="right">
          <template #default="scope">
            <el-space wrap>
              <el-button size="small" :disabled="!canWrite" @click="openEdit(scope.row)">编辑</el-button>
              <el-button size="small" :disabled="!canWrite" @click="openPronunciations(scope.row)">发音</el-button>
              <el-button size="small" link @click="openDiff(scope.row)">对比</el-button>
              <el-button v-if="scope.row.availability === 'DRAFT'" size="small" type="primary" link :disabled="!canWrite" @click="runLifecycle(scope.row, 'LEXEME_SUBMIT_REVIEW')">送审</el-button>
              <el-button v-if="scope.row.availability === 'IN_REVIEW'" size="small" type="primary" link @click="runReview(scope.row, 'FIRST')">一审</el-button>
              <el-button v-if="scope.row.availability === 'IN_REVIEW'" size="small" type="primary" link @click="runReview(scope.row, 'FINAL')">二审</el-button>
              <el-button v-if="scope.row.availability === 'APPROVED'" size="small" type="success" link :disabled="!canPublish" @click="runLifecycle(scope.row, 'LEXEME_PUBLISH')">发布</el-button>
              <el-button v-if="scope.row.availability === 'PUBLISHED'" size="small" type="warning" link :disabled="!canPublish" @click="runLifecycle(scope.row, 'LEXEME_UNPUBLISH')">下线</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else :description="state === 'empty' ? '暂无单词，从新建开始' : '正在等待服务端投影'" />
      <div v-if="nextCursor" style="margin-top: 12px; text-align: center">
        <el-button :loading="loadingMore" @click="loadMore()">加载更多</el-button>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editing ? `编辑 ${editing.headword}` : '新建单词'" width="640px">
      <el-form label-width="110px">
        <el-form-item label="单词">
          <el-input v-model="form.headword" :disabled="!!editing" placeholder="如 habit" />
        </el-form-item>
        <el-form-item label="CEFR">
          <el-select v-model="form.cefr" placeholder="选择">
            <el-option v-for="level in CEFRS.slice(1)" :key="level" :label="level" :value="level" />
          </el-select>
        </el-form-item>
        <el-form-item label="难度 1-5">
          <el-input-number v-model="form.difficulty" :min="1" :max="5" />
        </el-form-item>
        <el-form-item label="美式音标">
          <el-input v-model="form.phoneticUS" placeholder="如 ˈhæbɪt" />
        </el-form-item>
        <el-form-item label="英式音标">
          <el-input v-model="form.phoneticUK" placeholder="如 ˈhæbɪt" />
        </el-form-item>
        <el-form-item label="中文释义">
          <el-input v-model="meaningCnText" placeholder="如 习惯" />
        </el-form-item>
        <el-form-item label="标签(逗号分隔)">
          <el-input v-model="tagsText" placeholder="如 daily-life,exam" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formBusy" @click="save()">保存草稿</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pronVisible" :title="`发音管理 ${pronTarget?.headword ?? ''}`" width="720px">
      <el-table v-if="pronTarget?.pronunciations.length" :data="pronTarget.pronunciations" size="small">
        <el-table-column type="expand">
          <template #default="scope">
            <AudioPreview :asset-id="scope.row.audioAssetId" />
          </template>
        </el-table-column>
        <el-table-column prop="accent" label="口音" width="80" />
        <el-table-column prop="ipa" label="音标" min-width="120" />
        <el-table-column prop="audioAssetId" label="音频资产" min-width="160" />
        <el-table-column prop="sourceType" label="来源" width="90" />
        <el-table-column prop="qcStatus" label="质检" width="100" />
        <el-table-column label="动作" width="200" fixed="right">
          <template #default="scope">
            <el-space>
              <el-button size="small" type="success" link @click="qc(pronTarget!, scope.row.pronunciationId, 'CLEAN')">通过</el-button>
              <el-button size="small" type="warning" link @click="qc(pronTarget!, scope.row.pronunciationId, 'FAILED')">不通过</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无发音，先登记" />
      <el-divider>登记发音（引用 media 资产 ID）</el-divider>
      <el-space wrap>
        <el-select v-model="pronForm.accent" style="width: 110px">
          <el-option label="美音" value="US" /><el-option label="英音" value="UK" /><el-option label="慢速" value="SLOW" />
        </el-select>
        <el-input v-model="pronForm.ipa" placeholder="音标" style="width: 150px" />
        <el-input v-model="pronForm.audioAssetId" placeholder="音频资产 ID" style="width: 200px" />
        <el-select v-model="pronForm.sourceType" style="width: 110px">
          <el-option label="真人" value="HUMAN" /><el-option label="TTS" value="TTS" />
        </el-select>
        <el-button type="primary" :loading="pronBusy" :disabled="!canWrite" @click="addPronunciation()">登记</el-button>
      </el-space>
    </el-dialog>

    <el-dialog v-model="diffVisible" :title="`版本对比 ${diffTarget?.headword ?? ''}（草稿 vs 已发布快照）`" width="720px">
      <el-table :data="diffLines" size="small">
        <el-table-column prop="path" label="字段" min-width="180" />
        <el-table-column prop="before" label="已发布" min-width="220" show-overflow-tooltip />
        <el-table-column prop="after" label="当前草稿" min-width="220" show-overflow-tooltip />
      </el-table>
    </el-dialog>

    <SchedulePanel :pack-code="LEXEME_PACK" :targets="scheduleTargets" />
  </div>
</template>
