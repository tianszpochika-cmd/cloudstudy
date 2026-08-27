import process from 'node:process'

const runId = `b33-fe-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`
const checks = [
  ['learner-web-login', 'http://127.0.0.1:18180/login'],
  ['admin-web-login', 'http://127.0.0.1:18181/login'],
  ['official-site-home', 'http://127.0.0.1:18182/'],
  ['mobile-h5-login', 'http://127.0.0.1:18183/#/pages/login/login'],
  ['official-site-gateway-projection', 'http://127.0.0.1:18182/api/public-projection?locale=zh-CN'],
]

const failures = []
const results = []
for (const [id, url] of checks) {
  try {
    const response = await fetch(url, { redirect: 'manual' })
    const text = await response.text()
    const result = { id, status: response.status, bytes: text.length }
    if (response.status !== 200) failures.push(`${id}: HTTP ${response.status}`)
    if (id === 'official-site-gateway-projection') {
      let body
      try { body = JSON.parse(text) } catch { body = null }
      result.source = body?.source ?? null
      result.state = body?.state ?? null
      result.courseCount = Array.isArray(body?.projection?.courses) ? body.projection.courses.length : 0
      if (body?.source !== 'gateway' || body?.state !== 'ready') failures.push(`${id}: expected Gateway ready projection`)
    }
    results.push(result)
  } catch (error) {
    failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const result = {
  result: failures.length ? 'FAIL' : 'PASS',
  batch: 'B33',
  evidenceClass: 'frontend-fixed-port-runtime',
  runId,
  checks: results,
  failures,
  realDataBoundary: 'official site SSR -> Gateway -> content-service public MySQL projection',
}
console.log(JSON.stringify(result, null, 2))
process.exitCode = failures.length ? 1 : 0
