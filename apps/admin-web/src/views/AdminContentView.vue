<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminT } from '../platform/admin-i18n'
import '../platform/i18n-batch-b'
import { ContentCommandError, contentServiceCommandAdapter } from '../api/content-service-command-adapter'
import {
  type ContentSnapshot,
  type ContentStatus,
  type ReviewDecision,
  type ReviewTaskProjection,
} from '../domain/content'
import { useAdminStore } from '../stores/admin'

type ContentViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error' | 'recovery'

const session = useAdminStore()
const viewState = ref<ContentViewState>('loading')
const contents = ref<ContentSnapshot[]>([])
const reviewTasks = ref<ReviewTaskProjection[]>([])
const selectedContentId = ref('')
const contentCode = ref('')
const contentType = ref('UNIT')
const title = ref('')
const contentHash = ref('')
const sourceCode = ref('')
const licenseCode = ref('')
const payloadText = ref('{}')
const versionId = ref('')
const stateVersion = ref('')
const rollbackTargetVersion = ref('')
const rollbackReason = ref('')
const dirty = ref(false)
const busyAction = ref<string | null>(null)
const lastError = ref<ContentCommandError | null>(null)
const lastRequestId = ref<string | null>(null)

const selectedContent = computed(() => contents.value.find((content) => content.contentId === selectedContentId.value) ?? null)
const selectedStatus = computed<ContentStatus | null>(() => selectedContent.value?.status ?? null)
const canWrite = computed(() => session.can('admin.content.write'))
const canPublish = computed(() => session.can('admin.content.publish'))
const canRollback = computed(() => session.can('admin.content.rollback'))
const firstApproval = computed(() => reviewTasks.value.some((task) => task.contentId === selectedContentId.value && task.stage === 'FIRST' && task.status === 'APPROVED'))
const finalApproval = computed(() => reviewTasks.value.some((task) => task.contentId === selectedContentId.value && task.stage === 'FINAL' && task.status === 'APPROVED'))
const dualApprovalReady = computed(() => firstApproval.value && finalApproval.value)
const canEditSelected = computed(() => canWrite.value && (!selectedStatus.value || selectedStatus.value === 'DRAFT' || selectedStatus.value === 'REJECTED'))
const canValidateSelected = computed(() => canWrite.value && Boolean(selectedContentId.value))
const canSubmitSelected = computed(() => canWrite.value && Boolean(selectedContentId.value) && (!selectedStatus.value || selectedStatus.value === 'DRAFT' || selectedStatus.value === 'REJECTED'))
const canPublishSelected = computed(() => canPublish.value && Boolean(selectedContentId.value) && selectedStatus.value === 'APPROVED' && dualApprovalReady.value)
const canRollbackSelected = computed(() => canRollback.value && Boolean(selectedContentId.value) && selectedStatus.value === 'PUBLISHED')

function statusLabel(status: ContentStatus | string | null): string {
  const labels: Record<string, string> = { DRAFT: adminT('contentView.statusDraft'), IN_REVIEW: adminT('contentView.statusInReview'), APPROVED: adminT('contentView.statusApproved'), PUBLISHED: adminT('contentView.statusPublished'), ARCHIVED: adminT('contentView.statusArchived'), REJECTED: adminT('contentView.statusRejected'), ROLLBACK_PENDING: adminT('contentView.statusRollbackPending'), CONFLICT: adminT('contentView.statusConflict') }
  return status ? labels[status] ?? status : adminT('contentView.noContentSelected')
}

function statusTagType(status: ContentStatus | string | null): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'PUBLISHED' || status === 'APPROVED') return 'success'
  if (status === 'REJECTED' || status === 'CONFLICT') return 'danger'
  if (status === 'IN_REVIEW' || status === 'ROLLBACK_PENDING') return 'warning'
  return 'info'
}

function isBusy(action: string): boolean { return busyAction.value === action }

function isSelfReview(task: ReviewTaskProjection): boolean {
  const subject = session.principal?.subject
  return Boolean(subject && task.authorSubject && subject === task.authorSubject)
}

function canDecide(task: ReviewTaskProjection): boolean {
  return session.can(task.requiredPermission) && task.status === 'PENDING' && !isSelfReview(task)
}

function reviewActionHint(task: ReviewTaskProjection): string {
  if (isSelfReview(task)) return adminT('contentView.selfReviewForbidden')
  if (!session.can(task.requiredPermission)) return adminT('contentView.noStagePermission')
  if (task.status !== 'PENDING') return adminT('contentView.stageNotActionable')
  return task.stage === 'FINAL' ? adminT('contentView.stageFinal') : adminT('contentView.stageFirst')
}

function parsePayload(): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(payloadText.value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(adminT('contentView.payloadMustBeObject'))
    return parsed as Record<string, unknown>
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('contentView.payloadInvalidJson'))
    return null
  }
}

function applyContent(content: ContentSnapshot | null): void {
  if (!content) return
  selectedContentId.value = content.contentId
  contentCode.value = content.contentCode
  title.value = content.title
  versionId.value = content.versionId
  stateVersion.value = content.stateVersion
  if (!rollbackTargetVersion.value && content.publishedVersionId) rollbackTargetVersion.value = content.publishedVersionId
  dirty.value = false
}

function selectContent(content: ContentSnapshot): void {
  applyContent(content)
  lastError.value = null
  viewState.value = 'ready'
}

function handleError(error: unknown): void {
  const commandError = error instanceof ContentCommandError ? error : new ContentCommandError(error instanceof Error ? error.message : adminT('contentView.serviceUnavailable'), { retryable: true })
  lastError.value = commandError
  if (commandError.requestId) lastRequestId.value = commandError.requestId
  if (commandError.status === 403 || commandError.code === 'FORBIDDEN') viewState.value = 'permission'
  else if (commandError.status === 409 || commandError.code === 'CONTENT_CONFLICT') viewState.value = 'recovery'
  else viewState.value = commandError.retryable ? 'recovery' : 'error'
}

async function loadProjection(): Promise<void> {
  viewState.value = 'loading'
  lastError.value = null
  try {
    const projection = await contentServiceCommandAdapter.getWorkspaceProjection()
    contents.value = [...projection.contents]
    reviewTasks.value = [...projection.reviewTasks]
    lastRequestId.value = projection.requestId
    if (selectedContentId.value) {
      const refreshed = contents.value.find((content) => content.contentId === selectedContentId.value)
      if (refreshed) applyContent(refreshed)
    } else if (contents.value[0]) applyContent(contents.value[0])
    viewState.value = contents.value.length || reviewTasks.value.length ? 'ready' : 'empty'
  } catch (error) { handleError(error) }
}

async function runCommand(action: string, callback: () => Promise<void>): Promise<void> {
  busyAction.value = action
  lastError.value = null
  try { await callback(); viewState.value = 'ready' } catch (error) { handleError(error) } finally { busyAction.value = null }
}

async function createDraft(): Promise<void> {
  if (!canWrite.value) { viewState.value = 'permission'; return }
  const payload = parsePayload()
  if (!payload || !contentCode.value.trim() || !title.value.trim()) { ElMessage.error(adminT('contentView.draftRequiresCodeAndTitle')); return }
  await runCommand('create', async () => {
    const receipt = await contentServiceCommandAdapter.createDraft({ contentCode: contentCode.value.trim(), contentType: contentType.value.trim() || 'UNIT', title: title.value.trim(), contentHash: contentHash.value.trim(), sourceCode: sourceCode.value.trim(), licenseCode: licenseCode.value.trim(), payload })
    lastRequestId.value = receipt.requestId
    if (receipt.content) applyContent(receipt.content)
    ElMessage.success(adminT('contentView.draftCreated'))
    await loadProjection()
  })
}

async function saveDraft(): Promise<void> {
  if (!selectedContentId.value || !canEditSelected.value) { viewState.value = 'permission'; return }
  const payload = parsePayload()
  if (!payload) return
  await runCommand('save', async () => {
    const receipt = await contentServiceCommandAdapter.saveDraft(selectedContentId.value, { baseVersionId: versionId.value || undefined, baseStateVersion: stateVersion.value || undefined, title: title.value.trim(), contentHash: contentHash.value.trim(), payload })
    lastRequestId.value = receipt.requestId
    if (receipt.content) applyContent(receipt.content)
    dirty.value = false
    ElMessage.success(adminT('contentView.draftSaved'))
    await loadProjection()
  })
}

async function validateDraft(): Promise<void> {
  if (!selectedContentId.value || !canValidateSelected.value) { viewState.value = 'permission'; return }
  await runCommand('validate', async () => {
    const receipt = await contentServiceCommandAdapter.validateDraft(selectedContentId.value)
    lastRequestId.value = receipt.requestId
    ElMessage.success(adminT('contentView.validateDone'))
    await loadProjection()
  })
}

async function submitReview(): Promise<void> {
  if (!selectedContentId.value || !canSubmitSelected.value) { viewState.value = 'permission'; return }
  await runCommand('submit', async () => {
    const receipt = await contentServiceCommandAdapter.submitReview(selectedContentId.value)
    lastRequestId.value = receipt.requestId
    ElMessage.success(adminT('contentView.submittedForReview'))
    await loadProjection()
  })
}

async function decide(task: ReviewTaskProjection, decision: ReviewDecision): Promise<void> {
  if (!canDecide(task)) { viewState.value = isSelfReview(task) ? 'permission' : 'recovery'; return }
  try {
    await ElMessageBox.confirm(decision === 'APPROVED' ? adminT('contentView.confirmApproveBody') : adminT('contentView.confirmRejectBody'), task.stage === 'FINAL' ? adminT('contentView.confirmTitleFinal') : adminT('contentView.confirmTitleFirst'), { type: decision === 'APPROVED' ? 'info' : 'warning', confirmButtonText: adminT('contentView.confirmOk'), cancelButtonText: adminT('contentView.confirmCancel') })
  } catch { return }
  await runCommand(`review-${task.reviewTaskId}`, async () => {
    const receipt = await contentServiceCommandAdapter.decideReview(task.reviewTaskId, task.stage, decision)
    lastRequestId.value = receipt.requestId
    ElMessage.success(adminT('contentView.reviewDecided'))
    await loadProjection()
  })
}

async function publish(): Promise<void> {
  if (!selectedContentId.value || !canPublishSelected.value) { viewState.value = 'permission'; return }
  await runCommand('publish', async () => {
    const receipt = await contentServiceCommandAdapter.publish(selectedContentId.value)
    lastRequestId.value = receipt.requestId
    ElMessage.success(adminT('contentView.published'))
    await loadProjection()
  })
}

async function rollback(): Promise<void> {
  if (!selectedContentId.value || !canRollbackSelected.value) { viewState.value = 'permission'; return }
  if (!rollbackTargetVersion.value.trim() || !rollbackReason.value.trim()) { ElMessage.error(adminT('contentView.rollbackRequiresTargetAndReason')); return }
  await runCommand('rollback', async () => {
    const receipt = await contentServiceCommandAdapter.rollback(selectedContentId.value, { targetVersionId: rollbackTargetVersion.value.trim(), baseStateVersion: stateVersion.value || undefined, reason: rollbackReason.value.trim() })
    lastRequestId.value = receipt.requestId
    ElMessage.success(adminT('contentView.rollbackSubmitted'))
    await loadProjection()
  })
}

function markDirty(): void { dirty.value = true }
function retryAfterFailure(): void { void loadProjection() }
onMounted(() => { void loadProjection() })
</script>

<template>
  <div class="view-stack">
    <div class="view-intro">
      <div><span class="admin-header__eyebrow">B9 · CONTENT COMMANDS</span><h2>{{ adminT('contentView.heading') }}</h2><p>{{ adminT('contentView.intro') }}</p></div>
      <el-button :loading="viewState === 'loading'" @click="retryAfterFailure">{{ adminT('contentView.refresh') }}</el-button>
    </div>

    <el-alert v-if="viewState === 'permission'" :title="adminT('contentView.permissionTitle')" :description="adminT('contentView.permissionDesc')" type="warning" show-icon />
    <el-alert v-else-if="viewState === 'recovery'" :title="adminT('contentView.recoveryTitle')" :description="lastError?.code === 'CONTENT_CONFLICT' ? adminT('contentView.recoveryConflictDesc') : adminT('contentView.recoveryPendingDesc')" type="warning" show-icon />
    <el-alert v-else-if="viewState === 'error'" :title="adminT('contentView.errorTitle')" :description="lastError?.message ?? adminT('contentView.errorRetryFallback')" type="error" show-icon />

    <el-card v-if="viewState === 'loading'" shadow="never"><el-skeleton :rows="8" animated /></el-card>

    <template v-else>
      <el-card shadow="never">
        <template #header><div class="card-header"><span>{{ adminT('contentView.workspaceTitle') }}</span><el-space><el-tag v-if="selectedContent" :type="statusTagType(selectedStatus)">{{ statusLabel(selectedStatus) }}</el-tag><el-tag v-if="dirty" type="warning">{{ adminT('contentView.dirtyTag') }}</el-tag><el-tag v-if="lastRequestId" type="info" effect="plain">{{ adminT('contentView.requestIdTag') }}</el-tag></el-space></div></template>
        <el-form label-position="top">
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12" :md="8"><el-form-item :label="adminT('contentView.fieldCode')"><el-input v-model="contentCode" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
            <el-col :xs="24" :sm="12" :md="8"><el-form-item :label="adminT('contentView.fieldType')"><el-input v-model="contentType" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
            <el-col :xs="24" :sm="12" :md="8"><el-form-item :label="adminT('contentView.fieldTitle')"><el-input v-model="title" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
            <el-col :xs="24" :sm="12" :md="8"><el-form-item :label="adminT('contentView.fieldHash')"><el-input v-model="contentHash" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
            <el-col :xs="24" :sm="12" :md="8"><el-form-item :label="adminT('contentView.fieldSource')"><el-input v-model="sourceCode" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
            <el-col :xs="24" :sm="12" :md="8"><el-form-item :label="adminT('contentView.fieldLicense')"><el-input v-model="licenseCode" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
          </el-row>
          <el-form-item :label="adminT('contentView.fieldPayload')"><el-input v-model="payloadText" type="textarea" :rows="5" :disabled="!canWrite" @input="markDirty" /></el-form-item>
          <el-space wrap><el-button type="primary" :loading="isBusy('create')" :disabled="!canWrite" @click="createDraft">{{ adminT('contentView.createDraft') }}</el-button><el-button :loading="isBusy('save')" :disabled="!selectedContentId || !canEditSelected" @click="saveDraft">{{ adminT('contentView.saveDraft') }}</el-button><el-button :loading="isBusy('validate')" :disabled="!canValidateSelected" @click="validateDraft">{{ adminT('contentView.validate') }}</el-button><el-button :loading="isBusy('submit')" :disabled="!canSubmitSelected" @click="submitReview">{{ adminT('contentView.submitReview') }}</el-button><el-button type="success" plain :loading="isBusy('publish')" :disabled="!canPublishSelected" @click="publish">{{ adminT('contentView.publish') }}</el-button></el-space>
          <el-text v-if="selectedContent" type="info" class="content-command-note">{{ adminT('contentView.versionNote', { version: selectedContent.versionId || adminT('contentView.versionPending'), status: statusLabel(selectedStatus), stateVersion: stateVersion || adminT('contentView.stateVersionPending') }) }}</el-text><el-text v-else type="info" class="content-command-note">{{ adminT('contentView.noSelectionNote') }}</el-text>
        </el-form>
      </el-card>

      <el-card shadow="never"><template #header><div class="card-header"><span>{{ adminT('contentView.projectionTitle') }}</span><el-tag>{{ adminT('contentView.projectionCount', { count: contents.length }) }}</el-tag></div></template><el-empty v-if="!contents.length" :description="adminT('contentView.projectionEmpty')" /><el-table v-else :data="contents" stripe @row-click="selectContent"><el-table-column prop="contentCode" :label="adminT('contentView.colCode')" min-width="180" /><el-table-column prop="title" :label="adminT('contentView.colTitle')" min-width="220" /><el-table-column :label="adminT('contentView.colStatus')" width="120"><template #default="scope"><el-tag :type="statusTagType(scope.row.status)">{{ statusLabel(scope.row.status) }}</el-tag></template></el-table-column><el-table-column prop="versionId" :label="adminT('contentView.colVersion')" min-width="180" /><el-table-column :label="adminT('contentView.colActions')" width="100"><template #default="scope"><el-button link type="primary" @click.stop="selectContent(scope.row)">{{ adminT('contentView.openRow') }}</el-button></template></el-table-column></el-table></el-card>

      <el-card shadow="never"><template #header><div class="card-header"><span>{{ adminT('contentView.reviewTitle') }}</span><el-tag>{{ adminT('contentView.reviewCount', { count: reviewTasks.length }) }}</el-tag></div></template><el-empty v-if="!reviewTasks.length" :description="adminT('contentView.reviewEmpty')" /><el-table v-else :data="reviewTasks" stripe><el-table-column prop="reviewTaskId" :label="adminT('contentView.colTask')" min-width="210" /><el-table-column prop="contentId" :label="adminT('contentView.colContent')" min-width="170" /><el-table-column :label="adminT('contentView.colStage')" width="100"><template #default="scope">{{ scope.row.stage === 'FINAL' ? adminT('contentView.nodeFinal') : adminT('contentView.nodeFirst') }}</template></el-table-column><el-table-column prop="status" :label="adminT('contentView.colStatus')" width="120" /><el-table-column :label="adminT('contentView.colSeparation')" min-width="210"><template #default="scope"><span :title="reviewActionHint(scope.row)">{{ reviewActionHint(scope.row) }}</span></template></el-table-column><el-table-column :label="adminT('contentView.colAction')" width="210"><template #default="scope"><el-button size="small" type="success" :disabled="!canDecide(scope.row)" @click="decide(scope.row, 'APPROVED')">{{ adminT('contentView.approve') }}</el-button><el-button size="small" type="danger" plain :disabled="!canDecide(scope.row)" @click="decide(scope.row, 'REJECTED')">{{ adminT('contentView.reject') }}</el-button></template></el-table-column></el-table></el-card>

      <el-card shadow="never"><template #header><div class="card-header"><span>{{ adminT('contentView.rollbackTitle') }}</span><el-tag :type="dualApprovalReady ? 'success' : 'warning'">{{ dualApprovalReady ? adminT('contentView.rollbackReady') : adminT('contentView.rollbackWaiting') }}</el-tag></div></template><el-form label-position="top"><el-row :gutter="16"><el-col :xs="24" :md="8"><el-form-item :label="adminT('contentView.rollbackTargetLabel')"><el-input v-model="rollbackTargetVersion" :disabled="!canRollbackSelected" :placeholder="adminT('contentView.rollbackTargetPlaceholder')" /></el-form-item></el-col><el-col :xs="24" :md="10"><el-form-item :label="adminT('contentView.rollbackReasonLabel')"><el-input v-model="rollbackReason" :disabled="!canRollbackSelected" :placeholder="adminT('contentView.rollbackReasonPlaceholder')" /></el-form-item></el-col><el-col :xs="24" :md="6" class="rollback-action"><el-button type="warning" plain :loading="isBusy('rollback')" :disabled="!canRollbackSelected" @click="rollback">{{ adminT('contentView.submitRollback') }}</el-button></el-col></el-row></el-form><el-text v-if="selectedStatus === 'PUBLISHED'" type="warning">{{ adminT('contentView.rollbackNote') }}</el-text></el-card>

      <el-alert v-if="lastError?.status === 409" :title="adminT('contentView.conflictKeptTitle')" :description="adminT('contentView.conflictKeptDesc')" type="error" show-icon /><el-alert v-if="viewState === 'empty'" :title="adminT('contentView.emptyTitle')" :description="adminT('contentView.emptyDesc')" type="info" show-icon />
    </template>
  </div>
</template>
