/**
 * Real waveform peaks via the Web Audio API (M5-004).
 *
 * The decorative 48-bar fallback is replaced wherever peaks are available: this module decodes
 * authorized audio bytes, takes per-bucket maxima and downsamples deterministically to
 * the requested bar count. Pitch preservation needs no code: HTMLMediaElement.playbackRate
 * keeps pitch natively in modern browsers; the six documented rates (0.5x–2.0x) ride on it.
 */

export interface WaveformPeaks {
  readonly peaks: readonly number[]
  readonly sampleCount: number
  readonly durationMs: number
  readonly extractor: string
}

export const WAVEFORM_EXTRACTOR = 'web-audio-v1'

export async function extractPeaksFromArrayBuffer(
  data: ArrayBuffer,
  bars = 96,
): Promise<WaveformPeaks> {
  const AudioContextCtor: typeof AudioContext | undefined =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) throw new Error('WAVEFORM_NO_AUDIO_CONTEXT')
  const context = new AudioContextCtor()
  try {
    const buffer = await context.decodeAudioData(data.slice(0))
    const channel = buffer.getChannelData(0)
    const bucket = Math.max(1, Math.floor(channel.length / bars))
    const peaks: number[] = []
    for (let index = 0; index < bars; index += 1) {
      const start = index * bucket
      let peak = 0
      for (let offset = start; offset < Math.min(start + bucket, channel.length); offset += 1) {
        const value = Math.abs(channel[offset] ?? 0)
        if (value > peak) peak = value
      }
      peaks.push(Math.round(Math.min(1, peak) * 10000) / 10000)
    }
    return {
      peaks,
      sampleCount: channel.length,
      durationMs: Math.round(buffer.duration * 1000),
      extractor: WAVEFORM_EXTRACTOR,
    }
  } finally {
    void context.close().catch(() => undefined)
  }
}

/** Deterministic downsample of registered peaks to the bar count the view renders. */
export function peaksToBars(peaks: readonly number[], bars = 48): readonly number[] {
  if (!peaks.length) return []
  if (peaks.length === bars) return [...peaks]
  const result: number[] = []
  for (let index = 0; index < bars; index += 1) {
    const start = Math.floor((index * peaks.length) / bars)
    const end = Math.max(start + 1, Math.floor(((index + 1) * peaks.length) / bars))
    let peak = 0
    for (let cursor = start; cursor < end; cursor += 1) peak = Math.max(peak, peaks[cursor] ?? 0)
    result.push(peak)
  }
  return result
}

/** Canonical peaks payload the server checksums (4-decimal join). */
export function canonicalPeaks(peaks: readonly number[]): string {
  return peaks.map((peak) => peak.toFixed(4)).join(',')
}
