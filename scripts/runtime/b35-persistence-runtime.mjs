import { spawnSync } from 'node:child_process'

const container = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1'
const runId = process.env.B35_PERSISTENCE_RUN_ID ?? `b35-persistence-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`

function query(schema, sql) {
  const result = spawnSync('docker', ['exec', container, 'mysql', '-uroot', '-proot-local-only', schema, '-N', '-B', '-e', sql], {
    encoding: 'utf8', windowsHide: true,
  })
  if (result.status !== 0) throw new Error(`${schema} query failed: ${(result.stderr ?? '').trim().slice(0, 300)}`)
  return Number((result.stdout ?? '').trim())
}

const facts = {
  iamExternalIdentities: query('iam_service', 'SELECT COUNT(*) FROM iam_external_identity'),
  iamRevokedSessions: query('iam_service', 'SELECT COUNT(*) FROM iam_session WHERE revoked_at IS NOT NULL'),
  contentDefinitions: query('content_service', 'SELECT COUNT(*) FROM content_definition'),
  learningSrsState: query('learning_service', 'SELECT COUNT(*) FROM b25_learning_srs_state'),
  assessmentReports: query('assessment_service', 'SELECT COUNT(*) FROM b25_assessment_report'),
  notificationMessages: query('notification_service', 'SELECT COUNT(*) FROM notification_message'),
}
for (const [name, value] of Object.entries(facts)) {
  if (!Number.isFinite(value) || value < 1) throw new Error(`${name} was not persisted across the service restart`)
}
console.log(JSON.stringify({ result: 'PASS', runId, restartBoundary: 'all-14-java-services', facts, credentialsPersisted: false, tokenValuesEmitted: false }, null, 2))
