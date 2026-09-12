import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const runtime = process.argv.includes('--runtime');
const emitIndex = process.argv.indexOf('--emit');
const emitDirectory = emitIndex >= 0 ? process.argv[emitIndex + 1] : null;
const policy = readJson('config/p1r-dependency-policy.json');
const baseline = readJson('config/toolchain-baseline.json');
const packageJson = readJson('package.json');
const errors = [];
const warnings = [];
const checks = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function sha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex');
}

function assert(name, condition, failureDetail) {
  const passed = Boolean(condition);
  checks.push({ name, passed, detail: passed ? 'verified' : failureDetail });
  if (!passed) errors.push(`${name}: ${failureDetail}`);
}

function run(command, args = []) {
  const executable = process.platform === 'win32' && ['pnpm', 'mvn', 'git'].includes(command) ? `${command}.cmd` : command;
  return spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    shell: process.platform === 'win32' && executable.endsWith('.cmd'),
    maxBuffer: 64 * 1024 * 1024
  });
}

function parseJsonOutput(output) {
  const text = String(output ?? '').trim();
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  const start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
  if (start < 0) throw new Error('command returned no JSON payload');
  return JSON.parse(text.slice(start));
}

function xmlTag(xml, tag) {
  return xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1]?.trim() ?? null;
}

function bootParent(xml) {
  return xml.match(/<parent>[\s\S]*?<artifactId>spring-boot-starter-parent<\/artifactId>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/)?.[1]?.trim() ?? null;
}

function pluginVersion(xml, artifactId) {
  return xml.match(new RegExp(`<plugin>[\\s\\S]*?<artifactId>${artifactId}<\\/artifactId>[\\s\\S]*?<version>([^<]+)<\\/version>[\\s\\S]*?<\\/plugin>`))?.[1]?.trim() ?? null;
}

function lockComponents(lockText) {
  const packagesMarker = lockText.search(/^packages:\s*$/m);
  const snapshotsMarker = lockText.search(/^snapshots:\s*$/m);
  const packagesBlock = packagesMarker >= 0
    ? lockText.slice(lockText.indexOf('\n', packagesMarker) + 1, snapshotsMarker >= 0 ? snapshotsMarker : lockText.length)
    : '';
  const components = new Map();
  for (const line of packagesBlock.split(/\r?\n/)) {
    const key = line.match(/^  (?:'([^']+)'|"([^"]+)"|([^:]+)):\s*$/)?.slice(1).find(Boolean);
    if (!key) continue;
    const normalized = key.replace(/^\//, '').split('(')[0];
    const splitAt = normalized.lastIndexOf('@');
    if (splitAt <= 0) continue;
    const packageName = normalized.slice(0, splitAt);
    const version = normalized.slice(splitAt + 1);
    if (!/^\d/.test(version)) continue;
    const group = packageName.startsWith('@') ? packageName.slice(1).split('/')[0] : undefined;
    const name = packageName.startsWith('@') ? packageName.split('/').slice(1).join('/') : packageName;
    const keyId = `${packageName}@${version}`;
    components.set(keyId, {
      type: 'library',
      ...(group ? { group } : {}),
      name,
      version,
      'bom-ref': `npm:${keyId}`,
      purl: `pkg:npm/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`
    });
  }
  return [...components.values()].sort((left, right) => left['bom-ref'].localeCompare(right['bom-ref'], 'en'));
}

function mavenDirectComponents() {
  const components = new Map();
  for (const service of baseline.v2Services) {
    const xml = fs.readFileSync(path.join(root, 'services', service, 'pom.xml'), 'utf8');
    const dependencies = xml.match(/<dependencies>[\s\S]*?<\/dependencies>/g) ?? [];
    for (const block of dependencies) {
      for (const match of block.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
        const body = match[1];
        const group = xmlTag(body, 'groupId');
        const name = xmlTag(body, 'artifactId');
        if (!group || !name) continue;
        const declaredVersion = xmlTag(body, 'version');
        const version = declaredVersion ?? `managed-by-spring-boot-${policy.catalog.springBoot}`;
        const ref = `maven:${group}:${name}@${version}`;
        components.set(ref, {
          type: 'library', group, name, version, 'bom-ref': ref,
          ...(declaredVersion ? { purl: `pkg:maven/${group}/${name}@${encodeURIComponent(declaredVersion)}` } : {}),
          properties: [{ name: 'englishflow:source', value: `services/${service}/pom.xml` }]
        });
      }
    }
  }
  return [...components.values()].sort((left, right) => left['bom-ref'].localeCompare(right['bom-ref'], 'en'));
}

function compactNodeLicenses(raw) {
  const groups = [];
  for (const [license, packages] of Object.entries(raw)) {
    groups.push({
      license,
      packages: (packages ?? []).map((entry) => ({ name: entry.name, versions: entry.versions ?? [], license: entry.license ?? license }))
        .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    });
  }
  return groups.sort((left, right) => left.license.localeCompare(right.license, 'en'));
}

function compactAudit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const advisories = Object.values(raw.advisories ?? {}).map((entry) => ({
    id: entry.id ?? entry.github_advisory_id ?? null,
    githubAdvisoryId: entry.github_advisory_id ?? null,
    module: entry.module_name ?? null,
    severity: entry.severity ?? null,
    title: entry.title ?? null,
    url: entry.url ?? null,
    vulnerableVersions: entry.vulnerable_versions ?? null,
    patchedVersions: entry.patched_versions ?? null,
    findings: (entry.findings ?? []).map((finding) => ({ version: finding.version, paths: finding.paths ?? [] }))
  })).sort((left, right) => String(left.id).localeCompare(String(right.id), 'en'));
  return {
    vulnerabilities: raw.metadata?.vulnerabilities ?? null,
    totalDependencies: raw.metadata?.totalDependencies ?? null,
    advisories
  };
}

function containsDeniedLicense(expression) {
  return policy.licenses.denied.some((denied) => new RegExp(`(^|[^A-Za-z0-9.-])${denied.replaceAll('.', '\\.')}(?=$|[^A-Za-z0-9.-])`).test(expression));
}

for (const relativePath of Object.values(policy.manifests)) {
  assert(`manifest ${relativePath}`, fs.existsSync(path.join(root, relativePath)), 'required manifest is missing');
}
assert('packageManager pin', packageJson.packageManager === `pnpm@${policy.catalog.pnpm}`, `expected pnpm@${policy.catalog.pnpm}`);
assert('Node engine pin', packageJson.engines?.node === policy.catalog.node, `expected ${policy.catalog.node}`);
assert('pnpm engine pin', packageJson.engines?.pnpm === policy.catalog.pnpm, `expected ${policy.catalog.pnpm}`);
assert('Node catalog', baseline.node.requiredVersion === policy.catalog.node, 'toolchain and dependency catalogs differ');
assert('Java catalog', baseline.java.requiredMajor === policy.catalog.java, 'toolchain and dependency catalogs differ');
assert('Spring Boot catalog', baseline.spring.bootVersion === policy.catalog.springBoot, 'toolchain and dependency catalogs differ');
assert('Spring Cloud catalog', baseline.spring.cloudReleaseTrain === policy.catalog.springCloud, 'toolchain and dependency catalogs differ');

const rootPom = fs.readFileSync(path.join(root, 'pom.xml'), 'utf8');
for (const [tag, expected] of [
  ['java.version', String(policy.catalog.java)],
  ['spring-boot.version', policy.catalog.springBoot],
  ['spring-cloud.version', policy.catalog.springCloud],
  ['maven-enforcer-plugin.version', policy.catalog.mavenEnforcerPlugin],
  ['cyclonedx-maven-plugin.version', policy.catalog.cycloneDxMavenPlugin]
]) {
  assert(`reactor ${tag}`, xmlTag(rootPom, tag) === expected, `expected ${expected}`);
}

for (const service of baseline.v2Services) {
  const relativePom = `services/${service}/pom.xml`;
  const xml = fs.readFileSync(path.join(root, relativePom), 'utf8');
  assert(`${service} Boot pin`, bootParent(xml) === policy.catalog.springBoot, `expected ${policy.catalog.springBoot}`);
  assert(`${service} Java pin`, xmlTag(xml, 'java.version') === String(policy.catalog.java), `expected ${policy.catalog.java}`);
  assert(`${service} Enforcer pin`, pluginVersion(xml, 'maven-enforcer-plugin') === policy.catalog.mavenEnforcerPlugin, `expected ${policy.catalog.mavenEnforcerPlugin}`);
  assert(`${service} reactor membership`, rootPom.includes(`<module>services/${service}</module>`), 'service is absent from root reactor');
}
const gatewayPom = fs.readFileSync(path.join(root, 'services', 'api-gateway', 'pom.xml'), 'utf8');
assert('Gateway Spring Cloud pin', xmlTag(gatewayPom, 'spring-cloud.version') === policy.catalog.springCloud, `expected ${policy.catalog.springCloud}`);

const lockText = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
const lockVersion = lockText.match(/^lockfileVersion:\s*['"]?([^'"\r\n]+)['"]?/m)?.[1]?.trim();
assert('pnpm lock format', lockVersion === baseline.pnpm.lockfileVersion, `expected ${baseline.pnpm.lockfileVersion}`);
const nodeComponents = lockComponents(lockText);
const javaComponents = mavenDirectComponents();
assert('Node lock inventory', nodeComponents.length > 0, 'no package entries were extracted from pnpm-lock.yaml');
assert('Maven direct inventory', javaComponents.length > 0, 'no dependencies were extracted from v2 service POMs');

let licenseGroups = [];
const licenseProbe = run('pnpm', ['licenses', 'list', '--json']);
if (licenseProbe.status !== 0) {
  errors.push(`Node license inventory failed: ${String(licenseProbe.stderr || licenseProbe.stdout).trim() || 'pnpm returned no diagnostics'}`);
} else {
  try {
    licenseGroups = compactNodeLicenses(parseJsonOutput(licenseProbe.stdout));
  } catch (error) {
    errors.push(`Node license inventory is not valid JSON: ${error.message}`);
  }
}
const deniedLicenseGroups = licenseGroups.filter((entry) => containsDeniedLicense(entry.license));
const unknownLicenseGroups = licenseGroups.filter((entry) => !entry.license || /unknown|unlicensed|see license/i.test(entry.license));
const licensedNodeComponents = new Set(licenseGroups.flatMap((entry) => entry.packages.flatMap((item) => item.versions.map((version) => `${item.name}@${version}`))));
assert('Node lock/license coverage', nodeComponents.length >= licensedNodeComponents.size, `lock inventory ${nodeComponents.length} is smaller than resolved license inventory ${licensedNodeComponents.size}`);
if (deniedLicenseGroups.length > 0) errors.push(`Denied Node licenses: ${deniedLicenseGroups.map((entry) => entry.license).join(', ')}`);
if (unknownLicenseGroups.length > 0) warnings.push(`Unknown Node licenses require review: ${unknownLicenseGroups.map((entry) => entry.license).join(', ')}`);

let vulnerability = { checked: false, result: 'NOT_RUN', reason: 'Run with --runtime in CI with registry access.' };
let mavenSbom = { checked: false, result: 'NOT_RUN', reason: 'Run with --runtime under Java 25.' };
let mavenLicenseReport = { checked: false, result: 'NOT_RUN', groups: [], denied: [], unknown: [] };
if (runtime) {
  const audit = run('pnpm', ['audit', '--json']);
  let auditPayload = null;
  try { auditPayload = parseJsonOutput(audit.stdout); } catch { /* the command status stays authoritative */ }
  // `pnpm audit` exits non-zero for advisories at ANY severity; --audit-level only filters what
  // is printed. The dependency policy fails on high/critical only, so the decision has to come
  // from the reported severities rather than the raw exit code. A payload that cannot be parsed
  // (registry unavailable) keeps the exit code authoritative, so the check stays fail-closed.
  const severityCounts = auditPayload?.metadata?.vulnerabilities ?? null;
  const blockingVulnerabilities = severityCounts
    ? Number(severityCounts.high ?? 0) + Number(severityCounts.critical ?? 0)
    : null;
  const auditPassed = blockingVulnerabilities === null ? audit.status === 0 : blockingVulnerabilities === 0;
  vulnerability = {
    checked: true,
    result: auditPassed ? 'PASS' : 'FAIL',
    exitCode: audit.status,
    policy: policy.policy.highOrCriticalVulnerability,
    blockingVulnerabilities,
    payload: compactAudit(auditPayload)
  };
  if (!auditPassed) {
    errors.push(blockingVulnerabilities === null
      ? 'pnpm audit returned no parsable report; treating the registry result as unavailable'
      : `pnpm audit found ${blockingVulnerabilities} high/critical vulnerability(ies)`);
  }

  const goal = policy.sbom.mavenGoal;
  const maven = run('mvn', ['--batch-mode', '--no-transfer-progress', '-f', 'pom.xml', '-DskipTests', '-DoutputFormat=json', '-DoutputName=bom', goal]);
  const bomPath = path.join(root, 'target', 'bom.json');
  mavenSbom = {
    checked: true,
    result: maven.status === 0 && fs.existsSync(bomPath) ? 'PASS' : 'FAIL',
    exitCode: maven.status,
    path: fs.existsSync(bomPath) ? 'target/bom.json' : null,
    diagnostics: maven.status === 0 ? null : String(maven.stderr || maven.stdout).trim().slice(-4000)
  };
  if (mavenSbom.result !== 'PASS') {
    errors.push('Maven CycloneDX generation failed or did not produce target/bom.json');
  } else {
    try {
      const bom = JSON.parse(fs.readFileSync(bomPath, 'utf8'));
      const groups = new Map();
      const unknown = [];
      for (const component of bom.components ?? []) {
        const expressions = (component.licenses ?? []).map((entry) => entry.expression ?? entry.license?.id ?? entry.license?.name).filter(Boolean);
        const coordinate = `${component.group ?? ''}:${component.name}@${component.version}`;
        if (expressions.length === 0) unknown.push(coordinate);
        for (const expression of expressions) {
          if (!groups.has(expression)) groups.set(expression, []);
          groups.get(expression).push(coordinate);
        }
      }
      const compactGroups = [...groups.entries()].map(([license, components]) => ({ license, components: components.sort() }))
        .sort((left, right) => left.license.localeCompare(right.license, 'en'));
      const denied = compactGroups.filter((entry) => containsDeniedLicense(entry.license)).map((entry) => entry.license);
      mavenLicenseReport = {
        checked: true,
        result: denied.length > 0 ? 'FAIL' : unknown.length > 0 ? 'REVIEW' : 'PASS',
        groups: compactGroups,
        denied,
        unknown: unknown.sort()
      };
      mavenSbom.components = (bom.components ?? []).length;
      mavenSbom.componentsWithLicense = (bom.components ?? []).length - unknown.length;
      if (denied.length > 0) errors.push(`Denied Maven licenses: ${denied.join(', ')}`);
      if (unknown.length > 0) warnings.push(`${unknown.length} Maven components have no license metadata`);
    } catch (error) {
      errors.push(`Maven SBOM license analysis failed: ${error.message}`);
    }
  }
} else {
  warnings.push('Maven transitive license resolution was not run in static mode');
}

const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
const sourceCommit = process.env.GITHUB_SHA || (git.status === 0 ? git.stdout.trim() : 'unknown');
const generatedAt = new Date().toISOString();
const nodeSbom = {
  bomFormat: 'CycloneDX',
  specVersion: policy.sbom.specVersion,
  version: 1,
  metadata: {
    timestamp: generatedAt,
    tools: [{ vendor: 'EnglishFlow', name: 'p1r-dependency-audit', version: '1' }],
    properties: [
      { name: 'englishflow:sourceCommit', value: sourceCommit },
      { name: 'englishflow:lockSha256', value: sha256('pnpm-lock.yaml') }
    ]
  },
  components: nodeComponents
};

const licenseReport = {
  schemaVersion: 1,
  generatedAt,
  sourceCommit,
  policy: { denied: policy.licenses.denied, unknown: policy.policy.unknownLicense },
  result: deniedLicenseGroups.length > 0 || mavenLicenseReport.result === 'FAIL'
    ? 'FAIL'
    : unknownLicenseGroups.length > 0 || mavenLicenseReport.result !== 'PASS' ? 'REVIEW' : 'PASS',
  groups: licenseGroups,
  denied: deniedLicenseGroups.map((entry) => entry.license),
  unknown: unknownLicenseGroups.map((entry) => entry.license),
  maven: mavenLicenseReport
};

const report = {
  schemaVersion: 1,
  generatedAt,
  sourceCommit,
  mode: runtime ? 'runtime' : 'static',
  result: errors.length === 0 ? (warnings.length === 0 ? 'PASS' : 'REVIEW') : 'FAIL',
  catalog: policy.catalog,
  hashes: {
    packageJson: sha256('package.json'),
    pnpmLock: sha256('pnpm-lock.yaml'),
    reactorPom: sha256('pom.xml'),
    toolchainBaseline: sha256('config/toolchain-baseline.json'),
    dependencyPolicy: sha256('config/p1r-dependency-policy.json')
  },
  inventory: { nodeLockedComponents: nodeComponents.length, mavenDirectComponents: javaComponents.length },
  licenses: {
    result: licenseReport.result,
    nodeGroups: licenseGroups.length,
    mavenGroups: mavenLicenseReport.groups.length,
    denied: [...licenseReport.denied, ...mavenLicenseReport.denied],
    unknownNodeGroups: licenseReport.unknown,
    unknownMavenComponents: mavenLicenseReport.unknown.length
  },
  vulnerability,
  mavenSbom,
  checks,
  warnings,
  errors
};

if (emitDirectory) {
  const output = path.resolve(root, emitDirectory);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'dependency-governance.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(output, 'sbom-node.cdx.json'), `${JSON.stringify(nodeSbom, null, 2)}\n`);
  fs.writeFileSync(path.join(output, 'license-audit.json'), `${JSON.stringify(licenseReport, null, 2)}\n`);
  fs.writeFileSync(path.join(output, 'maven-direct-inventory.cdx.json'), `${JSON.stringify({
    bomFormat: 'CycloneDX', specVersion: policy.sbom.specVersion, version: 1,
    metadata: { timestamp: generatedAt, properties: [{ name: 'englishflow:sourceCommit', value: sourceCommit }] },
    components: javaComponents
  }, null, 2)}\n`);
  const resolvedMavenBom = path.join(root, 'target', 'bom.json');
  if (fs.existsSync(resolvedMavenBom)) fs.copyFileSync(resolvedMavenBom, path.join(output, 'sbom-maven.cdx.json'));
}

console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;
