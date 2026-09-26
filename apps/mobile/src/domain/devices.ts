import type { B8Device } from '@englishflow/contracts'

export function canRevokeMobileDevice(device: Pick<B8Device, 'deviceId' | 'status'>, currentDeviceId: string | null): boolean {
  return Boolean(currentDeviceId)
    && device.status === 'ACTIVE'
    && device.deviceId !== currentDeviceId
}
