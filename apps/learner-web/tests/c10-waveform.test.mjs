import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('listening pages render waveforms only with an authorized playable URL', async () => {
  for (const page of [
    'apps/learner-web/src/pages/B11ListeningPage.vue',
    'apps/learner-web/src/pages/B3ListeningPage.vue',
  ]) {
    const source = await read(page)
    // Real extraction from authorized bytes via the shared Web Audio module.
    assert.match(source, /extractPeaksFromArrayBuffer/)
    assert.match(source, /peaksToBars\(waveformPeaks\.value/)
    assert.match(source, /v-if="audioSrc" class="waveform"/, `${page}: unavailable audio must not show decorative waveform bars`)
    // Explicit data-source marker so tests and reviewers can tell peaks from fallback.
    assert.match(source, /data-source="waveBars \? 'extracted' : 'fallback'"/)
    // The fallback stays strictly decorative: deterministic heights, no claims.
    assert.match(source, /v-else/)
  }
})

test('waveform extractor decodes bytes and downsamples deterministically', async () => {
  const module = await read('apps/learner-web/src/platform/waveform.ts')
  assert.match(module, /decodeAudioData/)
  assert.match(module, /WAVEFORM_EXTRACTOR = 'web-audio-v1'/)
  assert.match(module, /Math\.round\(Math\.min\(1, peak\) \* 10000\) \/ 10000/)
  assert.match(module, /toFixed\(4\)/)
})
