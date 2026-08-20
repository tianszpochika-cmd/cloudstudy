export interface B3EncryptedRecording {
  algorithm: 'AES-GCM-256'
  iv: ArrayBuffer
  ciphertext: ArrayBuffer
  contentHash: string
  byteLength: number
  mimeType: string
}

export interface B3RecordingKeyProvider {
  getKey(): Promise<CryptoKey>
  clear(): Promise<void>
}

export interface B3RecordingVault {
  readonly keyProvider: B3RecordingKeyProvider
  put(recordingId: string, recording: B3EncryptedRecording): Promise<void>
  get(recordingId: string): Promise<B3EncryptedRecording | null>
  delete(recordingId: string): Promise<void>
  clear(): Promise<void>
}

function requireCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持 AES-GCM，未保存原始录音。')
  return globalThis.crypto
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createEphemeralB3KeyProvider(): B3RecordingKeyProvider {
  let key: CryptoKey | null = null
  return {
    async getKey(): Promise<CryptoKey> {
      if (!key) key = await requireCrypto().subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
      return key
    },
    async clear(): Promise<void> { key = null },
  }
}

export async function encryptB3Recording(blob: Blob, keyProvider: B3RecordingKeyProvider): Promise<B3EncryptedRecording> {
  const crypto = requireCrypto()
  const plaintext = await blob.arrayBuffer()
  const iv = crypto.getRandomValues(new Uint8Array(12)).buffer
  const [digest, ciphertext] = await Promise.all([
    crypto.subtle.digest('SHA-256', plaintext),
    crypto.subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, await keyProvider.getKey(), plaintext),
  ])
  return { algorithm: 'AES-GCM-256', iv, ciphertext, contentHash: hex(digest), byteLength: plaintext.byteLength, mimeType: blob.type || 'audio/webm' }
}

export async function decryptB3Recording(recording: B3EncryptedRecording, keyProvider: B3RecordingKeyProvider): Promise<Blob> {
  const plaintext = await requireCrypto().subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(recording.iv) }, await keyProvider.getKey(), recording.ciphertext)
  return new Blob([plaintext], { type: recording.mimeType })
}

export function createMemoryB3RecordingVault(keyProvider = createEphemeralB3KeyProvider()): B3RecordingVault {
  const records = new Map<string, B3EncryptedRecording>()
  return {
    keyProvider,
    async put(recordingId, recording): Promise<void> { records.set(recordingId, recording) },
    async get(recordingId): Promise<B3EncryptedRecording | null> { return records.get(recordingId) ?? null },
    async delete(recordingId): Promise<void> { records.delete(recordingId) },
    async clear(): Promise<void> { records.clear(); await keyProvider.clear() },
  }
}
