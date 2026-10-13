export type ReleaseMode = 'SIMPLE' | 'DUAL'
export type DashboardState = 'ZERO' | 'EMPTY' | 'COMPUTING' | 'FAILED' | 'READY'

export function defaultMode(): ReleaseMode {
  return 'SIMPLE'
}

export function modeCopy(mode: ReleaseMode): string {
  return mode === 'DUAL'
    ? '当前审核模式：双签。初审和终审必须是两个不同的人，发布者也不能是编辑或审核人。'
    : '当前审核模式：简审。一个人可以发布，并留下可撤销的记录。这里没有第二审签名。'
}

export function denialCopy(): string {
  return '没有内容权限。请回到有权页面。这里不会改用别的入口绕过。'
}

export function gapCopy(field: string): string {
  if (field === 'copyright') return '版权还没有绑定到这个版本'
  if (field === 'reviewReport') return '审核报告还没有绑定到这个版本和当前模式'
  if (field === 'media') return '必要媒体的对象字节还没有接上'
  return '还有一项没有准备好'
}

export function catalogCopy(state: string): string {
  if (state === 'PUBLISHING') return '发布事实已写入，目录还在同步。学习端现在还看不到。'
  if (state === 'PUBLISHED') return '目录已同步，学习端可以读取这一版。'
  if (state === 'SYNC_FAILED') return '目录同步失败。学习端不会把未同步的版本当成已可见。'
  if (state === 'UNPUBLISHED') return '已普通下架。目录不再发放这一版。在学中的旧版仍可收尾。'
  if (state === 'FORCE_OFFLINE') return '已强制停止分发。旧会话和媒体也不能继续。'
  return '还没有目录投影。'
}

export function pinCopy(version: number): string {
  return `你正在学习的是已锁定的第 ${version} 版。新版本不会替换这一版。`
}

export function loginFailureCopy(): string {
  return '账号或密码不正确。这里不会说明账号是否存在。'
}

export function loginReturn(requested: string, allowed: string[]): string {
  const safe = requested.split('?')[0]
  if (safe && allowed.includes(safe)) return safe
  return allowed.find((path) => path !== '/content') ?? '/forbidden'
}

export function dashboardMetric(state: DashboardState, value: number | null): { state: DashboardState; value: number | null; text: string } {
  if (state === 'ZERO') return { state, value: 0, text: '实测为零' }
  if (state === 'EMPTY') return { state, value: null, text: '暂无' }
  if (state === 'COMPUTING') return { state, value: null, text: '计算中' }
  if (state === 'FAILED') return { state, value: null, text: '读取失败' }
  return { state: 'READY', value, text: '已读取' }
}

export function permissionPage(): {
  readOnly: boolean
  writeActions: string[]
  copy: string
  writeCopy: string
} {
  return {
    readOnly: false,
    writeActions: ['submit', 'approve', 'activate'],
    copy: '策略版本可查看。有 iam.policy.submit / approve / activate 权限时，可以送审、审批或激活；没有权限时回到有权页面，不会要求重新登录来绕过。',
    writeCopy: '权限变更必须走草稿 → 送审 → 他人审批 → 激活。作者不能审批自己的版本。',
  }
}

export function mediaBoundary(bytesConnected: boolean, mediaRequired: boolean): { publishable: boolean; copy: string } {
  if (!bytesConnected && mediaRequired) {
    return { publishable: false, copy: '对象字节还没有接上。现在不能把这份内容显示成可发布。' }
  }
  if (!bytesConnected) {
    return { publishable: true, copy: '对象字节还没有接上。这份内容不依赖媒体，也不会显示上传进度。' }
  }
  return { publishable: true, copy: '媒体字节已连接。' }
}

export function b3ReplayCopy(): string {
  return '113+2 是一次性历史下线口径。当前库没有这批已发布行，不能再执行一遍来冒充下线。'
}

export function shelfNote(items: Array<{ summary?: string; description?: string }>): string {
  for (const item of items) {
    const text = `${item.summary ?? ''} ${item.description ?? ''}`.trim()
    if (text.includes('已锁定')) return text
  }
  return ''
}

export function learnerAuthoringActions(): string[] {
  return []
}
