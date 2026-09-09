const gateway = 'http://127.0.0.1:18070'
const results = document.querySelector('#results')
const originLabel = document.querySelector('#origin')
const identifierInput = document.querySelector('#identifier')
const passwordInput = document.querySelector('#password')
const held = { access: '' }
let sequence = 0

originLabel.textContent = `Browser origin under test: ${location.origin}`

function correlation(response) {
  const requestId = response.headers.get('x-request-id')
  const traceId = response.headers.get('x-trace-id')
  return requestId && traceId && !requestId.includes(',') && !traceId.includes(',') ? 'SINGLE_VALUE' : 'INVALID'
}

function append(check, result, status = 'BROWSER_BLOCKED', headers = 'NOT_EXPOSED') {
  const row = document.createElement('tr')
  for (const value of [check, result, String(status), headers]) {
    const cell = document.createElement('td')
    cell.textContent = value
    row.append(cell)
  }
  results.prepend(row)
}

function baseHeaders(operation) {
  sequence += 1
  return {
    accept: 'application/json',
    'x-request-id': `m2-browser-${operation}-${sequence}`,
    'x-trace-id': crypto.randomUUID().replaceAll('-', ''),
  }
}

async function request(check, pathname, options = {}) {
  try {
    const response = await fetch(`${gateway}${pathname}`, {
      method: options.method ?? 'GET',
      credentials: options.credentials ?? 'omit',
      headers: { ...baseHeaders(check), ...(options.headers ?? {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: 'manual',
    })
    let data = null
    const text = await response.text()
    if (text) {
      try { data = JSON.parse(text) } catch { data = null }
    }
    append(check, 'RESPONSE_VISIBLE', response.status, correlation(response))
    return { response, data }
  } catch {
    append(check, 'BROWSER_BLOCKED')
    return null
  }
}

async function register() {
  const identifier = identifierInput.value
  const password = passwordInput.value
  if (!identifier || !password) {
    append('register', 'INPUT_REQUIRED', 'NOT_SENT', 'NOT_EXPOSED')
    return
  }
  const result = await request('register', '/api/v1/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `m2-browser-register-${crypto.randomUUID()}`,
      'x-auth-transport': 'WEB_COOKIE',
    },
    body: {
      identifier,
      password,
      device: { deviceType: 'WEB', deviceName: 'm2-browser', clientVersion: 'm2-browser' },
    },
  })
  held.access = result?.data?.data?.accessToken ?? ''
  identifierInput.value = ''
  passwordInput.value = ''
}

async function principal() {
  if (!held.access) {
    append('principal', 'REGISTER_FIRST', 'NOT_SENT', 'NOT_EXPOSED')
    return
  }
  await request('principal', '/api/v1/iam/principal/me', {
    headers: {
      authorization: `Bearer ${held.access}`,
      'x-b5-role': 'admin',
      'x-role': 'admin',
      'x-tenant-id': 'forged-tenant',
      'x-owner-id': 'forged-owner',
    },
  })
}

async function refresh() {
  await request('refresh', '/api/v1/auth/token/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `m2-browser-refresh-${crypto.randomUUID()}`,
      'x-auth-transport': 'WEB_COOKIE',
    },
    body: {},
  })
}

const actions = {
  jwks: () => request('jwks', '/api/v1/auth/jwks'),
  register,
  principal,
  refresh,
}

document.addEventListener('click', (event) => {
  const action = event.target instanceof HTMLButtonElement ? event.target.dataset.action : undefined
  if (action && actions[action]) void actions[action]()
})
