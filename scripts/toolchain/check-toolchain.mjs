import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const configPath = path.join(root, 'config', 'toolchain-baseline.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const staticOnly = process.argv.includes('--static-only');
const requireRuntime = process.argv.includes('--require-runtime') || !staticOnly;

const result = {
  static: { passed: true, services: [] },
  runtime: { checked: !staticOnly, passed: true, java: null, maven: null },
  errors: [],
  warnings: []
};

function error(message) {
  result.errors.push(message);
  result.static.passed = false;
}

function tagValue(xml, tag) {
  return xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1]?.trim() ?? null;
}

function parentBootVersion(xml) {
  const parent = xml.match(/<parent>[\s\S]*?<artifactId>spring-boot-starter-parent<\/artifactId>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/);
  return parent?.[1]?.trim() ?? null;
}

for (const service of config.v2Services) {
  const pomPath = path.join(root, 'services', service, 'pom.xml');
  if (!fs.existsSync(pomPath)) {
    error(`${service}: 缺少 pom.xml`);
    continue;
  }
  const xml = fs.readFileSync(pomPath, 'utf8');
  const java = tagValue(xml, 'java.version');
  const release = tagValue(xml, 'maven.compiler.release');
  const boot = parentBootVersion(xml);
  const hasEnforcer = xml.includes('enforce-java-25') && xml.includes('<requireJavaVersion>');
  const item = { service, java, release, boot, hasEnforcer };
  result.static.services.push(item);
  if (java !== String(config.java.requiredMajor)) error(`${service}: java.version 必须为 ${config.java.requiredMajor}，当前 ${java ?? 'missing'}`);
  if (release && release !== String(config.java.requiredMajor)) error(`${service}: maven.compiler.release 必须为 ${config.java.requiredMajor}，当前 ${release}`);
  if (boot !== config.spring.bootVersion) error(`${service}: Spring Boot parent 必须为 ${config.spring.bootVersion}，当前 ${boot ?? 'missing'}`);
  if (!hasEnforcer) error(`${service}: 缺少 Java 25 Maven Enforcer 约束`);
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
  });
}

function parseMajor(output) {
  const match = output.match(/(?:version|openjdk|java)\s+"?(\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseMavenVersion(output) {
  const match = output.match(/Apache Maven\s+(\d+\.\d+\.\d+)/i);
  return match?.[1] ?? null;
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}

if (!staticOnly) {
  const javaProbe = run('java', ['-version']);
  const javaOutput = `${javaProbe.stdout ?? ''}\n${javaProbe.stderr ?? ''}`;
  const javaMajor = javaProbe.status === 0 ? parseMajor(javaOutput) : null;
  result.runtime.java = { status: javaProbe.status, major: javaMajor };
  if (javaProbe.status !== 0 || javaMajor !== config.java.requiredMajor) {
    result.runtime.passed = false;
    result.errors.push(`运行时 Java 必须为 ${config.java.requiredMajor}，当前 ${javaMajor ?? 'unavailable'}`);
  }

  const mavenCommand = process.platform === 'win32' ? 'mvn.cmd' : 'mvn';
  const mavenProbe = run(mavenCommand, ['-version']);
  const mavenOutput = `${mavenProbe.stdout ?? ''}\n${mavenProbe.stderr ?? ''}`;
  const mavenVersion = mavenProbe.status === 0 ? parseMavenVersion(mavenOutput) : null;
  result.runtime.maven = { status: mavenProbe.status, version: mavenVersion };
  if (mavenProbe.status !== 0 || !mavenVersion || compareVersions(mavenVersion, config.maven.minimumVersion) < 0) {
    result.runtime.passed = false;
    result.errors.push(`运行时 Maven 必须 >= ${config.maven.minimumVersion}，当前 ${mavenVersion ?? 'unavailable'}`);
  }
}

if (requireRuntime && !result.runtime.passed) result.errors.push('B15 运行时工具链未满足；不得伪造 Java/Maven 构建通过');
if (result.errors.length > 0) result.runtime.passed = result.runtime.passed && !requireRuntime;

console.log(JSON.stringify({
  result: result.errors.length === 0 ? 'PASS' : (staticOnly && result.static.passed ? 'STATIC_PASS_RUNTIME_BLOCKED' : 'FAIL'),
  baseline: { java: config.java.requiredMajor, maven: config.maven.minimumVersion, springBoot: config.spring.bootVersion, services: config.v2Services.length },
  static: result.static,
  runtime: result.runtime,
  errors: result.errors,
  warnings: result.warnings
}, null, 2));

if (result.static.passed && (!requireRuntime || result.runtime.passed)) process.exit(0);
process.exitCode = 1;
