import { MobileApiError } from '../api/client'

export function b11ErrorText(error: unknown, fallback: string): string {
  if (error instanceof MobileApiError) {
    if (error.status === 403) return '当前会话没有访问权限。'
    if (error.status === 404 || error.status === 410) return '内容版本或播放授权已失效，请重新读取。'
    if (error.status === 0) return '网络暂时不可用；当前页面和待同步队列仍保留。'
  }
  return error instanceof Error && error.message ? error.message : fallback
}
