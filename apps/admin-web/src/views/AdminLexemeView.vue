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
import { adminT } from '../platform/admin-i18n'
import '../platform/i18n-batch-a'
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
const packCode = ref(LEXEME_PACK)
const language = ref('')

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
    lines.push({ path: '(snapshot)', before: adminT('lexemeView.diffNeverPublished'), after: adminT('lexemeView.diffFirstVersion') })
  } else {
    buildDiff(row.publishedFields, row.fields, '', lines)
    if (!lines.length) lines.push({ path: '(equal)', before: adminT('lexemeView.diffEqual'), after: adminT('lexemeView.diffNoDiff') })
  }
  diffLines.value = lines.slice(0, 200)
  diffVisible.value = true
}

const scheduleTargets = computed(() => [
  { type: 'PACK' as const, ref: LEXEME_PACK, label: adminT('lexemeView.packLabel', { pack: LEXEME_PACK }) },
  ...rows.value
    .filter((row) => row.availability === 'APPROVED')
    .slice(0, 50)
    .map((row) => ({ type: 'LEXEME' as const, ref: row.lexemeId, label: adminT('lexemeView.lexemeLabel', { headword: row.headword }) })),
])

const CEFRS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const STATES = ['', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']
const LANGUAGES = ['', 'en-US', 'fr-FR', 'de-DE']
const PACKS = ['VOCAB-PHASE1', 'VOCAB-FR-PHASE1', 'VOCAB-DE-PHASE1']
const POS_OPTIONS = ['NOUN', 'VERB', 'ADJ', 'ADV', 'PRON', 'PREP', 'CONJ', 'INTERJ', 'PHRASE', 'ARTICLE', 'PRONOUN', 'DETERMINER', 'PREPOSITION', 'CONJUNCTION', 'INTERJECTION', 'NUMERAL', 'PARTICLE']
const GENDERS = ['', 'MASCULINE', 'FEMININE', 'NEUTER']
const NUMBERS = ['', 'SINGULAR', 'PLURAL']
const CASES = ['', 'NOMINATIVE', 'ACCUSATIVE', 'DATIVE', 'GENITIVE', 'INSTRUMENTAL', 'PREPOSITIONAL']

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

const meaningLocalText = computed({
  get: () => {
    const senses = form.value.senses ?? []
    return senses.length && typeof senses[0]?.meaningLocal === 'string' ? senses[0].meaningLocal : ''
  },
  set: (value: string) => {
    const senses = [...(form.value.senses ?? [])]
    const first = { ...(senses[0] ?? { pos: 'NOUN', meaningCn: '' }) }
    first.meaningLocal = value
    senses[0] = first
    form.value.senses = senses
  },
})

const verbGroupText = computed({
  get: () => form.value.conjugation?.verbGroup ?? '',
  set: (value: string) => {
    if (!value.trim() && !form.value.conjugation?.irregular) {
      form.value.conjugation = undefined
      return
    }
    form.value.conjugation = { ...form.value.conjugation, verbGroup: value }
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
  return adminT('lexemeView.pronSummary', { total: row.pronunciations.length, clean })
}

async function load(reset = true): Promise<void> {
  if (!canRead.value) { state.value = 'permission'; lastError.value = adminT('lexemeView.noReadPermission'); return }
  state.value = reset ? 'loading' : state.value
  lastError.value = null
  try {
    const page = await listLexemes({
      q: q.value, cefr: cefr.value || undefined,
      availability: availability.value || undefined,
      packCode: packCode.value || undefined, language: language.value || undefined, limit: 50,
    })
    rows.value = page.rows
    nextCursor.value = page.nextCursor
    state.value = page.rows.length ? 'ready' : 'empty'
  } catch (error) {
    state.value = 'error'
    lastError.value = error instanceof Error ? error.message : adminT('lexemeView.listFailed')
  }
}

async function loadMore(): Promise<void> {
  if (!nextCursor.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const page = await listLexemes({
      q: q.value, cefr: cefr.value || undefined,
      availability: availability.value || undefined,
      packCode: packCode.value || undefined, language: language.value || undefined,
      limit: 50, cursor: nextCursor.value,
    })
    rows.value = [...rows.value, ...page.rows]
    nextCursor.value = page.nextCursor
    if (rows.value.length) state.value = 'ready'
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('lexemeView.loadMoreFailed'))
  } finally {
    loadingMore.value = false
  }
}

function openCreate(): void {
  editing.value = null
  form.value = { headword: '', language: 'en-US', pos: ['NOUN'], cefr: 'A1', difficulty: 1, senses: [{ pos: 'NOUN', meaningCn: '' }] }
  dialogVisible.value = true
}

function openEdit(row: LexemeRow): void {
  editing.value = row
  form.value = JSON.parse(JSON.stringify(row.fields)) as LexemeFields
  if (!form.value.language) form.value.language = row.language || 'en-US'
  dialogVisible.value = true
}

async function save(): Promise<void> {
  if (!form.value.headword?.trim()) { ElMessage.error(adminT('lexemeView.requireHeadword')); return }
  formBusy.value = true
  try {
    // B4 morphology: cleared selects submit '' — drop them so the server sees
    // omitted (optional) rather than an illegal empty value.
    const payload: LexemeFields = { ...form.value }
    for (const key of ['gender', 'number', 'grammaticalCase'] as const) {
      if (payload[key] === '') delete payload[key]
    }
    if (payload.conjugation && !payload.conjugation.verbGroup?.trim() && !payload.conjugation.irregular) {
      delete payload.conjugation
    }
    await upsertLexeme(payload, editing.value?.lexemeId)
    ElMessage.success(adminT('lexemeView.savedDraft'))
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('lexemeView.saveFailed'))
  } finally {
    formBusy.value = false
  }
}

async function runLifecycle(row: LexemeRow, command: 'LEXEME_SUBMIT_REVIEW' | 'LEXEME_PUBLISH' | 'LEXEME_UNPUBLISH' | 'LEXEME_ARCHIVE'): Promise<void> {
  const labels: Record<string, string> = {
    LEXEME_SUBMIT_REVIEW: adminT('lexemeView.lifecycleSubmitReview'), LEXEME_PUBLISH: adminT('lexemeView.lifecyclePublish'), LEXEME_UNPUBLISH: adminT('lexemeView.lifecycleUnpublish'), LEXEME_ARCHIVE: adminT('lexemeView.lifecycleArchive'),
  }
  try {
    await ElMessageBox.confirm(adminT('lexemeView.lifecycleConfirm', { headword: row.headword, action: labels[command] }), adminT('lexemeView.lifecycleTitle'), { type: 'warning', confirmButtonText: adminT('lexemeView.confirmOk'), cancelButtonText: adminT('lexemeView.cancel') })
  } catch { return }
  try {
    await lexemeLifecycle(row, command)
    ElMessage.success(adminT('lexemeView.lifecycleSubmitted', { action: labels[command] }))
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('lexemeView.lifecycleFailed'))
  }
}

async function runReview(row: LexemeRow, stage: 'FIRST' | 'FINAL'): Promise<void> {
  try {
    await ElMessageBox.confirm(adminT('lexemeView.reviewConfirm', { stage: stage === 'FIRST' ? adminT('lexemeView.reviewFirst') : adminT('lexemeView.reviewSecond'), headword: row.headword }), adminT('lexemeView.reviewTitle'), { type: 'warning', confirmButtonText: adminT('lexemeView.reviewApprove'), cancelButtonText: adminT('lexemeView.cancel') })
  } catch { return }
  try {
    await lexemeReview(row, stage)
    ElMessage.success(adminT('lexemeView.reviewSubmitted'))
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('lexemeView.reviewFailed'))
  }
}

function openPronunciations(row: LexemeRow): void {
  pronTarget.value = row
  pronForm.value = { accent: 'US', ipa: row.fields.phoneticUS ?? '', audioAssetId: '', sourceType: 'HUMAN' }
  pronVisible.value = true
}

async function addPronunciation(): Promise<void> {
  if (!pronTarget.value) return
  if (!pronForm.value.ipa.trim() || !pronForm.value.audioAssetId.trim()) { ElMessage.error(adminT('lexemeView.requirePron')); return }
  pronBusy.value = true
  try {
    await upsertPronunciation(pronTarget.value, {
      accent: pronForm.value.accent.trim() || 'US',
      ipa: pronForm.value.ipa.trim(),
      audioAssetId: pronForm.value.audioAssetId.trim(),
      sourceType: pronForm.value.sourceType as 'HUMAN' | 'TTS',
    })
    ElMessage.success(adminT('lexemeView.pronSaved'))
    await load()
    const fresh = rows.value.find((row) => row.lexemeId === pronTarget.value?.lexemeId)
    if (fresh) pronTarget.value = fresh
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('lexemeView.pronFailed'))
  } finally {
    pronBusy.value = false
  }
}

async function qc(row: LexemeRow, pronunciationId: string, verdict: 'READY' | 'CLEAN' | 'FAILED'): Promise<void> {
  try {
    await qcPronunciation(row, pronunciationId, verdict)
    ElMessage.success(adminT('lexemeView.qcSubmitted', { verdict }))
    await load()
    const fresh = rows.value.find((item) => item.lexemeId === row.lexemeId)
    if (fresh) pronTarget.value = fresh
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('lexemeView.qcFailed'))
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack">
    <div class="view-intro">
      <div>
        <span class="admin-header__eyebrow">B1 · WORD MASTER</span>
        <h2>{{ adminT('lexemeView.title') }}</h2>
        <p>{{ adminT('lexemeView.description') }}</p>
      </div>
      <el-space>
        <el-button @click="$router.push('/phonetics')">{{ adminT('lexemeView.browsePhonetics') }}</el-button>
        <el-button type="primary" :disabled="!canWrite" @click="openCreate">{{ adminT('lexemeView.createLexeme') }}</el-button>
      </el-space>
    </div>

    <el-card shadow="never">
      <el-space wrap>
        <el-input v-model="q" :placeholder="adminT('lexemeView.searchPlaceholder')" clearable style="width: 220px" @keyup.enter="load()" />
        <el-select v-model="cefr" placeholder="CEFR" clearable style="width: 130px">
          <el-option v-for="level in CEFRS" :key="level" :label="level || adminT('lexemeView.all')" :value="level" />
        </el-select>
        <el-select v-model="availability" :placeholder="adminT('lexemeView.statusPlaceholder')" clearable style="width: 150px">
          <el-option v-for="item in STATES" :key="item" :label="item || adminT('lexemeView.all')" :value="item" />
        </el-select>
        <el-select v-model="packCode" :placeholder="adminT('lexemeView.packPlaceholder')" clearable style="width: 200px">
          <el-option :label="adminT('lexemeView.allPacks')" value="" />
          <el-option v-for="pack in PACKS" :key="pack" :label="pack" :value="pack" />
        </el-select>
        <el-select v-model="language" :placeholder="adminT('lexemeView.languagePlaceholder')" clearable style="width: 130px">
          <el-option v-for="lang in LANGUAGES" :key="lang" :label="lang || adminT('lexemeView.all')" :value="lang" />
        </el-select>
        <el-button :disabled="!canRead" @click="load()">{{ adminT('lexemeView.query') }}</el-button>
        <el-button @click="load()">{{ adminT('lexemeView.refresh') }}</el-button>
      </el-space>
    </el-card>

    <el-alert v-if="state === 'permission'" :title="adminT('lexemeView.noReadPermissionTitle')" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'error'" :title="lastError ?? adminT('lexemeView.listFallback')" type="error" :closable="false" show-icon />

    <el-card shadow="never">
      <el-table v-if="rows.length" :data="rows" stripe>
        <el-table-column prop="headword" :label="adminT('lexemeView.colHeadword')" min-width="140" />
        <el-table-column prop="language" :label="adminT('lexemeView.colLanguage')" width="90" />
        <el-table-column prop="packCode" :label="adminT('lexemeView.colPack')" min-width="150" />
        <el-table-column prop="cefr" label="CEFR" width="80" />
        <el-table-column :label="adminT('lexemeView.colPhonetics')" min-width="160">
          <template #default="scope">{{ scope.row.fields.phoneticUS ?? '—' }} / {{ scope.row.fields.phoneticUK ?? '—' }}</template>
        </el-table-column>
        <el-table-column :label="adminT('lexemeView.colPron')" width="110">
          <template #default="scope">{{ pronSummary(scope.row) }}</template>
        </el-table-column>
        <el-table-column prop="availability" :label="adminT('lexemeView.colStatus')" width="120">
          <template #default="scope"><el-tag :type="stateTag(scope.row.availability)" effect="plain">{{ scope.row.availability }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="stateVersion" :label="adminT('lexemeView.colVersion')" width="80" />
        <el-table-column :label="adminT('lexemeView.colActions')" width="330" fixed="right">
          <template #default="scope">
            <el-space wrap>
              <el-button size="small" :disabled="!canWrite" @click="openEdit(scope.row)">{{ adminT('lexemeView.actionEdit') }}</el-button>
              <el-button size="small" :disabled="!canWrite" @click="openPronunciations(scope.row)">{{ adminT('lexemeView.actionPron') }}</el-button>
              <el-button size="small" link @click="openDiff(scope.row)">{{ adminT('lexemeView.actionDiff') }}</el-button>
              <el-button v-if="scope.row.availability === 'DRAFT'" size="small" type="primary" link :disabled="!canWrite" @click="runLifecycle(scope.row, 'LEXEME_SUBMIT_REVIEW')">{{ adminT('lexemeView.actionSubmit') }}</el-button>
              <el-button v-if="scope.row.availability === 'IN_REVIEW'" size="small" type="primary" link @click="runReview(scope.row, 'FIRST')">{{ adminT('lexemeView.actionFirst') }}</el-button>
              <el-button v-if="scope.row.availability === 'IN_REVIEW'" size="small" type="primary" link @click="runReview(scope.row, 'FINAL')">{{ adminT('lexemeView.actionFinal') }}</el-button>
              <el-button v-if="scope.row.availability === 'APPROVED'" size="small" type="success" link :disabled="!canPublish" @click="runLifecycle(scope.row, 'LEXEME_PUBLISH')">{{ adminT('lexemeView.actionPublish') }}</el-button>
              <el-button v-if="scope.row.availability === 'PUBLISHED'" size="small" type="warning" link :disabled="!canPublish" @click="runLifecycle(scope.row, 'LEXEME_UNPUBLISH')">{{ adminT('lexemeView.actionUnpublish') }}</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else :description="state === 'empty' ? adminT('lexemeView.emptyCreate') : adminT('lexemeView.emptyWaiting')" />
      <div v-if="nextCursor" style="margin-top: 12px; text-align: center">
        <el-button :loading="loadingMore" @click="loadMore()">{{ adminT('lexemeView.loadMore') }}</el-button>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editing ? adminT('lexemeView.editTitle', { headword: editing.headword }) : adminT('lexemeView.createLexeme')" width="640px">
      <el-form label-width="110px">
        <el-form-item :label="adminT('lexemeView.formHeadword')">
          <el-input v-model="form.headword" :disabled="!!editing" :placeholder="adminT('lexemeView.headwordPlaceholder')" />
        </el-form-item>
        <el-form-item :label="adminT('lexemeView.formLanguage')">
          <el-select v-model="form.language" :placeholder="adminT('lexemeView.selectPlaceholder')">
            <el-option :label="adminT('lexemeView.langEn')" value="en-US" />
            <el-option :label="adminT('lexemeView.langFr')" value="fr-FR" />
            <el-option :label="adminT('lexemeView.langDe')" value="de-DE" />
          </el-select>
        </el-form-item>
        <el-form-item :label="adminT('lexemeView.formPos')">
          <el-select v-model="form.pos" multiple :placeholder="adminT('lexemeView.posPlaceholder')" style="width: 100%">
            <el-option v-for="pos in POS_OPTIONS" :key="pos" :label="pos" :value="pos" />
          </el-select>
        </el-form-item>
        <el-form-item :label="adminT('lexemeView.formMorphology')">
          <el-space wrap>
            <el-select v-model="form.gender" :placeholder="adminT('lexemeView.genderPlaceholder')" clearable style="width: 130px">
              <el-option v-for="item in GENDERS" :key="item" :label="item || '—'" :value="item" />
            </el-select>
            <el-select v-model="form.number" :placeholder="adminT('lexemeView.numberPlaceholder')" clearable style="width: 130px">
              <el-option v-for="item in NUMBERS" :key="item" :label="item || '—'" :value="item" />
            </el-select>
            <el-select v-model="form.grammaticalCase" :placeholder="adminT('lexemeView.casePlaceholder')" clearable style="width: 150px">
              <el-option v-for="item in CASES" :key="item" :label="item || '—'" :value="item" />
            </el-select>
          </el-space>
        </el-form-item>
        <el-form-item :label="adminT('lexemeView.formVerbGroup')">
          <el-input v-model="verbGroupText" :placeholder="adminT('lexemeView.verbGroupPlaceholder')" />
        </el-form-item>
        <el-form-item label="CEFR">
          <el-select v-model="form.cefr" :placeholder="adminT('lexemeView.selectPlaceholder')">
            <el-option v-for="level in CEFRS.slice(1)" :key="level" :label="level" :value="level" />
          </el-select>
        </el-form-item>
        <el-form-item :label="adminT('lexemeView.formDifficulty')">
          <el-input-number v-model="form.difficulty" :min="1" :max="5" />
        </el-form-item>
        <el-form-item :label="adminT('lexemeView.formPhoneticUS')">
          <el-input v-model="form.phoneticUS" :placeholder="adminT('lexemeView.phoneticPlaceholder')" />
        </el-form-item>
        <el-form-item :label="adminT('lexemeView.formPhoneticUK')">
          <el-input v-model="form.phoneticUK" :placeholder="adminT('lexemeView.phoneticPlaceholder')" />
        </el-form-item>
        <el-form-item :label="adminT('lexemeView.formMeaningCn')">
          <el-input v-model="meaningCnText" :placeholder="adminT('lexemeView.meaningCnPlaceholder')" />
        </el-form-item>
        <el-form-item :label="adminT('lexemeView.formMeaningLocal')">
          <el-input v-model="meaningLocalText" :placeholder="adminT('lexemeView.meaningLocalPlaceholder')" />
        </el-form-item>
        <el-form-item :label="adminT('lexemeView.formTags')">
          <el-input v-model="tagsText" :placeholder="adminT('lexemeView.tagsPlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ adminT('lexemeView.cancel') }}</el-button>
        <el-button type="primary" :loading="formBusy" @click="save()">{{ adminT('lexemeView.saveDraft') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pronVisible" :title="adminT('lexemeView.pronTitle', { headword: pronTarget?.headword ?? '' })" width="720px">
      <el-table v-if="pronTarget?.pronunciations.length" :data="pronTarget.pronunciations" size="small">
        <el-table-column type="expand">
          <template #default="scope">
            <AudioPreview :asset-id="scope.row.audioAssetId" />
          </template>
        </el-table-column>
        <el-table-column prop="accent" :label="adminT('lexemeView.pronAccent')" width="80" />
        <el-table-column prop="ipa" :label="adminT('lexemeView.pronIpa')" min-width="120" />
        <el-table-column prop="audioAssetId" :label="adminT('lexemeView.pronAsset')" min-width="160" />
        <el-table-column prop="sourceType" :label="adminT('lexemeView.pronSource')" width="90" />
        <el-table-column prop="qcStatus" :label="adminT('lexemeView.pronQc')" width="100" />
        <el-table-column :label="adminT('lexemeView.colActions')" width="200" fixed="right">
          <template #default="scope">
            <el-space>
              <el-button size="small" type="success" link @click="qc(pronTarget!, scope.row.pronunciationId, 'CLEAN')">{{ adminT('lexemeView.pronPass') }}</el-button>
              <el-button size="small" type="warning" link @click="qc(pronTarget!, scope.row.pronunciationId, 'FAILED')">{{ adminT('lexemeView.pronFail') }}</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else :description="adminT('lexemeView.pronEmpty')" />
      <el-divider>{{ adminT('lexemeView.pronRegisterDivider') }}</el-divider>
      <el-space wrap>
        <el-select v-model="pronForm.accent" filterable allow-create default-first-option style="width: 130px">
          <el-option :label="adminT('lexemeView.accentUS')" value="US" /><el-option :label="adminT('lexemeView.accentUK')" value="UK" /><el-option :label="adminT('lexemeView.accentSlow')" value="SLOW" /><el-option :label="adminT('lexemeView.accentFrParis')" value="FR-PARIS" />
        </el-select>
        <el-input v-model="pronForm.ipa" :placeholder="adminT('lexemeView.ipaPlaceholder')" style="width: 150px" />
        <el-input v-model="pronForm.audioAssetId" :placeholder="adminT('lexemeView.assetPlaceholder')" style="width: 200px" />
        <el-select v-model="pronForm.sourceType" style="width: 110px">
          <el-option :label="adminT('lexemeView.sourceHuman')" value="HUMAN" /><el-option label="TTS" value="TTS" />
        </el-select>
        <el-button type="primary" :loading="pronBusy" :disabled="!canWrite" @click="addPronunciation()">{{ adminT('lexemeView.register') }}</el-button>
      </el-space>
    </el-dialog>

    <el-dialog v-model="diffVisible" :title="adminT('lexemeView.diffTitle', { headword: diffTarget?.headword ?? '' })" width="720px">
      <el-table :data="diffLines" size="small">
        <el-table-column prop="path" :label="adminT('lexemeView.diffField')" min-width="180" />
        <el-table-column prop="before" :label="adminT('lexemeView.diffPublished')" min-width="220" show-overflow-tooltip />
        <el-table-column prop="after" :label="adminT('lexemeView.diffDraft')" min-width="220" show-overflow-tooltip />
      </el-table>
    </el-dialog>

    <SchedulePanel :pack-code="LEXEME_PACK" :targets="scheduleTargets" />
  </div>
</template>
