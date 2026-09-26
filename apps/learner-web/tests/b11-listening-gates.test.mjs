import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parse } = require('vue/compiler-sfc')
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8')

function walk(node, ancestors, visit) {
  if (node.type === 1) {
    const guard = node.props.find(prop => prop.type === 7 && prop.name === 'if')?.exp?.content
    const next = guard ? [...ancestors, guard] : ancestors
    visit(node, next)
    for (const child of node.children) walk(child, next, visit)
  } else {
    visit(node, ancestors)
    for (const child of node.children ?? []) walk(child, ancestors, visit)
  }
}

function hasClass(node, className) {
  return node.type === 1 && node.props.some(prop =>
    prop.type === 6 && prop.name === 'class' && prop.value?.content.split(' ').includes(className))
}

test('listening controls and dictation require a fresh playable grant', async () => {
  const source = await read('src/pages/B11ListeningPage.vue')
  const parsed = parse(source)
  assert.deepEqual(parsed.errors, [])
  assert.match(source, /<\/template>\s*<style scoped>/)
  const template = parsed.descriptor.template?.ast
  assert.ok(template)
  assert.match(source, /grant\.assetId !== mediaRef\.assetId/)
  assert.match(source, /b11\.manifest\.contentVersionId !== item\.contentVersionId/)
  assert.match(source, /rendition\.status === 'READY'/)
  assert.match(source, /!hasTextAlternative\.value/)
  assert.match(source, /expiresAt > Date\.now\(\)/)
  assert.match(source, /item\.rightsStatus !== 'AUTHORIZED'/)
  assert.match(source, /mediaRef\.rightsStatus !== 'AUTHORIZED'/)
  const elements = []
  walk(template, [], (node, guards) => { if (node.type === 1) elements.push({ node, guards }) })
  for (const item of elements.filter(({ node }) => node.tag === 'audio' || hasClass(node, 'player-controls') || node.tag === 'textarea')) {
    assert.ok(item.guards.some(guard => guard.includes('audioSrc')), item.node.tag)
  }
  assert.ok(elements.some(({ node, guards }) => node.tag === 'textarea' && guards.some(guard => guard.includes('b3.listeningSessionId'))))
  assert.ok(elements.some(({ node, guards }) => hasClass(node, 'media-fallback') && guards.some(guard => guard === 'audioSrc') === false))
  assert.match(source, /hasTextAlternative \? 'b11\.listening\.textFallbackHint' : 'b11\.listening\.missingText'/)
})

test('hidden subtitles do not expose segment text or clip titles', async () => {
  const source = await read('src/pages/B11ListeningPage.vue')
  const template = parse(source).descriptor.template?.ast
  assert.ok(template)
  assert.match(source, /const showTranscript = computed\(\(\) => material\.value\?\.rightsStatus === 'AUTHORIZED' && \(!audioSrc\.value \|\| subtitlesVisible\.value\)\)/)
  assert.match(source, /b11\.progress\?\.assetId === material\.value\?\.mediaRef\?\.assetId/)
  const exposed = []
  walk(template, [], (node, guards) => {
    if (node.type === 5 && /(?:activeSegment|segment)\.text|segment\.translation|clip\.title/.test(node.content.content)) {
      exposed.push({ expression: node.content.content, guards })
    }
  })
  assert.ok(exposed.length >= 4)
  for (const { expression, guards } of exposed) {
    assert.ok(
      expression.includes('showTranscript ?')
        || expression.includes('showTranscript &&')
        || expression.includes('audioSrc ?')
        || guards.some(guard => guard.includes('showTranscript') || guard.includes('subtitlesVisible')),
      expression,
    )
  }
})
