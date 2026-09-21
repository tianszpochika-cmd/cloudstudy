import { adminClient, AdminApiError } from './client'
import { adminT } from '../platform/admin-i18n'

/**
 * B2 admin audio preview: short-lived signed URLs only.
 * Audio bytes are never proxied through the admin backend; the browser
 * streams directly from the signed URL and decodes locally for the waveform.
 */

interface SignedUrlResponse {
  url?: string
  signedUrl?: string
  expiresAt?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function fetchPreviewUrl(assetId: string): Promise<{ url: string; expiresAt: string | null }> {
  try {
    const response = await adminClient.request(
      `/media/assets/${encodeURIComponent(assetId)}/signed-url`,
      { method: 'POST', body: { purpose: 'ADMIN_PREVIEW', ttlSeconds: 300 } },
    )
    const data = (isRecord(response) && isRecord(response.data) ? response.data : response) as SignedUrlResponse
    const url = typeof data.url === 'string' ? data.url : typeof data.signedUrl === 'string' ? data.signedUrl : ''
    if (!url) throw new Error(adminT('apiMediaPreview.emptyUrl'))
    return { url, expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : null }
  } catch (error) {
    if (error instanceof AdminApiError) throw new Error(error.message)
    throw error instanceof Error ? error : new Error(adminT('apiMediaPreview.fetchFailed'))
  }
}

export async function decodePeaks(url: string, buckets = 96): Promise<number[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(adminT('apiMediaPreview.downloadFailed', { status: response.status }))
  const bytes = await response.arrayBuffer()
  const context = new AudioContext()
  try {
    const buffer = await context.decodeAudioData(bytes)
    const channel = buffer.getChannelData(0)
    const peaks: number[] = []
    const step = Math.max(1, Math.floor(channel.length / buckets))
    for (let i = 0; i < channel.length; i += step) {
      let peak = 0
      for (let j = i; j < Math.min(i + step, channel.length); j += 7) {
        const value = Math.abs(channel[j] ?? 0)
        if (value > peak) peak = value
      }
      peaks.push(Math.min(1, peak))
      if (peaks.length >= buckets) break
    }
    return peaks
  } finally {
    void context.close()
  }
}
