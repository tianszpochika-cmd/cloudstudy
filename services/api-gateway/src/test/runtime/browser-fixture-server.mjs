import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const host = '127.0.0.1'
const profiles = Object.freeze({
  learner: { port: 18180, browserHost: host },
  admin: { port: 18181, browserHost: host },
  official: { port: 18182, browserHost: host },
  mobile: { port: 18183, browserHost: host },
  // Reuses the registered official-site port while that app is stopped. The
  // localhost spelling deliberately produces an unregistered browser Origin.
  unknown: { port: 18182, browserHost: 'localhost' },
})
const profile = process.argv[2]
if (!Object.hasOwn(profiles, profile) || process.argv.length !== 3) {
  process.stderr.write('Select exactly one fixed profile: learner, admin, official, mobile, or unknown.\n')
  process.exit(2)
}

const root = path.dirname(fileURLToPath(import.meta.url))
const assets = new Map([
  ['/', { file: 'browser-fixture.html', type: 'text/html; charset=utf-8' }],
  ['/browser-fixture.html', { file: 'browser-fixture.html', type: 'text/html; charset=utf-8' }],
  ['/browser-fixture-client.js', { file: 'browser-fixture-client.js', type: 'text/javascript; charset=utf-8' }],
])

const server = http.createServer((request, response) => {
  const asset = assets.get(request.url)
  if (request.method !== 'GET' || !asset) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    response.end('Not found')
    return
  }
  response.writeHead(200, {
    'content-type': asset.type,
    'cache-control': 'no-store, max-age=0',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src http://127.0.0.1:18070; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  })
  response.end(fs.readFileSync(path.join(root, asset.file)))
})

server.on('error', () => {
  process.stderr.write(`The fixed ${profile} fixture port is unavailable.\n`)
  process.exitCode = 1
})

server.listen(profiles[profile].port, host, () => {
  process.stdout.write(`M2 browser fixture (${profile}): http://${profiles[profile].browserHost}:${profiles[profile].port}/\n`)
})
