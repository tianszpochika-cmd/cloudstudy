export const PUBLIC_STATES = Object.freeze([
  'ready',
  'loading',
  'empty',
  'error',
  'download-disabled',
])

// Keep the B7 list stable for existing consumers while allowing B13 to expose
// operational and access states without treating them as successful content.
export const PUBLIC_EXTENDED_STATES = Object.freeze([
  ...PUBLIC_STATES,
  'permission',
  'recovery',
  'maintenance',
])

export const V2_UI_STATES = Object.freeze(['loading', 'empty', 'error', 'permission', 'recovery', 'offline', 'success', 'partial'])

export function toPublicUiState(value) {
  if (value === 'success') return 'success'
  if (value === 'offline') return 'offline'
  if (value === 'partial') return 'partial'
  const candidate = resolvePublicState(value)
  if (candidate === 'ready') return 'success'
  if (candidate === 'download-disabled' || candidate === 'maintenance') return 'partial'
  if (candidate === 'recovery') return 'recovery'
  return candidate === 'permission' ? 'permission' : candidate
}

const stateMeta = Object.freeze({
  ready: {
    role: 'status',
    icon: '✓',
    title: '内容已准备好',
    message: '你可以继续浏览公开内容。',
    actionLabel: '',
  },
  loading: {
    role: 'status',
    icon: '…',
    title: '正在准备内容',
    message: '请稍候，我们正在整理最新的公开信息。',
    actionLabel: '',
  },
  empty: {
    role: 'status',
    icon: '○',
    title: '暂时没有公开内容',
    message: '这部分内容还在准备中，你可以先浏览其他公开页面。',
    actionLabel: '浏览课程',
  },
  error: {
    role: 'alert',
    icon: '!',
    title: '公开内容暂时不可用',
    message: '请稍后重试；官网不会替你提交学习、订单或其他登录后操作。',
    actionLabel: '重新查看',
  },
  'download-disabled': {
    role: 'status',
    icon: '↓',
    title: '下载渠道暂未开放',
    message: 'App 下载正在准备中，你仍可以先使用学习 Web 体验公开入口。',
    actionLabel: '打开学习 Web',
  },
  permission: {
    role: 'alert',
    icon: '⌁',
    title: '公开内容暂不可访问',
    message: '当前公开投影需要稍后重新访问；官网不会绕过权限或替你执行登录后操作。',
    actionLabel: '返回首页',
  },
  recovery: {
    role: 'status',
    icon: '↻',
    title: '公开内容正在恢复',
    message: '我们暂时展示可用的公开边界，价格和资格以恢复后的服务端投影为准。',
    actionLabel: '重新查看',
  },
  maintenance: {
    role: 'status',
    icon: '⋯',
    title: '公开服务维护中',
    message: '价格、活动或下载投影正在维护；维护期间不会创建订单、支付或权益事实。',
    actionLabel: '重新查看',
  },
  success: {
    role: 'status',
    icon: '✓',
    title: '内容已准备好',
    message: '你可以继续浏览公开内容。',
    actionLabel: '',
  },
  offline: {
    role: 'status',
    icon: '⌁',
    title: '公开服务暂时离线',
    message: '官网不会创建订单、支付或登录后业务事实。',
    actionLabel: '重新查看',
  },
  partial: {
    role: 'status',
    icon: '◐',
    title: '部分公开内容可用',
    message: '未准备好的价格、下载或活动信息不会被客户端猜测。',
    actionLabel: '重新查看',
  },
})

export function resolvePublicState(value) {
  const candidate = Array.isArray(value) ? value[0] : value
  return PUBLIC_EXTENDED_STATES.includes(candidate) ? candidate : 'ready'
}

export function resolvePublicPageState(previewState, projectionState, hasData) {
  const preview = resolvePublicState(previewState)
  if (preview !== 'ready') return preview
  const projection = resolvePublicState(projectionState)
  if (projection !== 'ready') return projection
  return hasData ? 'ready' : 'empty'
}

export function getPublicStateMeta(state) {
  const key = V2_UI_STATES.includes(state) ? state : resolvePublicState(state)
  return stateMeta[key]
}
