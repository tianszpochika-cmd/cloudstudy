import type { MessageTree } from '@englishflow/i18n'

/**
 * Batch C admin UI messages (B4-09 hardcoded-CJK extraction).
 *
 * Trees are keyed per source file and registered under `admin.*` by the
 * integrator (e.g. `registerMessages('zh-CN', { admin: batchCZh })`), so
 * views call `adminT('<ns>.<key>')`. `zh-CN` and `en-US` hold identical
 * key sets by construction.
 */
export const batchCZh: MessageTree = {
  schedule: {
    listLoadFailed: '排期列表读取失败。',
    invalidTimeFormat: '排期时间格式不正确。',
    selectTarget: '请选择排期对象。',
    fillTime: '请填写排期时间。',
    createSuccess: '排期已创建，到期自动执行并复核版本。',
    createFailed: '排期创建失败。',
    confirmCancelMessage: '确认取消 {{targetRef}} 的排期？',
    confirmCancelTitle: '取消排期',
    confirmButtonText: '确认',
    cancelButtonText: '返回',
    cancelSuccess: '排期已取消。',
    cancelFailed: '取消失败。',
    panelTitle: '定时排期',
    refresh: '刷新',
    colTarget: '对象',
    colType: '类型',
    colRunAt: '执行时间',
    colStatus: '状态',
    colCohort: '灰度群',
    colFailureReason: '失败原因',
    colAction: '动作',
    cancelAction: '取消',
    emptyText: '暂无排期任务',
    newSectionTitle: '新建排期',
    selectTargetPlaceholder: '选择对象',
    reasonPlaceholder: '原因',
    cohortPlaceholder: '灰度群(可选)',
    createAction: '创建排期',
    versionHint: '执行时复核版本：若对象版本已变化，任务失败而不发布错误版本。',
  },
  localeSwitcher: {
    zh: '中文',
    en: 'English',
    fr: 'Français（骨架）',
    de: 'Deutsch（骨架）',
    ariaLabel: '界面语言：{{label}}（内容语言 {{contentLocale}} 不变）',
    iconMark: '文',
  },
  audioPreview: {
    loadFailed: '预览加载失败。',
    loadAction: '加载预览',
  },
  apiLearner360: {
    searchFailed: '学员检索失败。',
    profileFailed: '学员画像读取失败。',
    plansFailed: '学习计划读取失败。',
    srsFailed: 'SRS 队列读取失败。',
    assessmentsFailed: '测评摘要读取失败。',
    commandFailed: '学员命令提交失败。',
  },
  apiContentItems: {
    commandFailed: '条目命令提交失败。',
    importFailed: '批量导入提交失败。',
  },
  apiLexeme: {
    commandFailed: '单词命令提交失败。',
  },
  apiPhonetics: {
    gatewayPending: '音标网关通道尚未开通（待 M3/M4 路由裁决），当前无法加载。',
    channelUnreachable: '音标通道不可达：网关未放行 /phonetics/*（待 M3/M4 路由裁决）或后端未运行。',
    loadFailed: '音标库读取失败。',
  },
  apiMediaPreview: {
    emptyUrl: '预览地址为空，检查资产是否存在。',
    fetchFailed: '预览地址获取失败。',
    downloadFailed: '音频下载失败（HTTP {{status}}）。',
  },
  apiCommandAdapter: {
    serviceUnavailable: '内容服务暂时不可用。',
    stateVersionRequired: '缺少有效的服务端状态版本，请刷新内容投影后重试。',
    hashInvalid: '内容 hash 必须是 64 位 SHA-256；不会由前端伪造版权事实。',
    projectionStale: '内容投影已过期，请刷新后重试。',
    rightsContextRequired: '当前投影缺少版权来源，不能在前端补写或伪造；请回到内容导入流程。',
    reviewTaskStale: '审核任务投影已过期，请刷新后重试。',
    rollbackTargetInvalid: '回滚目标必须是服务端返回的数字版本号。',
  },
  apiClient: {
    requestFailed: '请求失败（HTTP {{status}}）',
  },
  gatewayAuth: {
    invalidSession: '认证服务没有返回有效管理员会话。',
  },
  domainB12: {
    maskedTargetRef: '服务端脱敏引用',
  },
  storeB12: {
    noGovernanceRead: '当前会话没有治理读取权限。',
    loadFailed: '治理数据读取失败。',
    noModerationCommand: '当前会话没有举报命令权限。',
    commandConfirmed: '服务端命令已确认。',
    moderationCommandFailed: '举报命令未完成。',
    noRecoveryCommand: '当前会话没有恢复命令权限。',
    recoveryCommandFailed: '恢复命令未完成。',
  },
  storeAdmin: {
    deviceName: '管理后台浏览器',
    missingCredential: '认证服务没有返回访问凭证。',
  },
  main: {
    routerRestoreFailed: '[语学星 Admin] 初始路由恢复失败。',
  },
}

export const batchCEn: MessageTree = {
  schedule: {
    listLoadFailed: 'Failed to load the schedule list.',
    invalidTimeFormat: 'The scheduled time format is invalid.',
    selectTarget: 'Select a schedule target.',
    fillTime: 'Enter the scheduled time.',
    createSuccess: 'Schedule created. It runs automatically on time after a version check.',
    createFailed: 'Failed to create the schedule.',
    confirmCancelMessage: 'Confirm cancelling the schedule for {{targetRef}}?',
    confirmCancelTitle: 'Cancel schedule',
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Back',
    cancelSuccess: 'The schedule was cancelled.',
    cancelFailed: 'Failed to cancel.',
    panelTitle: 'Scheduled publishing',
    refresh: 'Refresh',
    colTarget: 'Target',
    colType: 'Type',
    colRunAt: 'Run at',
    colStatus: 'Status',
    colCohort: 'Cohort',
    colFailureReason: 'Failure reason',
    colAction: 'Actions',
    cancelAction: 'Cancel',
    emptyText: 'No scheduled tasks',
    newSectionTitle: 'New schedule',
    selectTargetPlaceholder: 'Select a target',
    reasonPlaceholder: 'Reason',
    cohortPlaceholder: 'Cohort (optional)',
    createAction: 'Create schedule',
    versionHint: 'Versions are rechecked at run time: if the target version changed, the task fails instead of publishing the wrong version.',
  },
  localeSwitcher: {
    zh: 'Chinese',
    en: 'English',
    fr: 'Français (skeleton)',
    de: 'Deutsch (skeleton)',
    ariaLabel: 'UI language: {{label}} (content language {{contentLocale}} unchanged)',
    iconMark: 'A',
  },
  audioPreview: {
    loadFailed: 'Failed to load the preview.',
    loadAction: 'Load preview',
  },
  apiLearner360: {
    searchFailed: 'Learner search failed.',
    profileFailed: 'Failed to load the learner profile.',
    plansFailed: 'Failed to load learning plans.',
    srsFailed: 'Failed to load the SRS queue.',
    assessmentsFailed: 'Failed to load the assessment summary.',
    commandFailed: 'Failed to submit the learner command.',
  },
  apiContentItems: {
    commandFailed: 'Failed to submit the item command.',
    importFailed: 'Failed to submit the batch import.',
  },
  apiLexeme: {
    commandFailed: 'Failed to submit the lexeme command.',
  },
  apiPhonetics: {
    gatewayPending: 'The phonetics gateway channel is not open yet (pending the M3/M4 routing decision); content cannot be loaded.',
    channelUnreachable: 'The phonetics channel is unreachable: the gateway has not opened /phonetics/* (pending the M3/M4 routing decision) or the backend is not running.',
    loadFailed: 'Failed to load the phonetics catalog.',
  },
  apiMediaPreview: {
    emptyUrl: 'The preview URL is empty. Check whether the asset exists.',
    fetchFailed: 'Failed to get the preview URL.',
    downloadFailed: 'Audio download failed (HTTP {{status}}).',
  },
  apiCommandAdapter: {
    serviceUnavailable: 'The content service is temporarily unavailable.',
    stateVersionRequired: 'A valid server state version is missing. Refresh the content projection and retry.',
    hashInvalid: 'The content hash must be a 64-character SHA-256 value; rights facts are never forged by the client.',
    projectionStale: 'The content projection expired. Refresh and retry.',
    rightsContextRequired: 'The current projection lacks rights provenance, which cannot be filled in or forged on the client. Return to the content import flow.',
    reviewTaskStale: 'The review task projection expired. Refresh and retry.',
    rollbackTargetInvalid: 'The rollback target must be a numeric version returned by the server.',
  },
  apiClient: {
    requestFailed: 'Request failed (HTTP {{status}})',
  },
  gatewayAuth: {
    invalidSession: 'The auth service did not return a valid administrator session.',
  },
  domainB12: {
    maskedTargetRef: 'Server redacted reference',
  },
  storeB12: {
    noGovernanceRead: 'The current session has no governance read permission.',
    loadFailed: 'Failed to load governance data.',
    noModerationCommand: 'The current session has no moderation command permission.',
    commandConfirmed: 'The server confirmed the command.',
    moderationCommandFailed: 'The moderation command did not complete.',
    noRecoveryCommand: 'The current session has no recovery command permission.',
    recoveryCommandFailed: 'The recovery command did not complete.',
  },
  storeAdmin: {
    deviceName: 'Admin console browser',
    missingCredential: 'The auth service did not return an access credential.',
  },
  main: {
    routerRestoreFailed: '[Yuxuexing Admin] Failed to restore the initial route.',
  },
}
