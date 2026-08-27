import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const ports = JSON.parse(readFileSync(path.join(root, 'config', 'local-ports.json'), 'utf8'))
const services = JSON.parse(readFileSync(path.join(root, 'config', 'v2-runtime-services.json'), 'utf8')).services
const runId = process.env.B36_RUN_ID ?? `b36-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`

function fail(message, details) { const error = new Error(message); error.details = details; throw error }
async function check(url) {
  const response = await fetch(url, { redirect: 'manual' })
  return { status: response.status, body: await response.text() }
}
function assert(condition, message, details) { if (!condition) fail(message, details) }

async function round(roundNumber) {
  const readiness = []
  for (const service of services) {
    const registered = ports.services[service.portKey]
    const result = await check(`http://127.0.0.1:${registered.port}${service.healthBasePath ?? ''}${service.healthPath}`)
    assert(result.status === 200, `${service.id} readiness failed in round ${roundNumber}`, result)
    readiness.push({ service: service.id, port: registered.port, status: result.status })
  }
  const frontends = []
  for (const [id, url] of [
    ['learner-web', 'http://127.0.0.1:18180/login'],
    ['admin-web', 'http://127.0.0.1:18181/login'],
    ['official-site', 'http://127.0.0.1:18182/'],
    ['mobile-h5', 'http://127.0.0.1:18183/#/pages/login/login'],
  ]) {
    const result = await check(url)
    assert(result.status === 200, `${id} failed in round ${roundNumber}`, result)
    frontends.push({ id, status: result.status, bytes: result.body.length })
  }
  const projection = await check('http://127.0.0.1:18182/api/public-projection?locale=zh-CN')
  assert(projection.status === 200, `official projection failed in round ${roundNumber}`, projection)
  const projectionBody = JSON.parse(projection.body)
  assert(projectionBody.source === 'gateway' && projectionBody.state === 'ready', `official projection is not gateway-ready in round ${roundNumber}`, projectionBody)
  return { round: roundNumber, services: readiness.length, frontends, projection: { source: projectionBody.source, state: projectionBody.state, courseCount: projectionBody.projection?.courses?.length ?? 0 } }
}

const first = await round(1)
await new Promise((resolve) => setTimeout(resolve, 800))
const second = await round(2)
console.log(JSON.stringify({
  result: 'PASS', runId, readinessRounds: [first, second],
  browserAuthJourney: 'WAITING_USER_CONFIRMATION', tokenValuesEmitted: false,
}, null, 2))
