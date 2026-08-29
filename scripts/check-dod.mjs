#!/usr/bin/env node

import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOD_CONFIG } from './check-dod.config.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXIT_OK = 0;
const EXIT_GATE_FAILED = 1;
const EXIT_USAGE_ERROR = 2;
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.turbo',
  'dist',
  'build',
  'target',
  'coverage',
  '.next',
  'unpackage',
  'vendor'
]);
const SECRET_SCAN_EXTENSIONS = new Set([
  '.env',
  '.json',
  '.js',
  '.mjs',
  '.ts',
  '.tsx',
  '.java',
  '.py',
  '.properties',
  '.key',
  '.pem',
  '.yml',
  '.yaml',
  '.xml',
  '.sql',
  '.sh',
  '.ps1'
]);
const PLACEHOLDER_VALUES = [
  'change-me',
  'changeme',
  'example',
  'placeholder',
  'your_',
  'your-',
  'dummy',
  'test',
  'local',
  'dev',
  'none',
  'null',
  'undefined',
  'replace',
  'todo',
  'xxxx',
  'password',
  'secret',
  'yuxuexing'
];
const HIGH_CONFIDENCE_SECRET_PATTERNS = [
  { type: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { type: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { type: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { type: 'stripe-live-key', pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/ }
];
const PRIVATE_KEY_BLOCK_PATTERNS = [
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----\r?\n(?:[ \t]*[A-Za-z0-9+/=]{16,}[ \t]*\r?\n)+[ \t]*-----END(?: [A-Z]+)? PRIVATE KEY-----/gi,
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----\\n(?:[A-Za-z0-9+/=]{32,}\\n)+-----END(?: [A-Z]+)? PRIVATE KEY-----/gi
];
const SYNTHETIC_POLICY_MARKER_LINE = /^\s*["']?(?:-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|Bearer eyJ[A-Za-z0-9_-]+\.|@[a-z0-9.-]+\.[a-z]{2,})["']?\s*,?\s*$/i;
// This check targets environment/configuration assignments. Keep the key case-sensitive
// so ordinary lower-camel-case TypeScript object properties such as `refreshToken`
// are not mistaken for committed credentials.
const SENSITIVE_ASSIGNMENT_PATTERN = /^\s*([A-Z][A-Z0-9_-]*(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|PRIVATE[_-]?KEY)[A-Z0-9_-]*)\s*[:=]\s*["']?([^"'#\s]+)["']?\s*$/;

function printHelp() {
  console.log(`语学星 DoD 结构预检（无外部依赖）

用法：
  node scripts/check-dod.mjs                 人类可读预检
  node scripts/check-dod.mjs --json          输出机器可读 JSON
  node scripts/check-dod.mjs --strict        将 warning 也视为 Gate 失败
  node scripts/check-dod.mjs --self-test     运行脚本自身的内置自检
  node scripts/check-dod.mjs --help          显示帮助

检查内容：必需文档、契约/迁移/测试目录、固定端口注册表、治理关键标记和高置信真实密钥。
退出码：0=通过；1=Gate 失败；2=参数或脚本配置错误。
`);
}

function parseArgs(argv) {
  const options = { json: false, strict: false, selfTest: false, help: false };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--self-test') options.selfTest = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  if (options.help && (options.selfTest || options.strict)) {
    throw new Error('--help 不能与 --self-test 或 --strict 同时使用');
  }
  return options;
}

function makeCheck(name, status, details = []) {
  return { name, status, details: Array.isArray(details) ? details : [details] };
}

function listFiles(rootPath) {
  if (!existsSync(rootPath)) return [];
  const files = [];
  const visit = (currentPath) => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = join(currentPath, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) files.push(absolutePath);
    }
  };
  visit(rootPath);
  return files;
}

function isNonEmptyFile(absolutePath) {
  return existsSync(absolutePath) && statSync(absolutePath).isFile() && statSync(absolutePath).size > 0;
}

function checkRequiredDocuments(repoRoot) {
  const failures = [];
  for (const document of DOD_CONFIG.requiredDocuments) {
    const absolutePath = resolve(repoRoot, document.path);
    if (!isNonEmptyFile(absolutePath)) failures.push(`${document.label}: ${document.path}`);
  }
  return failures.length === 0
    ? makeCheck('必需文档', 'PASS', [`已核验 ${DOD_CONFIG.requiredDocuments.length} 个文档`])
    : makeCheck('必需文档', 'FAIL', failures.map((item) => `缺失或为空：${item}`));
}

function checkRequiredDirectories(repoRoot) {
  const failures = [];
  const warnings = [];
  for (const directory of DOD_CONFIG.requiredDirectories) {
    const absolutePath = resolve(repoRoot, directory.path);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isDirectory()) {
      failures.push(`缺失：${directory.path}`);
      continue;
    }
    const files = listFiles(absolutePath);
    const hasExpectedFile = files.some((filePath) => directory.expectedExtensions.includes(extname(filePath).toLowerCase()));
    if (!hasExpectedFile) warnings.push(`${directory.path}：${directory.warning}`);
  }
  const details = [`已核验 ${DOD_CONFIG.requiredDirectories.length} 个目录`];
  if (warnings.length > 0) details.push(...warnings);
  if (failures.length > 0) return makeCheck('契约/迁移/测试目录', 'FAIL', [...failures, ...details]);
  if (warnings.length > 0) return makeCheck('契约/迁移/测试目录', 'WARN', details);
  return makeCheck('契约/迁移/测试目录', 'PASS', details);
}

export function validatePortRegistry(registry, requiredServices = DOD_CONFIG.portRegistry.requiredServices) {
  const failures = [];
  if (!registry || typeof registry !== 'object') return ['端口注册表不是对象'];
  if (registry.host !== '127.0.0.1') failures.push('host 必须为 127.0.0.1');
  if (registry.policy?.autoIncrement !== false) failures.push('policy.autoIncrement 必须为 false');
  if (registry.policy?.bindOnlyToLoopback !== true) failures.push('policy.bindOnlyToLoopback 必须为 true');
  if (!registry.services || typeof registry.services !== 'object') return [...failures, 'services 缺失或不是对象'];

  const ports = new Map();
  for (const [serviceName, service] of Object.entries(registry.services)) {
    if (!Number.isInteger(service?.port) || service.port < 1024 || service.port > 65535) {
      failures.push(`${serviceName} 的 port 不是合法非特权端口`);
      continue;
    }
    if (ports.has(service.port)) failures.push(`端口重复：${service.port}（${ports.get(service.port)} 与 ${serviceName}）`);
    else ports.set(service.port, serviceName);
  }
  for (const [serviceName, expectedPort] of Object.entries(requiredServices)) {
    const actualPort = registry.services[serviceName]?.port;
    if (actualPort !== expectedPort) failures.push(`${serviceName} 应为 ${expectedPort}，实际为 ${actualPort ?? '缺失'}`);
  }
  return failures;
}

function checkPortRegistry(repoRoot) {
  const relativePath = DOD_CONFIG.portRegistry.path;
  const absolutePath = resolve(repoRoot, relativePath);
  if (!isNonEmptyFile(absolutePath)) return makeCheck('固定端口注册表', 'FAIL', [`缺失或为空：${relativePath}`]);
  try {
    const registry = JSON.parse(readFileSync(absolutePath, 'utf8'));
    const failures = validatePortRegistry(registry);
    return failures.length === 0
      ? makeCheck('固定端口注册表', 'PASS', [`已核验 ${Object.keys(registry.services).length} 个服务，禁止自动递增`])
      : makeCheck('固定端口注册表', 'FAIL', failures);
  } catch (error) {
    return makeCheck('固定端口注册表', 'FAIL', [`JSON 解析失败：${error.message}`]);
  }
}

function shouldScanFile(absolutePath, repoRoot) {
  const relativePath = relative(repoRoot, absolutePath).replaceAll('\\', '/');
  const baseName = relativePath.split('/').at(-1) ?? '';
  if (baseName === '.env.example' || baseName === '.env.sample' || baseName.endsWith('.example')) return false;
  const extension = extname(baseName).toLowerCase();
  return SECRET_SCAN_EXTENSIONS.has(extension) || baseName === '.env';
}

function isPlaceholderValue(value) {
  const normalized = value.toLowerCase();
  if (normalized.startsWith('${') || normalized.startsWith('<') || normalized.startsWith('[')) return true;
  return PLACEHOLDER_VALUES.some((placeholder) => normalized.includes(placeholder));
}

export function scanSecrets(repoRoot) {
  const findings = [];
  for (const absolutePath of listFiles(repoRoot)) {
    if (!shouldScanFile(absolutePath, repoRoot)) continue;
    if (statSync(absolutePath).size > 2 * 1024 * 1024) continue;
    const relativePath = relative(repoRoot, absolutePath).replaceAll('\\', '/');
    let content;
    try {
      content = readFileSync(absolutePath, 'utf8');
    } catch {
      continue;
    }
    for (const pattern of PRIVATE_KEY_BLOCK_PATTERNS) {
      for (const match of content.matchAll(pattern)) {
        findings.push({
          type: 'private-key-block',
          path: relativePath,
          line: content.slice(0, match.index).split(/\r?\n/).length
        });
      }
    }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const syntheticPolicyMarker = SYNTHETIC_POLICY_MARKER_LINE.test(line);
      for (const { type, pattern } of HIGH_CONFIDENCE_SECRET_PATTERNS) {
        if (!syntheticPolicyMarker && pattern.test(line)) findings.push({ type, path: relativePath, line: index + 1 });
      }
      const assignment = line.match(SENSITIVE_ASSIGNMENT_PATTERN);
      if (assignment && assignment[2].length >= 16 && !isPlaceholderValue(assignment[2])) {
        findings.push({ type: 'sensitive-assignment', path: relativePath, line: index + 1, key: assignment[1] });
      }
    });
  }
  return findings.filter((finding, index, all) => all.findIndex((other) => JSON.stringify(other) === JSON.stringify(finding)) === index);
}

function checkSecrets(repoRoot) {
  const findings = scanSecrets(repoRoot);
  if (findings.length === 0) return makeCheck('真实密钥扫描', 'PASS', ['未发现高置信私钥、平台 Token 或非占位敏感环境变量']);
  return makeCheck('真实密钥扫描', 'FAIL', findings.map((finding) => `${finding.type}: ${finding.path}:${finding.line}${finding.key ? ` (${finding.key})` : ''}`));
}

function checkGovernanceMarkers(repoRoot) {
  const relativePath = 'docs/00-vision/document-governance.md';
  const absolutePath = resolve(repoRoot, relativePath);
  if (!isNonEmptyFile(absolutePath)) return makeCheck('治理关键标记', 'FAIL', [`缺失或为空：${relativePath}`]);
  const content = readFileSync(absolutePath, 'utf8');
  const missing = DOD_CONFIG.governanceMarkers.filter((marker) => !content.includes(marker));
  return missing.length === 0
    ? makeCheck('治理关键标记', 'PASS', [`已核验 ${DOD_CONFIG.governanceMarkers.length} 个冻结/治理标记`])
    : makeCheck('治理关键标记', 'FAIL', missing.map((marker) => `缺少：${marker}`));
}

export function runGate({ repoRoot = REPO_ROOT, strict = false } = {}) {
  const checks = [
    checkRequiredDocuments(repoRoot),
    checkRequiredDirectories(repoRoot),
    checkPortRegistry(repoRoot),
    checkSecrets(repoRoot),
    checkGovernanceMarkers(repoRoot)
  ];
  const failures = checks.filter((check) => check.status === 'FAIL');
  const warnings = checks.filter((check) => check.status === 'WARN');
  const effectiveFailures = strict ? [...failures, ...warnings] : failures;
  const statusCounts = checks.reduce((counts, check) => {
    counts[check.status.toLowerCase()] += 1;
    return counts;
  }, { pass: 0, warn: 0, fail: 0 });
  return {
    version: 1,
    mode: 'gate',
    strict,
    ok: effectiveFailures.length === 0,
    exitCode: effectiveFailures.length === 0 ? EXIT_OK : EXIT_GATE_FAILED,
    summary: statusCounts,
    checks
  };
}

export function runSelfTest() {
  const fixtureRoot = resolve(tmpdir(), `yuxuexing-dod-self-test-${process.pid}-${Date.now()}`);
  mkdirSync(fixtureRoot, { recursive: true });
  try {
    writeFileSync(join(fixtureRoot, '.env'), 'JWT_SECRET=realistic-credential-value-1234567890\n', 'utf8');
    writeFileSync(join(fixtureRoot, '.env.example'), 'JWT_SECRET=change-me\n', 'utf8');
    writeFileSync(join(fixtureRoot, 'PemParser.java'), 'pem.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "");\n', 'utf8');
    const privateKeyFixture = [
      `-----BEGIN ${'PRIVATE KEY'}-----`,
      'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB',
      'QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJC',
      `-----END ${'PRIVATE KEY'}-----`,
      ''
    ].join('\n');
    writeFileSync(join(fixtureRoot, 'leaked.key'), privateKeyFixture, 'utf8');
    const findings = scanSecrets(fixtureRoot);
    assert.ok(findings.some((finding) => finding.type === 'sensitive-assignment' && finding.path === '.env'));
    assert.equal(findings.some((finding) => finding.path === '.env.example'), false);
    assert.equal(findings.some((finding) => finding.path === 'PemParser.java'), false);
    assert.ok(findings.some((finding) => finding.type === 'private-key-block' && finding.path === 'leaked.key'));

    const goodRegistry = {
      host: '127.0.0.1',
      policy: { autoIncrement: false, bindOnlyToLoopback: true },
      services: { 'core-api': { port: 18080 } }
    };
    assert.deepEqual(validatePortRegistry(goodRegistry, { 'core-api': 18080 }), []);
    const badRegistry = {
      ...goodRegistry,
      services: { 'core-api': { port: 18080 }, duplicate: { port: 18080 } }
    };
    assert.ok(validatePortRegistry(badRegistry, { 'core-api': 18080 }).some((failure) => failure.includes('端口重复')));
    return { passed: 6, failed: 0, message: 'secret placeholder、真实 PEM、解析器字面量、敏感变量、端口合法和端口重复检测均通过' };
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function printHuman(result) {
  console.log(`DoD 预检：${result.ok ? '通过' : '失败'}${result.strict ? '（strict）' : ''}`);
  for (const check of result.checks) {
    console.log(`[${check.status}] ${check.name}`);
    for (const detail of check.details) console.log(`  - ${detail}`);
  }
  console.log(`汇总：PASS=${result.summary.pass} WARN=${result.summary.warn} FAIL=${result.summary.fail}；退出码=${result.exitCode}`);
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return EXIT_OK;
    }
    if (options.selfTest) {
      const selfTest = runSelfTest();
      const result = { version: 1, mode: 'self-test', ok: true, exitCode: EXIT_OK, selfTest };
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else console.log(`check-dod 自检通过：${selfTest.message}`);
      return EXIT_OK;
    }
    const result = runGate({ strict: options.strict });
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printHuman(result);
    return result.exitCode;
  } catch (error) {
    const result = { version: 1, mode: 'error', ok: false, exitCode: EXIT_USAGE_ERROR, error: error.message };
    if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else {
      console.error(`check-dod 执行失败：${error.message}`);
      console.error('使用 node scripts/check-dod.mjs --help 查看用法。');
    }
    return EXIT_USAGE_ERROR;
  }
}

const exitCode = await main();
process.exitCode = exitCode;
