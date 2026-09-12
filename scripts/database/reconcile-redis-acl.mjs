import { spawnSync } from 'node:child_process';

const redisContainer = process.env.REDIS_CONTAINER ?? 'yuxuexing-local-redis-1';
const ownerPassword = process.env.REDIS_OWNER_PASSWORD ?? 'local-redis-only';

const services = [
  { id: 'api-gateway', user: 'svc_gateway', namespace: 'englishflow:gateway' },
  { id: 'iam-service', user: 'svc_iam', namespace: 'iam' },
  { id: 'learner-service', user: 'svc_learner', namespace: 'learner' },
  { id: 'content-service', user: 'svc_content', namespace: 'content' },
  { id: 'learning-service', user: 'svc_learning', namespace: 'learning' },
  { id: 'assessment-service', user: 'svc_assessment', namespace: 'assessment' },
  { id: 'media-service', user: 'svc_media', namespace: 'media' },
  { id: 'gamification-service', user: 'svc_gamification', namespace: 'gamification' },
  { id: 'social-service', user: 'svc_social', namespace: 'social' },
  { id: 'notification-service', user: 'svc_notification', namespace: 'notification' },
  { id: 'analytics-service', user: 'svc_analytics', namespace: 'analytics' },
  // The ACL user name follows the same <svc>_<id without the -service suffix, dashes to underscores>
  // convention as the MySQL credential so an operator finds the same principal in both stores.
  { id: 'admin-ops-service', user: 'svc_admin_ops', namespace: 'admin-ops' },
  { id: 'commerce-service', user: 'svc_commerce', namespace: 'commerce' },
  { id: 'audit-service', user: 'svc_audit', namespace: 'audit' },
  { id: 'workflow-service', user: 'svc_workflow', namespace: 'workflow' },
];

const ownerCommands = [
  '+@connection',
  '+get', '+set', '+setnx', '+del', '+exists', '+expire', '+pexpire', '+ttl', '+pttl',
  '+incr', '+incrby', '+decr', '+hget', '+hset', '+hdel', '+hgetall', '+hincrby',
  '+lpush', '+rpush', '+lpop', '+rpop', '+lrange', '+zadd', '+zrange', '+zrem',
  '+sadd', '+smembers', '+srem', '+eval', '+evalsha',
];

function passwordEnvName(service) {
  return `${service.id.toUpperCase().replaceAll('-', '_')}_REDIS_PASSWORD`;
}

function passwordFor(service) {
  const envName = passwordEnvName(service);
  const value = process.env[envName];
  return value && value.trim()
    ? { password: value, source: `service-env:${envName}` }
    : { password: ownerPassword, source: 'shared-env:REDIS_OWNER_PASSWORD' };
}

function redis(args, timeout = 15000) {
  const result = spawnSync('docker', ['exec', redisContainer, 'redis-cli', '-p', '6379', '--raw', ...args], {
    encoding: 'utf8', windowsHide: true, timeout,
  });
  if (result.error) throw new Error(`redis-cli could not be executed: ${result.error.message}`);
  return { status: result.status, stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim() };
}

function redisOrFail(args) {
  const result = redis(args);
  if (result.status !== 0) throw new Error(`redis-cli failed (${args.join(' ')}): ${result.stderr || result.stdout}`);
  return result.stdout;
}

function provision(service) {
  const { password, source } = passwordFor(service);
  const pattern = `${service.namespace}:*`;
  redisOrFail(['ACL', 'DELUSER', service.user]);
  redisOrFail(['ACL', 'SETUSER', service.user, 'on', `>${password}`, `~${pattern}`, 'resetchannels']);
  redisOrFail(['ACL', 'SETUSER', service.user, ...ownerCommands]);
  const detail = redisOrFail(['ACL', 'GETUSER', service.user]);
  if (!detail.split(/\r?\n/).includes('on')) {
    throw new Error(`${service.id} ACL user is not enabled`);
  }
  return { id: service.id, user: service.user, namespace: service.namespace, pattern, passwordSource: source };
}

function dryRun(service, command, key) {
  const result = redis(['ACL', 'DRYRUN', service.user, command, key]);
  return { status: result.status, output: result.stdout || result.stderr };
}

try {
  const users = services.map(provision);
  for (const service of users) {
    const own = dryRun(service, 'GET', `${service.namespace}:acl-probe`);
    if (own.status !== 0 || !/^OK$/m.test(own.output)) {
      throw new Error(`${service.id} ACL DRYRUN must allow its own namespace: ${own.output}`);
    }
    const foreign = services.find((candidate) => candidate.namespace !== service.namespace);
    const denied = dryRun(service, 'GET', `${foreign.namespace}:acl-probe`);
    if (denied.status === 0 && /^OK$/m.test(denied.output)) {
      throw new Error(`${service.id} ACL DRYRUN must deny namespace ${foreign.namespace}`);
    }
    service.allowedDryRun = true;
    service.crossNamespaceDenied = true;
  }
  redisOrFail(['ACL', 'SAVE']);
  console.log(JSON.stringify({
    result: 'PASS',
    redisContainer,
    namespaceCount: users.length,
    aclFilePersisted: true,
    credentialsPersisted: false,
    passwordsEmitted: false,
    defaultUserUnchanged: true,
    users,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ result: 'FAIL', message: error.message }, null, 2));
  process.exitCode = 2;
}
