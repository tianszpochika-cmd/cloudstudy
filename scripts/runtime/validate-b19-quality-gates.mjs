import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const configPath = path.join(root, 'config', 'b19-quality-gates.json')
const errors = []
const allowedRuntimeStatuses = new Set(['pending', 'blocked'])
const requiredGateIds = [
  'B19-QA-005-NETWORK',
  'B19-QA-005-PERFORMANCE',
  'B19-QA-005-PERFORMANCE-LEVELS',
  'B19-QA-005-ACCESSIBILITY',
  'B19-QA-005-I18N-THEME',
  'B19-QA-005-STATE-FALLBACK',
  'B19-TEST-006-DEFECTS',
  'B19-TEST-006-REGRESSION',
  'B19-TEST-006-EVIDENCE',
  'B19-TEST-006-REPORT',
]

function fail(message) { errors.push(message) }
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function requireString(value, label) { if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`) }
function requireArray(value, label, minimum = 1) { if (!Array.isArray(value) || value.length < minimum) fail(`${label} must contain at least ${minimum} item(s)`) }
function unique(values, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) fail(`${label} contains duplicate: ${value}`)
    seen.add(value)
  }
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')) }
  catch (error) { fail(`cannot read or parse config/b19-quality-gates.json: ${error.message}`); return null }
}

function safeSourcePath(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.includes('..') || path.isAbsolute(relativePath)) {
    fail(`source path must be a relative repository path: ${relativePath}`)
    return null
  }
  const resolved = path.resolve(root, relativePath)
  const relative = path.relative(root, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) { fail(`source path escapes repository: ${relativePath}`); return null }
  if (/^(node_modules|dist|\.nuxt|\.output)([\\/]|$)/i.test(relative)) fail(`generated/dependency source is not allowed: ${relativePath}`)
  return resolved
}

function validateStaticCheck(check, gateId, evidenceIds) {
  if (!isRecord(check)) { fail(`${gateId} has a non-object static check`); return }
  requireString(check.id, `${gateId}.staticCheck.id`)
  requireString(check.kind, `${gateId}.staticCheck.kind`)
  if (check.status !== 'defined') fail(`${check.id} static status must be defined, never a runtime result`)
  if (check.evidenceClass !== 'static') fail(`${check.id} must use evidenceClass=static`)
  if (check.runtimeRequired !== false) fail(`${check.id} must use runtimeRequired=false`)
  requireString(check.evidenceId, `${check.id}.evidenceId`)
  evidenceIds.add(check.evidenceId)
  requireArray(check.assertions, `${check.id}.assertions`)
  if (check.sourcePaths !== undefined) {
    requireArray(check.sourcePaths, `${check.id}.sourcePaths`)
    const content = []
    for (const source of check.sourcePaths) {
      const resolved = safeSourcePath(source)
      if (!resolved) continue
      if (!fs.existsSync(resolved)) { fail(`${check.id} source does not exist: ${source}`); continue }
      content.push(fs.readFileSync(resolved, 'utf8'))
    }
    const combined = content.join('\n')
    for (const assertion of check.assertions) {
      if (!isRecord(assertion) || typeof assertion.contains !== 'string' || assertion.contains === '') { fail(`${check.id} has an invalid contains assertion`); continue }
      if (!combined.includes(assertion.contains)) fail(`${check.id} source assertion missing: ${assertion.contains}`)
    }
  }
}

function validateRuntimeCheck(check, gateId, evidenceIds) {
  if (!isRecord(check)) { fail(`${gateId} has a non-object runtime check`); return }
  requireString(check.id, `${gateId}.runtimeCheck.id`)
  requireString(check.kind, `${gateId}.runtimeCheck.kind`)
  if (!allowedRuntimeStatuses.has(check.status)) fail(`${check.id} must remain pending/blocked until real execution; got ${check.status}`)
  if (check.evidenceClass !== 'runtime') fail(`${check.id} must use evidenceClass=runtime`)
  if (check.runtimeRequired !== true) fail(`${check.id} must use runtimeRequired=true`)
  requireString(check.evidenceId, `${check.id}.evidenceId`)
  evidenceIds.add(check.evidenceId)
  requireArray(check.tools, `${check.id}.tools`)
  requireArray(check.targets, `${check.id}.targets`)
  requireArray(check.scenarios, `${check.id}.scenarios`)
  requireArray(check.evidenceRequired, `${check.id}.evidenceRequired`)
  requireArray(check.cannotBeSatisfiedBy, `${check.id}.cannotBeSatisfiedBy`)
  requireString(check.expected, `${check.id}.expected`)
}

function validateReportSchema(reportSchema) {
  if (!isRecord(reportSchema)) { fail('reportSchema is required'); return }
  requireString(reportSchema.id, 'reportSchema.id')
  requireString(reportSchema.version, 'reportSchema.version')
  const schema = reportSchema.jsonSchema
  if (!isRecord(schema)) { fail('reportSchema.jsonSchema is required'); return }
  if (schema.type !== 'object') fail('reportSchema.jsonSchema.type must be object')
  if (schema.additionalProperties !== false) fail('report schema must reject unknown properties')
  const required = new Set(schema.required ?? [])
  for (const field of ['schemaVersion', 'reportId', 'batch', 'run', 'decision', 'gates', 'defects', 'regressions', 'evidence']) {
    if (!required.has(field)) fail(`report schema missing required field: ${field}`)
  }
  for (const field of ['decision', 'gates', 'defects', 'regressions', 'evidence']) {
    if (!schema.properties?.[field]) fail(`report schema missing property: ${field}`)
  }
  const decisionRequired = new Set(schema.properties?.decision?.required ?? [])
  for (const field of ['status', 'p0Open', 'p1Open', 'p2Unresolved', 'runtimePending']) {
    if (!decisionRequired.has(field)) fail(`report decision missing required field: ${field}`)
  }
  const defectRequired = new Set(schema.properties?.defects?.items?.required ?? [])
  for (const field of ['severity', 'status', 'steps', 'expected', 'actual', 'environment', 'evidenceIds', 'owner', 'reproducible']) {
    if (!defectRequired.has(field)) fail(`report defect missing required field: ${field}`)
  }
}

function validate(config) {
  if (!config) return
  if (config.schemaVersion !== 1) fail('schemaVersion must be 1')
  if (config.batch !== 'B19') fail('batch must be B19')
  if (config.phase !== 'phase-1') fail('quality gates must remain Phase 1')
  requireArray(config.tasks, 'tasks', 2)
  const taskIds = (config.tasks ?? []).map((task) => task?.id)
  unique(taskIds, 'task ids')
  for (const taskId of ['V2-B19-QA-005', 'V2-B19-TEST-006']) if (!taskIds.includes(taskId)) fail(`missing task: ${taskId}`)
  for (const task of config.tasks ?? []) {
    requireString(task?.id, 'task.id')
    if (task?.status !== 'defined') fail(`${task?.id} task status must be defined`) 
    if (task?.runtimeRequired !== true) fail(`${task?.id} must declare runtimeRequired=true`)
  }

  requireArray(config.qualityGates, 'qualityGates', requiredGateIds.length)
  const gates = config.qualityGates ?? []
  unique(gates.map((gate) => gate?.id), 'quality gate ids')
  for (const gateId of requiredGateIds) if (!gates.some((gate) => gate?.id === gateId)) fail(`missing quality gate: ${gateId}`)
  const allCheckIds = []
  const referencedEvidenceIds = new Set()
  for (const gate of gates) {
    requireString(gate?.id, 'qualityGate.id')
    if (!taskIds.includes(gate?.task)) fail(`${gate?.id} references unknown task: ${gate?.task}`)
    requireString(gate?.category, `${gate?.id}.category`)
    requireArray(gate?.evidenceIds, `${gate?.id}.evidenceIds`)
    const checkEvidenceIds = new Set()
    for (const check of gate?.staticChecks ?? []) { allCheckIds.push(check?.id); validateStaticCheck(check, gate.id, checkEvidenceIds) }
    for (const check of gate?.runtimeChecks ?? []) { allCheckIds.push(check?.id); validateRuntimeCheck(check, gate.id, checkEvidenceIds) }
    for (const evidenceId of gate?.evidenceIds ?? []) {
      referencedEvidenceIds.add(evidenceId)
      if (!checkEvidenceIds.has(evidenceId)) fail(`${gate.id} evidenceIds must reference check evidence: ${evidenceId}`)
    }
    for (const evidenceId of checkEvidenceIds) if (!gate.evidenceIds.includes(evidenceId)) fail(`${gate.id} is missing check evidence reference: ${evidenceId}`)
  }
  unique(allCheckIds, 'quality check ids')

  const evidence = config.evidenceIndex
  requireArray(evidence, 'evidenceIndex')
  unique((evidence ?? []).map((item) => item?.id), 'evidence ids')
  for (const item of evidence ?? []) {
    requireString(item?.id, 'evidence.id')
    if (!gates.some((gate) => gate.id === item?.gateId)) fail(`${item.id} references unknown gate: ${item?.gateId}`)
    if (!['static', 'runtime'].includes(item?.class)) fail(`${item.id} class must be static or runtime`)
    if (item?.class === 'static') {
      if (item.status !== 'defined' || item.runtimeRequired !== false) fail(`${item.id} static evidence must be defined with runtimeRequired=false`)
    } else if (item.status !== 'pending' || item.runtimeRequired !== true) {
      fail(`${item.id} runtime evidence must remain pending with runtimeRequired=true`)
    }
    requireString(item?.artifactPathPattern, `${item.id}.artifactPathPattern`)
    requireString(item?.collectionPolicy, `${item.id}.collectionPolicy`)
  }
  for (const evidenceId of referencedEvidenceIds) if (!evidence.some((item) => item.id === evidenceId)) fail(`missing evidence index item: ${evidenceId}`)

  const policy = config.defectPolicy
  if (!isRecord(policy)) fail('defectPolicy is required')
  const severities = new Map((policy?.severityLevels ?? []).map((level) => [level.code, level]))
  for (const code of ['P0', 'P1', 'P2']) {
    const level = severities.get(code)
    if (!level) { fail(`missing defect severity: ${code}`); continue }
    requireArray(level.requiredFields, `${code}.requiredFields`)
    if (code !== 'P2' && (level.releaseBlocker !== true || level.openAllowed !== 0)) fail(`${code} must block release with zero open defects`)
  }
  if (policy?.releaseDecision?.p0OpenMustEqual !== 0 || policy?.releaseDecision?.p1OpenMustEqual !== 0) fail('release decision must require zero open P0/P1')
  if (policy?.releaseDecision?.p2RequiresDisposition !== true) fail('P2 disposition rule is required')
  for (const value of ['fix-before-release', 'risk-accepted', 'deferred-with-plan']) if (!policy?.p2Dispositions?.includes(value)) fail(`missing P2 disposition: ${value}`)

  const regression = config.regressionSelection
  if (!isRecord(regression)) fail('regressionSelection is required')
  const suiteIds = (regression?.suites ?? []).map((suite) => suite?.id)
  unique(suiteIds, 'regression suite ids')
  for (const suiteId of ['phase1-smoke', 'quality-static', 'b18-four-app-static', 'i18n-theme-performance-contract', 'full-phase1-regression']) if (!suiteIds.includes(suiteId)) fail(`missing regression suite: ${suiteId}`)
  for (const suiteId of regression?.minimumSuites ?? []) if (!suiteIds.includes(suiteId)) fail(`minimum regression suite is not defined: ${suiteId}`)
  for (const rule of regression?.rules ?? []) {
    requireArray(rule?.whenAnyChangedArea, `${rule?.id}.whenAnyChangedArea`)
    requireArray(rule?.includeSuites, `${rule?.id}.includeSuites`)
    for (const suiteId of rule.includeSuites) if (!suiteIds.includes(suiteId)) fail(`${rule.id} references unknown suite: ${suiteId}`)
  }
  if (regression?.runtimeEvidenceRequired !== true) fail('regression selection must require runtime evidence')

  validateReportSchema(config.reportSchema)
}

const config = readConfig()
validate(config)
const result = errors.length === 0 ? 'PASS' : 'FAIL'
console.log(JSON.stringify({ batch: config?.batch ?? 'B19', result, qualityGateCount: config?.qualityGates?.length ?? 0, evidenceCount: config?.evidenceIndex?.length ?? 0, runtimeEvidencePending: (config?.evidenceIndex ?? []).filter((item) => item.class === 'runtime' && item.status === 'pending').length, errors }, null, 2))
if (result !== 'PASS') process.exitCode = 1
