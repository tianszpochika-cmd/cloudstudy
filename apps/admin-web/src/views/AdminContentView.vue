<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
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
  const labels: Record<string, string> = { DRAFT: '草稿', IN_REVIEW: '审核中', APPROVED: '双审通过', PUBLISHED: '已发布', ARCHIVED: '已归档', REJECTED: '已退回', ROLLBACK_PENDING: '回滚处理中', CONFLICT: '版本冲突' }
  return status ? labels[status] ?? status : '尚未选择内容'
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
  if (isSelfReview(task)) return '作者不能审核自己的版本'
  if (!session.can(task.requiredPermission)) return '当前会话没有该审核节点的服务端权限'
  if (task.status !== 'PENDING') return '该审核节点已经完成或不可重复操作'
  return task.stage === 'FINAL' ? '二级审核' : '一级审核'
}

function parsePayload(): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(payloadText.value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('内容 payload 必须是 JSON 对象。')
    return parsed as Record<string, unknown>
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '内容 payload 不是有效 JSON。')
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
  const commandError = error instanceof ContentCommandError ? error : new ContentCommandError(error instanceof Error ? error.message : '内容服务暂时不可用。', { retryable: true })
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
  if (!payload || !contentCode.value.trim() || !title.value.trim()) { ElMessage.error('请填写内容编码和标题。'); return }
  await runCommand('create', async () => {
    const receipt = await contentServiceCommandAdapter.createDraft({ contentCode: contentCode.value.trim(), contentType: contentType.value.trim() || 'UNIT', title: title.value.trim(), contentHash: contentHash.value.trim(), sourceCode: sourceCode.value.trim(), licenseCode: licenseCode.value.trim(), payload })
    lastRequestId.value = receipt.requestId
    if (receipt.content) applyContent(receipt.content)
    ElMessage.success('草稿命令已提交，内容事实由 content-service 返回确认。')
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
    ElMessage.success('草稿已保存并收到服务端版本确认。')
    await loadProjection()
  })
}

async function validateDraft(): Promise<void> {
  if (!selectedContentId.value || !canValidateSelected.value) { viewState.value = 'permission'; return }
  await runCommand('validate', async () => {
    const receipt = await contentServiceCommandAdapter.validateDraft(selectedContentId.value)
    lastRequestId.value = receipt.requestId
    ElMessage.success('结构校验命令已完成。')
    await loadProjection()
  })
}

async function submitReview(): Promise<void> {
  if (!selectedContentId.value || !canSubmitSelected.value) { viewState.value = 'permission'; return }
  await runCommand('submit', async () => {
    const receipt = await contentServiceCommandAdapter.submitReview(selectedContentId.value)
    lastRequestId.value = receipt.requestId
    ElMessage.success('内容已提交双审队列，等待服务端分配审核节点。')
    await loadProjection()
  })
}

async function decide(task: ReviewTaskProjection, decision: ReviewDecision): Promise<void> {
  if (!canDecide(task)) { viewState.value = isSelfReview(task) ? 'permission' : 'recovery'; return }
  try {
    await ElMessageBox.confirm(decision === 'APPROVED' ? '确认通过当前审核节点？发布仍需一级和二级审核均完成。' : '确认退回当前内容版本？', task.stage === 'FINAL' ? '二级审核确认' : '一级审核确认', { type: decision === 'APPROVED' ? 'info' : 'warning', confirmButtonText: '确认', cancelButtonText: '取消' })
  } catch { return }
  await runCommand(`review-${task.reviewTaskId}`, async () => {
    const receipt = await contentServiceCommandAdapter.decideReview(task.reviewTaskId, task.stage, decision)
    lastRequestId.value = receipt.requestId
    ElMessage.success('审核命令已提交并保留审计关联。')
    await loadProjection()
  })
}

async function publish(): Promise<void> {
  if (!selectedContentId.value || !canPublishSelected.value) { viewState.value = 'permission'; return }
  await runCommand('publish', async () => {
    const receipt = await contentServiceCommandAdapter.publish(selectedContentId.value)
    lastRequestId.value = receipt.requestId
    ElMessage.success('发布命令已提交；公开投影将在服务端发布后更新。')
    await loadProjection()
  })
}

async function rollback(): Promise<void> {
  if (!selectedContentId.value || !canRollbackSelected.value) { viewState.value = 'permission'; return }
  if (!rollbackTargetVersion.value.trim() || !rollbackReason.value.trim()) { ElMessage.error('回滚需要目标版本和原因。'); return }
  await runCommand('rollback', async () => {
    const receipt = await contentServiceCommandAdapter.rollback(selectedContentId.value, { targetVersionId: rollbackTargetVersion.value.trim(), baseStateVersion: stateVersion.value || undefined, reason: rollbackReason.value.trim() })
    lastRequestId.value = receipt.requestId
    ElMessage.success('回滚命令已提交，状态会在服务端完成后刷新。')
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
      <div><span class="admin-header__eyebrow">B9 · CONTENT COMMANDS</span><h2>内容编辑、双审、发布与回滚。</h2><p>页面只读取 admin-ops 投影并通过 content-service 命令端口提交操作；权限、作者、租户和发布状态以服务端事实为准。</p></div>
      <el-button :loading="viewState === 'loading'" @click="retryAfterFailure">刷新投影</el-button>
    </div>

    <el-alert v-if="viewState === 'permission'" title="当前会话无权执行此内容操作" description="服务端权限快照拒绝了当前动作。客户端不会使用角色、租户或作者字段自行放行；请返回有权页面或联系管理员。" type="warning" show-icon />
    <el-alert v-else-if="viewState === 'recovery'" title="内容操作需要恢复" :description="lastError?.code === 'CONTENT_CONFLICT' ? '检测到版本冲突，已保留本地编辑内容。请刷新服务端投影后重新选择基线版本，不会静默覆盖草稿。' : '服务暂时没有确认该命令。可安全重试，已填写的内容仍保留在当前页面。'" type="warning" show-icon />
    <el-alert v-else-if="viewState === 'error'" title="内容服务暂时不可用" :description="lastError?.message ?? '请稍后重试。'" type="error" show-icon />

    <el-card v-if="viewState === 'loading'" shadow="never"><el-skeleton :rows="8" animated /></el-card>

    <template v-else>
      <el-card shadow="never">
        <template #header><div class="card-header"><span>内容命令工作区</span><el-space><el-tag v-if="selectedContent" :type="statusTagType(selectedStatus)">{{ statusLabel(selectedStatus) }}</el-tag><el-tag v-if="dirty" type="warning">本地有未保存编辑</el-tag><el-tag v-if="lastRequestId" type="info" effect="plain">requestId 已关联</el-tag></el-space></div></template>
        <el-form label-position="top">
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12" :md="8"><el-form-item label="内容编码"><el-input v-model="contentCode" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
            <el-col :xs="24" :sm="12" :md="8"><el-form-item label="内容类型"><el-input v-model="contentType" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
            <el-col :xs="24" :sm="12" :md="8"><el-form-item label="标题"><el-input v-model="title" :disabled="!canEditSelected && Boolean(selectedContentId)" @input="markDirty" /></el-form-item></el-col>
            <el-col :xs="24" :sm="12" :md="8"><el-form-item label="内容 hash"><el-input v-model="contentHash" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
            <el-col :xs="24" :sm="12" :md="8"><el-form-item label="来源编码"><el-input v-model="sourceCode" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
            <el-col :xs="24" :sm="12" :md="8"><el-form-item label="版权编码"><el-input v-model="licenseCode" :disabled="!canWrite" @input="markDirty" /></el-form-item></el-col>
          </el-row>
          <el-form-item label="内容 payload（仅提交给 content-service，不在页面写入事实表）"><el-input v-model="payloadText" type="textarea" :rows="5" :disabled="!canEditSelected && Boolean(selectedContentId)" @input="markDirty" /></el-form-item>
          <el-space wrap><el-button type="primary" :loading="isBusy('create')" :disabled="!canWrite" @click="createDraft">创建草稿命令</el-button><el-button :loading="isBusy('save')" :disabled="!selectedContentId || !canEditSelected" @click="saveDraft">保存草稿</el-button><el-button :loading="isBusy('validate')" :disabled="!canValidateSelected" @click="validateDraft">结构校验</el-button><el-button :loading="isBusy('submit')" :disabled="!canSubmitSelected" @click="submitReview">提交双审</el-button><el-button type="success" plain :loading="isBusy('publish')" :disabled="!canPublishSelected" @click="publish">发布</el-button></el-space>
          <el-text v-if="selectedContent" type="info" class="content-command-note">当前版本 {{ selectedContent.versionId || '待服务端分配' }} · 状态 {{ statusLabel(selectedStatus) }} · 服务端状态版本 {{ stateVersion || '待返回' }}</el-text><el-text v-else type="info" class="content-command-note">尚未选择服务端内容投影；创建草稿后继续。</el-text>
        </el-form>
      </el-card>

      <el-card shadow="never"><template #header><div class="card-header"><span>内容投影</span><el-tag>{{ contents.length }} 条</el-tag></div></template><el-empty v-if="!contents.length" description="暂时没有可展示的内容投影；权限拒绝与服务错误已单独呈现。" /><el-table v-else :data="contents" stripe @row-click="selectContent"><el-table-column prop="contentCode" label="编码" min-width="180" /><el-table-column prop="title" label="标题" min-width="220" /><el-table-column label="状态" width="120"><template #default="scope"><el-tag :type="statusTagType(scope.row.status)">{{ statusLabel(scope.row.status) }}</el-tag></template></el-table-column><el-table-column prop="versionId" label="版本" min-width="180" /><el-table-column label="操作" width="100"><template #default="scope"><el-button link type="primary" @click.stop="selectContent(scope.row)">打开</el-button></template></el-table-column></el-table></el-card>

      <el-card shadow="never"><template #header><div class="card-header"><span>双审任务</span><el-tag>{{ reviewTasks.length }} 条</el-tag></div></template><el-empty v-if="!reviewTasks.length" description="当前没有待处理审核任务。" /><el-table v-else :data="reviewTasks" stripe><el-table-column prop="reviewTaskId" label="任务" min-width="210" /><el-table-column prop="contentId" label="内容" min-width="170" /><el-table-column label="节点" width="100"><template #default="scope">{{ scope.row.stage === 'FINAL' ? '二级' : '一级' }}</template></el-table-column><el-table-column prop="status" label="状态" width="120" /><el-table-column label="职责隔离" min-width="210"><template #default="scope"><span :title="reviewActionHint(scope.row)">{{ reviewActionHint(scope.row) }}</span></template></el-table-column><el-table-column label="动作" width="210"><template #default="scope"><el-button size="small" type="success" :disabled="!canDecide(scope.row)" @click="decide(scope.row, 'APPROVED')">通过</el-button><el-button size="small" type="danger" plain :disabled="!canDecide(scope.row)" @click="decide(scope.row, 'REJECTED')">退回</el-button></template></el-table-column></el-table></el-card>

      <el-card shadow="never"><template #header><div class="card-header"><span>发布回滚</span><el-tag :type="dualApprovalReady ? 'success' : 'warning'">{{ dualApprovalReady ? '双审已完成' : '等待一级与二级审核' }}</el-tag></div></template><el-form label-position="top"><el-row :gutter="16"><el-col :xs="24" :md="8"><el-form-item label="目标已发布版本"><el-input v-model="rollbackTargetVersion" :disabled="!canRollbackSelected" placeholder="由服务端投影提供" /></el-form-item></el-col><el-col :xs="24" :md="10"><el-form-item label="回滚原因"><el-input v-model="rollbackReason" :disabled="!canRollbackSelected" placeholder="必填，写入服务端审计" /></el-form-item></el-col><el-col :xs="24" :md="6" class="rollback-action"><el-button type="warning" plain :loading="isBusy('rollback')" :disabled="!canRollbackSelected" @click="rollback">提交回滚命令</el-button></el-col></el-row></el-form><el-text v-if="selectedStatus === 'PUBLISHED'" type="warning">回滚只切换 content-service 的发布指针；页面不会复制或直接改写内容事实。</el-text></el-card>

      <el-alert v-if="lastError?.status === 409" title="版本冲突已保留" description="请使用刷新投影读取最新状态，确认基线版本后再保存；本地输入不会被自动覆盖。" type="error" show-icon /><el-alert v-if="viewState === 'empty'" title="暂无内容工作项" description="当前服务端没有返回可展示的内容或审核投影。若你预期应有数据，请检查权限或稍后重试。" type="info" show-icon />
    </template>
  </div>
</template>
