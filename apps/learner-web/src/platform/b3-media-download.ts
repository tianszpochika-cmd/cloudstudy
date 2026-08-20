export interface B3MediaDownloadRequest {
  assetId: string
  url: string
  expectedSha256: string
  expectedBytes?: number
  expiresAt?: string
  signal?: AbortSignal
  onProgress?: (downloadedBytes: number, totalBytes: number | null) => void
}

export interface B3CachedMedia {
  assetId: string
  bytes: Uint8Array
  updatedAt: string
}

export interface B3MediaCache {
  get(assetId: string): Promise<B3CachedMedia | null>
  put(assetId: string, bytes: Uint8Array): Promise<void>
  remove(assetId: string): Promise<void>
}

export class B3MediaDownloadError extends Error {
  constructor(readonly code: 'MEDIA_EXPIRED' | 'MEDIA_UNAVAILABLE' | 'MEDIA_CHECKSUM_MISMATCH' | 'MEDIA_SIZE_MISMATCH' | 'MEDIA_RESPONSE_INVALID', message: string) {
    super(message)
    this.name = 'B3MediaDownloadError'
  }
}

const memoryAssets = new Map<string, B3CachedMedia>()

export function createMemoryB3MediaCache(): B3MediaCache {
  return {
    async get(assetId) { return memoryAssets.get(assetId) ?? null },
    async put(assetId, bytes) { memoryAssets.set(assetId, { assetId, bytes: bytes.slice(), updatedAt: new Date().toISOString() }) },
    async remove(assetId) { memoryAssets.delete(assetId) },
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return }
    const request = indexedDB.open('yx-b3-media', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('assets', { keyPath: 'assetId' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

export function createIndexedB3MediaCache(): B3MediaCache {
  const fallback = createMemoryB3MediaCache()
  return {
    async get(assetId) {
      try {
        const db = await openDatabase()
        return await new Promise<B3CachedMedia | null>((resolve, reject) => {
          const request = db.transaction('assets', 'readonly').objectStore('assets').get(assetId)
          request.onsuccess = () => { const value = request.result as { assetId: string; bytes: ArrayBuffer; updatedAt: string } | undefined; resolve(value ? { assetId: value.assetId, bytes: new Uint8Array(value.bytes), updatedAt: value.updatedAt } : null) }
          request.onerror = () => reject(request.error)
        })
      } catch { return fallback.get(assetId) }
    },
    async put(assetId, bytes) {
      try {
        const db = await openDatabase()
        await new Promise<void>((resolve, reject) => {
          const request = db.transaction('assets', 'readwrite').objectStore('assets').put({ assetId, bytes: bytes.slice().buffer, updatedAt: new Date().toISOString() })
          request.onsuccess = () => resolve(); request.onerror = () => reject(request.error)
        })
      } catch { await fallback.put(assetId, bytes) }
    },
    async remove(assetId) {
      try {
        const db = await openDatabase()
        await new Promise<void>((resolve, reject) => {
          const request = db.transaction('assets', 'readwrite').objectStore('assets').delete(assetId)
          request.onsuccess = () => resolve(); request.onerror = () => reject(request.error)
        })
      } catch { await fallback.remove(assetId) }
    },
  }
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.byteLength + right.byteLength)
  result.set(left); result.set(right, left.byteLength)
  return result
}

function asBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy.buffer as ArrayBuffer])
}

async function sha256(bytes: Uint8Array): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new B3MediaDownloadError('MEDIA_RESPONSE_INVALID', '当前环境不支持媒体完整性校验')
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function downloadB3Asset(request: B3MediaDownloadRequest, cache = createIndexedB3MediaCache(), fetchImpl: typeof fetch = fetch): Promise<Blob> {
  if (!request.url || !/^[A-Fa-f0-9]{64}$/.test(request.expectedSha256)) throw new B3MediaDownloadError('MEDIA_RESPONSE_INVALID', '媒体地址或期望哈希无效')
  if (request.expiresAt && new Date(request.expiresAt).getTime() <= Date.now()) throw new B3MediaDownloadError('MEDIA_EXPIRED', '离线媒体包已过期')
  const previous = await cache.get(request.assetId)
  if (previous && request.expectedBytes !== undefined && previous.bytes.byteLength === request.expectedBytes && (await sha256(previous.bytes)).toLowerCase() === request.expectedSha256.toLowerCase()) return asBlob(previous.bytes)
  let bytes = previous?.bytes ?? new Uint8Array()
  const headers: Record<string, string> = {}
  if (bytes.byteLength) headers.Range = `bytes=${bytes.byteLength}-`
  const response = await fetchImpl(request.url, { headers, signal: request.signal })
  if (!response.ok && response.status !== 206) throw new B3MediaDownloadError('MEDIA_UNAVAILABLE', `媒体服务返回 ${response.status}`)
  if (bytes.byteLength && response.status === 200) bytes = new Uint8Array()
  const declaredLength = Number(response.headers.get('Content-Length'))
  const totalBytes = request.expectedBytes ?? (Number.isFinite(declaredLength) && declaredLength > 0 ? declaredLength + bytes.byteLength : null)
  request.onProgress?.(bytes.byteLength, totalBytes)
  if (response.body) {
    const reader = response.body.getReader()
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (chunk.value?.byteLength) { bytes = concat(bytes, chunk.value); await cache.put(request.assetId, bytes); request.onProgress?.(bytes.byteLength, totalBytes) }
    }
  } else {
    bytes = concat(bytes, new Uint8Array(await response.arrayBuffer()))
    await cache.put(request.assetId, bytes)
  }
  if (request.expectedBytes !== undefined && bytes.byteLength !== request.expectedBytes) { await cache.remove(request.assetId); throw new B3MediaDownloadError('MEDIA_SIZE_MISMATCH', '媒体大小与清单不一致') }
  if ((await sha256(bytes)).toLowerCase() !== request.expectedSha256.toLowerCase()) { await cache.remove(request.assetId); throw new B3MediaDownloadError('MEDIA_CHECKSUM_MISMATCH', '媒体校验和不匹配，已清理残片') }
  await cache.put(request.assetId, bytes)
  return asBlob(bytes)
}
