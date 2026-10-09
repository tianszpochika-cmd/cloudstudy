import type { B8Device } from '@englishflow/contracts'

export function isCurrentMobileDevice(
  device: Pick<B8Device, 'deviceId'> & { isCurrent?: boolean },
  currentDeviceId?: string | null,
): boolean {
  if (typeof device.isCurrent === 'boolean') {
    return device.isCurrent
  }
  return Boolean(currentDeviceId) && device.deviceId === currentDeviceId
}

export function canRevokeMobileDevice(
  device: Pick<B8Device, 'deviceId' | 'status'> & { isCurrent?: boolean },
  currentDeviceId: string | null,
): boolean {
  if (device.status !== 'ACTIVE') return false
  if (typeof device.isCurrent === 'boolean') {
    return !device.isCurrent
  }
  return Boolean(currentDeviceId) && device.deviceId !== currentDeviceId
}
