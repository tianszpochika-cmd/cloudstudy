import type { B8Device } from '@englishflow/contracts'
import { mobileApiClient } from './client'
import { createClientId } from '../platform/client-id'

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  if ('data' in value) return value.data
  if ('result' in value) return value.result
  return value
}

function parseDevice(value: unknown): B8Device {
  if (!isRecord(value)
    || typeof value.deviceId !== 'string' || !value.deviceId.trim()
    || typeof value.deviceType !== 'string' || !value.deviceType.trim()
    || (value.status !== 'ACTIVE' && value.status !== 'REVOKED')
    || typeof value.lastActiveAt !== 'string' || !value.lastActiveAt.trim()) {
    throw new Error('设备列表中包含无效记录，请重试。')
  }
  return {
    deviceId: value.deviceId,
    deviceType: value.deviceType,
    status: value.status,
    lastActiveAt: value.lastActiveAt,
    isCurrent: typeof value.isCurrent === 'boolean' ? value.isCurrent : false,
  }
}

export async function listMobileDevices(): Promise<B8Device[]> {
  const response = await mobileApiClient.request<unknown>('/iam/devices')
  const source = unwrap(response)
  if (!isRecord(source) || !Array.isArray(source.devices)) {
    throw new Error('设备列表响应不完整，请重试。')
  }
  return source.devices.map(parseDevice)
}

export async function kickoutMobileDevice(deviceId: string): Promise<void> {
  const id = deviceId.trim()
  if (!id) throw new Error('缺少设备标识，未发送退出请求。')
  await mobileApiClient.request(`/iam/devices/${encodeURIComponent(id)}/kickout`, {
    method: 'POST',
    data: {},
    header: { 'Idempotency-Key': createClientId('mobile-device-kickout') },
  })
}
