import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const output = path.dirname(fileURLToPath(import.meta.url))
const codes = [
  'bulk-course-0085', 'bulk-course-0086', 'bulk-course-0087',
  'bulk-course-0088', 'bulk-course-0089', 'bulk-course-0090',
  'E2E-PACK-MUBBMMMQ', 'E2E-PACK-MUBBNORG',
  'REPRO-PACK-MUBA8O9Q', 'REPRO-PACK-MUBBRQQR', 'T14-PACK-MUBIT0T8',
]
const cleanedCodes = ['REPRO-PACK-MUBA8O9Q', 'REPRO-PACK-MUBBRQQR', 'T14-PACK-MUBIT0T8']
const cleanedChildIds = [
  'lx_497c3d9da4b2', 'lx_855d74f87dcc', 'lx_91e9808b9165',
  'lx_93f31fca779e', 'lx_d2341a691bfd', 'lx_08c6310113bc',
  'lx_0ce1fc15c3e4', 'lx_3b1a5d7d1dd7', 'lx_67d7cbf77da5',
  'lx_855fc18a54b2', 'lx_f489a97447eb', 'qi_3da8de5c1be0',
]
const ownerSchemas = [
  'admin_ops_service', 'analytics_service', 'assessment_service', 'audit_service',
  'commerce_service', 'content_service', 'gamification_service', 'iam_service',
  'learner_service', 'learning_service', 'media_service', 'notification_service',
  'social_service', 'workflow_service',
]

function run(query) {
  return execFileSync('docker', [
    'exec', '-i', '-e', 'MYSQL_PWD=root-local-only', 'yuxuexing-local-mysql-1',
    'mysql', '-uroot', '--default-character-set=utf8mb4', '-N', '-B',
  ], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024, timeout: 180000 })
}

const quote = value => `'${value.replaceAll("'", "''")}'`
const ownerList = ownerSchemas.map(quote).join(',')
const definitions = run(`SELECT d.content_code,d.content_id,d.kind,d.title,d.created_by,DATE_FORMAT(d.created_at,'%Y-%m-%d %H:%i:%s.%f'),COALESCE(d.current_published_version_id,'NULL'),d.content_epoch,d.projection_version,COUNT(v.content_version_id) FROM content_service.content_definition d LEFT JOIN content_service.content_version v ON v.content_id=d.content_id WHERE d.content_code IN (${codes.map(quote).join(',')}) GROUP BY d.content_code,d.content_id,d.kind,d.title,d.created_by,d.created_at,d.current_published_version_id,d.content_epoch,d.projection_version ORDER BY d.content_code;`)
  .trim().split('\n').filter(Boolean).map(row => {
    const [code, id, kind, title, creator, createdAt, publishedVersionId, epoch, projectionVersion, versionCount] = row.split('\t')
    return { code, id, kind, title, creator, createdAt, publishedVersionId, epoch: Number(epoch), projectionVersion: Number(projectionVersion), versionCount: Number(versionCount) }
  })
const missingCodes = codes.filter(code => !definitions.some(item => item.code === code))
if (!(missingCodes.length === 0 || missingCodes.length === cleanedCodes.length && missingCodes.every(code => cleanedCodes.includes(code))) || definitions.some(item => item.versionCount !== 0 || item.publishedVersionId !== 'NULL')) throw new Error('candidate facts drifted; audit stopped')
const childIds = run(`SELECT 'lexeme',pack_code,lexeme_id FROM content_service.lexeme WHERE pack_code IN (${codes.map(quote).join(',')}) UNION ALL SELECT 'item',pack_code,item_id FROM content_service.content_item WHERE pack_code IN (${codes.map(quote).join(',')});`)
  .trim().split('\n').filter(Boolean).map(row => {
    const [kind, code, id] = row.split('\t')
    return { kind, code, id }
  })

const columns = run(`SELECT table_schema,table_name,column_name FROM information_schema.columns WHERE table_schema IN (${ownerList}) AND data_type IN ('char','varchar','tinytext','text','mediumtext','longtext','json') AND table_name NOT IN ('flyway_schema_history','p1r_schema_history') ORDER BY table_schema,table_name,ordinal_position;`)
  .trim().split('\n').filter(Boolean).map(row => row.split('\t'))
const tables = new Map()
for (const [schema, table, column] of columns) {
  const key = `${schema}.${table}`
  if (key === 'content_service.content_definition') continue
  if (!tables.has(key)) tables.set(key, [])
  tables.get(key).push(column)
}
const keys = [...new Set([...codes, ...childIds.map(item => item.id), ...cleanedChildIds])]
const candidateSql = keys.map((code, index) => `${index ? 'UNION ALL ' : ''}SELECT ${quote(code)} code`).join(' ')
const statements = [...tables.entries()].map(([table, fields]) => {
  const match = fields.map(column => `INSTR(CAST(t.\`${column}\` AS CHAR),c.code)>0`).join(' OR ')
  return `SELECT ${quote(table)} source,c.code,COUNT(*) hits FROM ${table} t JOIN (${candidateSql}) c ON (${match}) GROUP BY c.code HAVING COUNT(*)>0;`
})
const rawHits = run(statements.join('\n')).trim()
const hits = rawHits ? rawHits.split('\n').map(row => {
  const [source, code, count] = row.split('\t')
  return { source, code, count: Number(count) }
}) : []
const finding = {
  capturedAt: new Date().toISOString(),
  ownerSchemas, scannedTables: tables.size, requestedCodes: codes, missingCodes, candidates: definitions, childIds,
  hits: hits.sort((a, b) => a.code.localeCompare(b.code) || a.source.localeCompare(b.source)),
}
await fs.mkdir(output, { recursive: true })
await fs.writeFile(path.join(output, 'reference-scan.json'), JSON.stringify(finding, null, 2) + '\n')
console.log(JSON.stringify({ scannedTables: finding.scannedTables, candidates: definitions.length, missingCodes, childIds: childIds.length, hits: hits.length, sources: [...new Set(hits.map(hit => hit.source))] }, null, 2))
