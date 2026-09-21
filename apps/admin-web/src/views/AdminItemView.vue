<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listItems,
  upsertItem,
  itemLifecycle,
  itemReview,
  importBatch,
  type BatchEntry,
  type ContentItemRow,
  type ItemKind,
} from '../api/content-items'
import { LEXEME_PACK } from '../api/lexeme'
import { useAdminStore } from '../stores/admin'
import { adminT } from '../platform/admin-i18n'
import '../platform/i18n-batch-a'
import SchedulePanel from '../components/SchedulePanel.vue'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error'

const session = useAdminStore()
const rows = ref<ContentItemRow[]>([])
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const nextCursor = ref<string | null>(null)

const kind = ref('')
const q = ref('')
const availability = ref('')

const canRead = computed(() => session.can('admin.content.read'))
const canWrite = computed(() => session.can('admin.content.write'))
const canPublish = computed(() => session.can('admin.content.publish'))

const dialogVisible = ref(false)
const editing = ref<ContentItemRow | null>(null)
const formKind = ref<ItemKind>('QUESTION')
const formStem = ref('')
const formFieldsText = ref('{}')
const formBusy = ref(false)

const batchVisible = ref(false)
const batchText = ref('')
const batchBusy = ref(false)
const batchResult = ref<Record<string, unknown> | null>(null)

const KINDS = computed<Array<{ label: string; value: string }>>(() => [
  { label: adminT('itemView.kindAll'), value: '' },
  { label: adminT('itemView.kindQuestion'), value: 'QUESTION' },
  { label: adminT('itemView.kindExample'), value: 'EXAMPLE' },
  { label: adminT('itemView.kindGrammar'), value: 'GRAMMAR_POINT' },
  { label: adminT('itemView.kindPassage'), value: 'PASSAGE' },
  { label: adminT('itemView.kindExercise'), value: 'EXERCISE' },
  { label: adminT('itemView.kindDictation'), value: 'DICTATION' },
  { label: adminT('itemView.kindShadowing'), value: 'SHADOWING' },
])

const scheduleTargets = computed(() =>
  rows.value
    .filter((row) => row.availability === 'APPROVED')
    .slice(0, 50)
    .map((row) => ({ type: 'ITEM' as const, ref: row.itemId, label: `${row.kind} ${row.stem.slice(0, 24) || row.itemId}` })),
)

async function load(reset = true): Promise<void> {
  if (!canRead.value) { state.value = 'permission'; lastError.value = adminT('itemView.noReadPermission'); return }
  if (reset) state.value = 'loading'
  lastError.value = null
  try {
    const page = await listItems({ kind: kind.value || undefined, q: q.value, availability: availability.value || undefined, limit: 50 })
    rows.value = page.rows
    nextCursor.value = page.nextCursor
    state.value = page.rows.length ? 'ready' : 'empty'
  } catch (error) {
    state.value = 'error'
    lastError.value = error instanceof Error ? error.message : adminT('itemView.listFailed')
  }
}

function openCreate(): void {
  editing.value = null
  formKind.value = 'QUESTION'
  formStem.value = ''
  formFieldsText.value = '{}'
  dialogVisible.value = true
}

function openEdit(row: ContentItemRow): void {
  editing.value = row
  formKind.value = row.kind
  formStem.value = row.stem
  formFieldsText.value = JSON.stringify(row.fields, null, 2)
  dialogVisible.value = true
}

function parseFields(): Record<string, unknown> {
  try {
    const value = JSON.parse(formFieldsText.value || '{}') as unknown
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(adminT('itemView.fieldsMustBeObject'))
    return value as Record<string, unknown>
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : adminT('itemView.fieldsInvalidJson'))
  }
}

async function save(): Promise<void> {
  let fields: Record<string, unknown>
  try {
    fields = parseFields()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('itemView.configParseFailed'))
    return
  }
  formBusy.value = true
  try {
    await upsertItem(LEXEME_PACK, { itemId: editing.value?.itemId, kind: formKind.value, stem: formStem.value.trim(), fields })
    ElMessage.success(adminT('itemView.savedDraft'))
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('itemView.saveFailed'))
  } finally {
    formBusy.value = false
  }
}

async function runLifecycle(row: ContentItemRow, command: 'ITEM_SUBMIT_REVIEW' | 'ITEM_PUBLISH' | 'ITEM_UNPUBLISH' | 'ITEM_ARCHIVE'): Promise<void> {
  try {
    await ElMessageBox.confirm(adminT('itemView.lifecycleConfirm', { itemId: row.itemId, command }), adminT('itemView.lifecycleTitle'), { type: 'warning', confirmButtonText: adminT('itemView.confirmOk'), cancelButtonText: adminT('itemView.cancel') })
  } catch { return }
  try {
    await itemLifecycle(row, command)
    ElMessage.success(adminT('itemView.lifecycleSubmitted'))
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('itemView.lifecycleFailed'))
  }
}

async function runReview(row: ContentItemRow, stage: 'FIRST' | 'FINAL'): Promise<void> {
  try {
    await itemReview(row, stage)
    ElMessage.success(adminT('itemView.reviewSubmitted'))
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('itemView.reviewFailed'))
  }
}

function batchTemplate(): string {
  return JSON.stringify(
    {
      hint: adminT('itemView.batchHint'),
      rows: [
        { kind: 'QUESTION', stem: 'Choose: I ___ a habit.', fields: { options: ['build', 'builds'], answerIndex: 0, explanation: adminT('itemView.batchExampleExplanation'), cefr: 'A2' } },
        { kind: 'EXAMPLE', stem: 'Build a habit.', fields: { translation: adminT('itemView.batchExampleTranslation'), source: 'textbook-u1' } },
      ],
    },
    null,
    2,
  )
}

function parseBatch(): BatchEntry[] {
  const raw = batchText.value.trim()
  if (!raw) throw new Error(adminT('itemView.batchEmpty'))
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean)
  return lines.map((line, index) => {
    let entry: unknown
    try {
      entry = JSON.parse(line) as unknown
    } catch {
      throw new Error(adminT('itemView.batchLineNotJson', { line: index + 1 }))
    }
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new Error(adminT('itemView.batchLineNotObject', { line: index + 1 }))
    const row = entry as Record<string, unknown>
    const kind = typeof row.kind === 'string' ? row.kind.trim().toUpperCase() : ''
    if (!['QUESTION', 'EXAMPLE', 'GRAMMAR_POINT', 'PASSAGE', 'EXERCISE', 'DICTATION', 'SHADOWING'].includes(kind)) {
      throw new Error(adminT('itemView.batchLineBadKind', { line: index + 1 }))
    }
    return {
      contentCode: LEXEME_PACK,
      item: { kind, stem: typeof row.stem === 'string' ? row.stem : '', fields: (row.fields ?? {}) as Record<string, unknown> },
    }
  })
}

async function runBatch(): Promise<void> {
  let entries: BatchEntry[]
  try {
    entries = parseBatch()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('itemView.batchParseFailed'))
    return
  }
  if (!entries.length || entries.length > 100) { ElMessage.error(adminT('itemView.batchRange')); return }
  batchBusy.value = true
  try {
    batchResult.value = await importBatch(entries)
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('itemView.batchImportFailed'))
  } finally {
    batchBusy.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack">
    <div class="view-intro">
      <div>
        <span class="admin-header__eyebrow">B2 · CONTENT ITEMS</span>
        <h2>{{ adminT('itemView.title') }}</h2>
        <p>{{ adminT('itemView.description') }}</p>
      </div>
      <el-space>
        <el-button @click="batchVisible = true" :disabled="!canWrite">{{ adminT('itemView.batchImport') }}</el-button>
        <el-button type="primary" :disabled="!canWrite" @click="openCreate()">{{ adminT('itemView.createItem') }}</el-button>
      </el-space>
    </div>

    <el-card shadow="never">
      <el-space wrap>
        <el-select v-model="kind" :placeholder="adminT('itemView.kindPlaceholder')" clearable style="width: 140px">
          <el-option v-for="k in KINDS" :key="k.value" :label="k.label" :value="k.value" />
        </el-select>
        <el-input v-model="q" :placeholder="adminT('itemView.searchPlaceholder')" clearable style="width: 220px" @keyup.enter="load()" />
        <el-button :disabled="!canRead" @click="load()">{{ adminT('itemView.query') }}</el-button>
      </el-space>
    </el-card>

    <el-alert v-if="state === 'permission'" :title="adminT('itemView.noReadPermissionTitle')" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'error'" :title="lastError ?? adminT('itemView.dataFallback')" type="error" :closable="false" show-icon />

    <el-card shadow="never">
      <el-table v-if="rows.length" :data="rows" stripe>
        <el-table-column prop="kind" :label="adminT('itemView.colKind')" width="130" />
        <el-table-column prop="stem" :label="adminT('itemView.colStem')" min-width="220" show-overflow-tooltip />
        <el-table-column prop="availability" :label="adminT('itemView.colStatus')" width="120" />
        <el-table-column prop="stateVersion" :label="adminT('itemView.colVersion')" width="80" />
        <el-table-column :label="adminT('itemView.colActions')" width="300" fixed="right">
          <template #default="scope">
            <el-space wrap>
              <el-button size="small" :disabled="!canWrite" @click="openEdit(scope.row)">{{ adminT('itemView.actionEdit') }}</el-button>
              <el-button v-if="scope.row.availability === 'DRAFT'" size="small" type="primary" link :disabled="!canWrite" @click="runLifecycle(scope.row, 'ITEM_SUBMIT_REVIEW')">{{ adminT('itemView.actionSubmit') }}</el-button>
              <el-button v-if="scope.row.availability === 'IN_REVIEW'" size="small" type="primary" link @click="runReview(scope.row, 'FIRST')">{{ adminT('itemView.actionFirst') }}</el-button>
              <el-button v-if="scope.row.availability === 'IN_REVIEW'" size="small" type="primary" link @click="runReview(scope.row, 'FINAL')">{{ adminT('itemView.actionFinal') }}</el-button>
              <el-button v-if="scope.row.availability === 'APPROVED'" size="small" type="success" link :disabled="!canPublish" @click="runLifecycle(scope.row, 'ITEM_PUBLISH')">{{ adminT('itemView.actionPublish') }}</el-button>
              <el-button v-if="scope.row.availability === 'PUBLISHED'" size="small" type="warning" link :disabled="!canPublish" @click="runLifecycle(scope.row, 'ITEM_UNPUBLISH')">{{ adminT('itemView.actionUnpublish') }}</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else :description="adminT('itemView.empty')" />
    </el-card>

    <SchedulePanel :pack-code="LEXEME_PACK" :targets="scheduleTargets" />

    <el-dialog v-model="dialogVisible" :title="editing ? adminT('itemView.editItem') : adminT('itemView.createItem')" width="640px">
      <el-form label-width="110px">
        <el-form-item :label="adminT('itemView.formKind')">
          <el-select v-model="formKind" :disabled="!!editing">
            <el-option :label="adminT('itemView.kindQuestion')" value="QUESTION" /><el-option :label="adminT('itemView.kindExample')" value="EXAMPLE" />
            <el-option :label="adminT('itemView.kindGrammar')" value="GRAMMAR_POINT" /><el-option :label="adminT('itemView.kindPassage')" value="PASSAGE" />
            <el-option :label="adminT('itemView.kindExercise')" value="EXERCISE" />
            <el-option :label="adminT('itemView.kindDictation')" value="DICTATION" /><el-option :label="adminT('itemView.kindShadowing')" value="SHADOWING" />
          </el-select>
        </el-form-item>
        <el-form-item :label="adminT('itemView.formStem')">
          <el-input v-model="formStem" type="textarea" :rows="2" :placeholder="adminT('itemView.stemPlaceholder')" />
        </el-form-item>
        <el-form-item :label="adminT('itemView.formFields')">
          <el-input v-model="formFieldsText" type="textarea" :rows="8" placeholder='{"options":[],"answerIndex":0}' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ adminT('itemView.cancel') }}</el-button>
        <el-button type="primary" :loading="formBusy" @click="save()">{{ adminT('itemView.saveDraft') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchVisible" :title="adminT('itemView.batchTitle')" width="680px">
      <el-alert :title="adminT('itemView.batchNotice')" type="info" :closable="false" show-icon />
      <el-input v-model="batchText" type="textarea" :rows="10" :placeholder="batchTemplate()" />
      <el-card v-if="batchResult" shadow="never" style="margin-top: 12px">
        <p>{{ adminT('itemView.batchSummary', { total: batchResult.total, accepted: batchResult.accepted, skipped: batchResult.skipped, failed: batchResult.failed }) }}</p>
      </el-card>
      <template #footer>
        <el-button @click="batchVisible = false">{{ adminT('itemView.close') }}</el-button>
        <el-button type="primary" :loading="batchBusy" @click="runBatch()">{{ adminT('itemView.submitImport') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
