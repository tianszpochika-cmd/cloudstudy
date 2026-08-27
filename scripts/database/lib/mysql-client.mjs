import { spawnSync } from 'node:child_process';

const defaultComposeFile = 'infra/docker/docker-compose.dev.yml';

function hostMysqlAvailable(mysqlBin) {
  if (mysqlBin !== 'mysql') return true;
  const probe = spawnSync(mysqlBin, ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'ignore'
  });
  return probe.error == null && probe.status === 0;
}

function dockerMysqlArgs(mysqlArgs, password) {
  const normalized = [...mysqlArgs];
  const hostIndex = normalized.indexOf('--host');
  if (hostIndex >= 0 && normalized[hostIndex + 1]) normalized[hostIndex + 1] = '127.0.0.1';
  const portIndex = normalized.indexOf('--port');
  if (portIndex >= 0 && normalized[portIndex + 1]) normalized[portIndex + 1] = '3306';
  return [
    'compose',
    '-f',
    process.env.MYSQL_COMPOSE_FILE || defaultComposeFile,
    'exec',
    '-T',
    '-e',
    `MYSQL_PWD=${password}`,
    process.env.MYSQL_COMPOSE_SERVICE || 'mysql',
    'mysql',
    ...normalized
  ];
}

export function runMysql({ mysqlBin = 'mysql', mysqlArgs, password, cwd, input }) {
  const requestedMode = process.env.MYSQL_RUNTIME_MODE || 'auto';
  if (!['auto', 'host', 'docker'].includes(requestedMode)) {
    throw new Error(`MYSQL_RUNTIME_MODE 必须为 auto|host|docker，当前为 ${requestedMode}`);
  }
  const useDocker = requestedMode === 'docker' || (requestedMode === 'auto' && !hostMysqlAvailable(mysqlBin));
  const command = useDocker ? 'docker' : mysqlBin;
  const args = useDocker ? dockerMysqlArgs(mysqlArgs, password) : mysqlArgs;
  const result = spawnSync(command, args, {
    cwd,
    input,
    encoding: 'utf8',
    env: { ...process.env, ...(useDocker ? {} : { MYSQL_PWD: password }) },
    windowsHide: true
  });
  if (result.error) throw new Error(`无法启动 mysql 客户端 (${command}): ${result.error.message}`);
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `${command} exit ${result.status}`).trim());
  return (result.stdout || '').trim();
}

export function mysqlRuntimeMode(mysqlBin = 'mysql') {
  const requestedMode = process.env.MYSQL_RUNTIME_MODE || 'auto';
  if (requestedMode === 'docker') return 'docker';
  if (requestedMode === 'host') return 'host';
  return hostMysqlAvailable(mysqlBin) ? 'host' : 'docker';
}
