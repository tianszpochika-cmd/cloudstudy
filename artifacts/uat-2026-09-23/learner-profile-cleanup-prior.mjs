// One-time exact cleanup for the four earlier local synthetic profile probes.
import { runMysql } from '../../scripts/database/lib/mysql-client.mjs'

const runIds = [
  'profile-mudmdo57-013886',
  'profile-mudme0hg-b46708',
  'profile-mudmfvuw-a9cfe9',
  'profile-mudmger3-c23aff',
]
const mysqlArgs = ['--protocol=TCP', '--host', '127.0.0.1', '--port', '13306', '--user',
  process.env.MYSQL_ADMIN_USER || 'root', '--default-character-set=utf8mb4',
  '--batch', '--skip-column-names', '--raw']
const sql = input => runMysql({ mysqlArgs, password: process.env.MYSQL_ROOT_PASSWORD || 'root-local-only',
  cwd: process.cwd(), input })
const result = []

for (const runId of runIds) {
  if (!/^profile-[a-z0-9-]+$/.test(runId)) throw new Error('unsafe synthetic run id')
  const identifier = `${runId}@local.invalid`
  const row = sql(`SELECT principal_id, status FROM iam_service.iam_account WHERE identifier='${identifier}';`).trim()
  const fields = row.split('\t')
  if (fields.length !== 2 || !/^[a-zA-Z0-9-]{20,128}$/.test(fields[0]) || fields[1] !== 'DISABLED')
    throw new Error(`${runId}: disabled synthetic account not uniquely verified`)
  const subject = fields[0]
  const before = sql(`SELECT
      (SELECT COUNT(*) FROM learner_service.learner_profile WHERE owner_id='${subject}' AND tenant_id='platform'),
      (SELECT COUNT(*) FROM learner_service.learner_goal WHERE owner_id='${subject}' AND tenant_id='platform'),
      (SELECT COUNT(*) FROM learner_service.learner_idempotency_record WHERE owner_id='${subject}' AND tenant_id='platform'),
      (SELECT COUNT(*) FROM learner_service.learner_outbox_event WHERE owner_id='${subject}' AND tenant_id='platform');`)
  sql(`START TRANSACTION;
       DELETE FROM learner_service.learner_first_day_projection WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.learner_goal WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.learner_preference WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.learner_idempotency_record WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.learner_outbox_event WHERE owner_id='${subject}' AND tenant_id='platform';
       DELETE FROM learner_service.learner_profile WHERE owner_id='${subject}' AND tenant_id='platform';
       COMMIT;`)
  const after = sql(`SELECT
      (SELECT COUNT(*) FROM learner_service.learner_profile WHERE owner_id='${subject}'),
      (SELECT COUNT(*) FROM learner_service.learner_goal WHERE owner_id='${subject}'),
      (SELECT COUNT(*) FROM learner_service.learner_preference WHERE owner_id='${subject}'),
      (SELECT COUNT(*) FROM learner_service.learner_first_day_projection WHERE owner_id='${subject}'),
      (SELECT COUNT(*) FROM learner_service.learner_idempotency_record WHERE owner_id='${subject}'),
      (SELECT COUNT(*) FROM learner_service.learner_outbox_event WHERE owner_id='${subject}');`).trim().split('\t')
  if (after.length !== 6 || after.some(value => value !== '0')) throw new Error(`${runId}: owner cleanup incomplete`)
  result.push({ runId, before: before.trim().split('\t').map(Number), ownerRowsAfter: 0 })
}
console.log(JSON.stringify({ syntheticAccounts: result.length, accountsRemainDisabled: true, result }))
