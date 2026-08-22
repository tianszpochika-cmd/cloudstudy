import { getUniRuntime, type UniRuntime, type UniSecureRecordingVault } from './uni-runtime'
import { hashB11Payload } from './b11-offline'
import type { B11PermissionStatus } from '../domain/b11'

export interface B11RecorderResult { duration?: number; tempFilePath?: string }
export interface B11RecorderManager {
  start(options?: { duration?: number }): void
  stop(): void
  onStart(callback: () => void): void
  onStop(callback: (result: B11RecorderResult) => void): void
  onError(callback: (error: unknown) => void): void
}
export type B11RecorderRuntime = UniRuntime & {
  getRecorderManager?: () => B11RecorderManager
  authorize?: (options: { scope: string; success?: () => void; fail?: (error: unknown) => void }) => void
  openSetting?: (options?: { success?: () => void; fail?: (error: unknown) => void }) => void
}

function runtime(): B11RecorderRuntime { return getUniRuntime() as B11RecorderRuntime }

export async function requestMicrophonePermission(): Promise<B11PermissionStatus> {
  try {
    const current = runtime()
    if (current.authorize) {
      return await new Promise<B11PermissionStatus>((resolve) => {
        current.authorize?.({ scope: 'scope.record', success: () => resolve('GRANTED'), fail: () => resolve('DENIED') })
      })
    }
    const mediaDevices = globalThis.navigator?.mediaDevices
    if (mediaDevices?.getUserMedia) {
      const stream = await mediaDevices.getUserMedia({ audio: true })
      for (const track of stream.getTracks()) track.stop()
      return 'GRANTED'
    }
    return 'UNSUPPORTED'
  } catch {
    return 'DENIED'
  }
}

export function recorderManager(): B11RecorderManager | null {
  try { return runtime().getRecorderManager?.() ?? null } catch { return null }
}

async function readFileBytes(filePath: string): Promise<ArrayBuffer | string> {
  const manager = getUniRuntime().getFileSystemManager?.()
  if (!manager) {
    if (typeof fetch === 'function' && /^(blob:|data:|https?:)/i.test(filePath)) {
      const response = await fetch(filePath)
      if (!response.ok) throw new Error('浏览器录音引用无法读取。')
      return response.arrayBuffer()
    }
    throw new Error('当前平台未提供文件读取适配器。')
  }
  return new Promise<ArrayBuffer | string>((resolve, reject) => manager.readFile({ filePath, success: (result) => resolve(result.data), fail: reject }))
}

export async function hashRecordingFile(filePath: string): Promise<string> {
  const data = await readFileBytes(filePath)
  if (typeof data === 'string') return hashB11Payload(data)
  const cryptoValue = globalThis.crypto
  if (cryptoValue?.subtle) {
    const digest = await cryptoValue.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return hashB11Payload(Array.from(new Uint8Array(data)))
}

export interface ProtectedRecording {
  localPath: string
  storageMode: 'LOCAL_ENCRYPTED' | 'LOCAL_TEMP'
  contentHash: string
  vault: UniSecureRecordingVault | null
}

export async function protectRecording(filePath: string): Promise<ProtectedRecording> {
  const vault = runtime().getSecureRecordingVault?.() ?? null
  if (vault) {
    const encrypted = await vault.encryptFile({ filePath })
    if (!/^[A-Fa-f0-9]{64}$/.test(encrypted.contentHash)) throw new Error('录音加密适配器未返回有效 SHA-256。')
    return { localPath: encrypted.encryptedFilePath, storageMode: 'LOCAL_ENCRYPTED', contentHash: encrypted.contentHash, vault }
  }
  const contentHash = await hashRecordingFile(filePath)
  if (!/^[A-Fa-f0-9]{64}$/.test(contentHash)) throw new Error('录音文件无法完成完整性校验。')
  return { localPath: filePath, storageMode: 'LOCAL_TEMP', contentHash, vault: null }
}

export async function createRecordingPlaybackSource(localPath: string, storageMode: ProtectedRecording['storageMode']): Promise<string> {
  const vault = runtime().getSecureRecordingVault?.() ?? null
  if (storageMode === 'LOCAL_ENCRYPTED') {
    if (!vault) throw new Error('当前平台没有安全录音回放适配器。')
    return vault.createPlaybackSource({ encryptedFilePath: localPath })
  }
  return localPath
}

export async function deleteProtectedRecording(localPath: string, storageMode: ProtectedRecording['storageMode']): Promise<void> {
  if (storageMode !== 'LOCAL_ENCRYPTED') return
  const vault = runtime().getSecureRecordingVault?.() ?? null
  if (vault) await vault.deleteFile({ encryptedFilePath: localPath })
}
