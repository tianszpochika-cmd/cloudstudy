import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const staticOnly = process.argv.includes('--static-only');
const baseline = readJson('config/toolchain-baseline.json');
const packageJson = readJson('package.json');
const ports = readJson(baseline.policy.portsSource);
const errors = [];
const checks = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function check(name, actual, expected, passed, scope = 'static') {
  checks.push({ name, scope, actual, expected, passed });
  if (!passed) errors.push(`${name}: expected ${expected}, got ${actual ?? 'unavailable'}`);
}

function run(command, args = []) {
  const executable = process.platform === 'win32' && ['pnpm', 'mvn'].includes(command) ? `${command}.cmd` : command;
  return spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    shell: process.platform === 'win32' && executable.endsWith('.cmd')
  });
}

function outputOf(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function versionFrom(output) {
  return output.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? null;
}

function compareVersions(left, right) {
  const a = String(left).split('.').map(Number);
  const b = String(right).split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}

function xmlTag(xml, tag) {
  return xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1]?.trim() ?? null;
}

function bootParent(xml) {
  return xml.match(/<parent>[\s\S]*?<artifactId>spring-boot-starter-parent<\/artifactId>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/)?.[1]?.trim() ?? null;
}

function browserProbe() {
  if (process.platform === 'win32') {
    const candidates = [
      process.env.CHROME_PATH ?? '',
      path.join(process.env.ProgramFiles ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.ProgramFiles ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      const escaped = candidate.replaceAll("'", "''");
      const probe = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Item -LiteralPath '${escaped}').VersionInfo.ProductVersion`], {
        encoding: 'utf8', windowsHide: true, shell: false
      });
      const version = versionFrom(outputOf(probe));
      if (probe.status === 0 && version) return { command: candidate, version };
    }
    return { command: null, version: null };
  }
  const candidates = [process.env.CHROME_PATH,
    ...(process.platform === 'darwin' ? [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ] : []),
    'google-chrome', 'chrome', 'chromium', 'chromium-browser', 'microsoft-edge'
  ].filter(Boolean);
  for (const command of candidates) {
    const probe = run(command, ['--version']);
    const version = probe.status === 0 ? versionFrom(outputOf(probe)) : null;
    if (version) return { command, version };
  }
  return { command: null, version: null };
}

const platformKey = `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
check('supported platform', platformKey, baseline.policy.supportedPlatforms.join(' or '), baseline.policy.supportedPlatforms.includes(platformKey));
check('packageManager', packageJson.packageManager, `pnpm@${baseline.pnpm.requiredVersion}`, packageJson.packageManager === `pnpm@${baseline.pnpm.requiredVersion}`);

const lockText = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
const lockVersion = lockText.match(/^lockfileVersion:\s*['"]?([^'"\r\n]+)['"]?/m)?.[1]?.trim() ?? null;
check('pnpm lockfile version', lockVersion, baseline.pnpm.lockfileVersion, lockVersion === baseline.pnpm.lockfileVersion);

const portsPath = path.join(root, baseline.policy.portsSource);
const portsHash = crypto.createHash('sha256').update(JSON.stringify(ports)).digest('hex');
check('fixed-port canonical hash', portsHash, baseline.policy.portsCanonicalSha256, portsHash === baseline.policy.portsCanonicalSha256);
check('fixed-port auto-increment', ports.policy?.autoIncrement, false, ports.policy?.autoIncrement === false);
check('fixed-port host', ports.host, '127.0.0.1', ports.host === '127.0.0.1');
const assignedPorts = Object.values(ports.services ?? {}).map((entry) => entry.port);
check('fixed-port uniqueness', new Set(assignedPorts).size, assignedPorts.length, new Set(assignedPorts).size === assignedPorts.length);

for (const service of baseline.v2Services) {
  const pomPath = path.join(root, 'services', service, 'pom.xml');
  if (!fs.existsSync(pomPath)) {
    check(`${service} pom`, null, 'present', false);
    continue;
  }
  const xml = fs.readFileSync(pomPath, 'utf8');
  check(`${service} Java`, xmlTag(xml, 'java.version'), String(baseline.java.requiredMajor), xmlTag(xml, 'java.version') === String(baseline.java.requiredMajor));
  check(`${service} Spring Boot`, bootParent(xml), baseline.spring.bootVersion, bootParent(xml) === baseline.spring.bootVersion);
  check(`${service} Java enforcer`, xml.includes('enforce-java-25'), true, xml.includes('enforce-java-25'));
}

if (!staticOnly) {
  const nodeVersion = process.version.replace(/^v/, '');
  check('Node runtime', nodeVersion, baseline.node.requiredVersion, nodeVersion === baseline.node.requiredVersion, 'runtime');

  const pnpm = run('pnpm', ['--version']);
  const pnpmVersion = pnpm.status === 0 ? versionFrom(outputOf(pnpm)) : null;
  check('pnpm runtime', pnpmVersion, baseline.pnpm.requiredVersion, pnpmVersion === baseline.pnpm.requiredVersion, 'runtime');

  const java = run('java', ['-version']);
  const javaMajor = outputOf(java).match(/(?:openjdk|java) version\s+"?(\d+)/i)?.[1] ?? null;
  check('Java runtime', javaMajor, String(baseline.java.requiredMajor), java.status === 0 && javaMajor === String(baseline.java.requiredMajor), 'runtime');

  const maven = run('mvn', ['-version']);
  const mavenVersion = outputOf(maven).match(/Apache Maven\s+(\d+\.\d+\.\d+)/i)?.[1] ?? null;
  check('Maven runtime', mavenVersion, `>=${baseline.maven.minimumVersion}`, maven.status === 0 && mavenVersion !== null && compareVersions(mavenVersion, baseline.maven.minimumVersion) >= 0, 'runtime');

  const docker = run('docker', ['--version']);
  const dockerVersion = docker.status === 0 ? versionFrom(outputOf(docker)) : null;
  check('Docker CLI', dockerVersion, `>=${baseline.docker.minimumVersion}`, dockerVersion !== null && compareVersions(dockerVersion, baseline.docker.minimumVersion) >= 0, 'runtime');

  const compose = run('docker', ['compose', 'version']);
  const composeVersion = compose.status === 0 ? versionFrom(outputOf(compose)) : null;
  check('Docker Compose', composeVersion, `>=${baseline.docker.composeMinimumVersion}`, composeVersion !== null && compareVersions(composeVersion, baseline.docker.composeMinimumVersion) >= 0, 'runtime');

  const browser = browserProbe();
  const browserMajor = browser.version ? Number(browser.version.split('.')[0]) : null;
  check('Chromium browser', browser.version, `major >=${baseline.browser.minimumMajor}`, browserMajor !== null && browserMajor >= baseline.browser.minimumMajor, 'runtime');
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  platform: { os: process.platform, arch: process.arch, release: os.release() },
  mode: staticOnly ? 'static' : 'runtime',
  result: errors.length === 0 ? 'PASS' : 'FAIL',
  checks,
  errors
};
console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;
