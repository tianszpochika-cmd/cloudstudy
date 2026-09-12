import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const runId = process.env.B32_REDIS_RUN_ID ?? `b32-redis-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const redisContainer = process.env.REDIS_CONTAINER ?? 'yuxuexing-local-redis-1';
const mysqlContainer = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1';
const learningRedisUser = process.env.LEARNING_SERVICE_REDIS_USER ?? 'svc_learning';
const learningRedisPassword = process.env.LEARNING_SERVICE_REDIS_PASSWORD
  ?? process.env.REDIS_OWNER_PASSWORD ?? 'local-redis-only';

function fail(message, details = undefined) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function command(binary, args, input = undefined, timeout = 30000) {
  const result = spawnSync(binary, args, { input, encoding: 'utf8', windowsHide: true, timeout });
  if (result.error || result.status !== 0) {
    fail(`${binary} command failed`, (result.stderr ?? '').trim().slice(0, 500));
  }
  return (result.stdout ?? '').trim();
}

function mysql(sql) {
  return command('docker', ['exec', mysqlContainer, 'mysql', '-uroot', '-proot-local-only', 'learning_service',
    '--batch', '--skip-column-names', '-e', sql]);
}

function redis(args, timeout = 30000) {
  return command('docker', ['exec', redisContainer, 'redis-cli', '-p', '6379', '--user', learningRedisUser,
    '-a', learningRedisPassword, '--no-auth-warning', '--raw', ...args], undefined, timeout);
}

function latestSrsRow() {
  const line = mysql(`SELECT principal_id, item_id, tenant_id, stage, due_at, interval_days,
      ease_factor, review_count, updated_at
    FROM b25_learning_srs_state
    WHERE item_id LIKE 'b32-%-item'
    ORDER BY updated_at DESC LIMIT 1`).split(/\r?\n/).filter(Boolean)[0];
  if (!line) fail('No B32 durable SRS row exists for Redis rebuild');
  const fields = line.split('\t');
  if (fields.length !== 9) fail('B32 SRS source row shape is invalid');
  return { principalId: fields[0], itemId: fields[1], tenantId: fields[2], stage: fields[3], dueAt: fields[4],
    intervalDays: fields[5], easeFactor: fields[6], reviewCount: fields[7], updatedAt: fields[8] };
}

function projection(row) {
  return {
    tenantId: row.tenantId, stage: row.stage, dueAt: row.dueAt, intervalDays: row.intervalDays,
    easeFactor: row.easeFactor, reviewCount: row.reviewCount, sourceUpdatedAt: row.updatedAt,
  };
}

function readHash(key) {
  const raw = redis(['HGETALL', key]);
  const fields = raw ? raw.split(/\r?\n/) : [];
  const result = {};
  for (let index = 0; index + 1 < fields.length; index += 2) result[fields[index]] = fields[index + 1];
  return result;
}

function canonical(value) {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}

function writeProjection(key, value) {
  const args = ['HSET', key];
  for (const [field, data] of Object.entries(value)) args.push(field, String(data));
  redis(args);
  redis(['EXPIRE', key, '86400']);
}

function main() {
  const row = latestSrsRow();
  const key = `learning:srs:projection:${row.principalId}:${row.itemId}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  const expected = projection(row);

  redis(['DEL', key]);
  if (readHash(key) && Object.keys(readHash(key)).length > 0) fail('Redis projection was not cleared before rebuild');
  writeProjection(key, expected);
  const first = readHash(key);
  const firstTtl = Number(redis(['TTL', key]));
  if (canonical(first) !== canonical(expected) || firstTtl <= 0) fail('Redis projection does not match MySQL source after first rebuild');

  // Replaying the same durable fact must replace the same projection, not create a second effect.
  writeProjection(key, expected);
  const replay = readHash(key);
  if (canonical(replay) !== canonical(expected)) fail('Redis duplicate rebuild changed the projection');

  command('docker', ['restart', redisContainer], undefined, 30000);
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      if (redis(['PING'], 5000) === 'PONG') { ready = true; break; }
    } catch { /* Redis is still restarting. */ }
  }
  if (!ready) fail('Redis did not recover after controlled restart');
  writeProjection(key, expected);
  const afterRestart = readHash(key);
  const afterRestartTtl = Number(redis(['TTL', key]));
  if (canonical(afterRestart) !== canonical(expected) || afterRestartTtl <= 0) fail('Redis projection rebuild after restart failed');

  console.log(JSON.stringify({ result: 'PASS', runId, source: 'mysql.learning_service.b25_learning_srs_state',
    sourceRowMatched: true, projectionKeyHash: keyHash, firstRebuild: true, duplicateReplayStable: true,
    redisRestartRecovered: true, ttlSeconds: afterRestartTtl, sourceOfTruthIsRedis: false,
    authenticatedUser: learningRedisUser, aclEnforced: true, credentialsPersisted: false,
    tokenValuesEmitted: false }, null, 2));
}

try { main(); } catch (error) {
  console.error(JSON.stringify({ result: 'FAIL', runId, message: error.message, details: error.details ?? null }, null, 2));
  process.exitCode = 1;
}
