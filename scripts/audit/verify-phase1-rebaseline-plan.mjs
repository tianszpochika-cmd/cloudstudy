import fs from 'node:fs';
import path from 'node:path';
import { parseDependencyCell } from './p1r-evidence-gate.mjs';

const root = process.cwd();
const planDir = path.join(root, 'requirements', 'backlog', 'v2-phase1-rebaseline');
const operationDir = path.join(root, 'docs', '06-design', 'v2-980plus', 'phase1-business-operation');

const requiredPlanDocs = [
  'README.md',
  '00-现状基线与复用策略.md',
  '01-里程碑与依赖图.md',
  '02-编号任务台账.md',
  '03-阶段验收与Evidence标准.md',
  '04-追溯覆盖矩阵.md',
];

const expectedMilestoneCounts = {
  M0: 8,
  M1: 18,
  M2: 10,
  M3: 10,
  M4: 10,
  M5: 14,
  M6: 11,
  M7: 11,
  M8: 16,
};

const allowedTaskStatuses = new Set([
  'PLANNED',
  'READY',
  'IN_PROGRESS',
  'REVIEW',
  'ACCEPTED',
  'BLOCKED',
  'REWORK',
]);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`missing file: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function unique(values) {
  return [...new Set(values)];
}

function collect(text, pattern, group = 1) {
  return [...text.matchAll(pattern)].map((match) => match[group]);
}

function verifyCoverage(label, sourceIds, coverageText) {
  const missing = sourceIds.filter((id) => !coverageText.includes(id));
  if (missing.length) fail(`${label} missing from coverage matrix: ${missing.join(', ')}`);
}

for (const document of requiredPlanDocs) {
  const fullPath = path.join(planDir, document);
  if (!fs.existsSync(fullPath)) fail(`missing plan document: ${document}`);
  if (fs.statSync(fullPath).size === 0) fail(`empty plan document: ${document}`);
}

const registry = read('requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md');
const coverage = read('requirements/backlog/v2-phase1-rebaseline/04-追溯覆盖矩阵.md');
const planReadme = read('requirements/backlog/v2-phase1-rebaseline/README.md');

const taskRows = registry
  .split(/\r?\n/)
  .filter((line) => /^\|\s*`P1R-M\d-\d{3}`\s*\|/.test(line));
const taskIds = taskRows.map((line) => line.match(/^\|\s*`(P1R-M\d-\d{3})`\s*\|/)[1]);

if (taskIds.length !== 108) fail(`expected 108 task rows, got ${taskIds.length}`);
const duplicateTaskIds = taskIds.filter((id, index) => taskIds.indexOf(id) !== index);
if (duplicateTaskIds.length) fail(`duplicate task IDs: ${unique(duplicateTaskIds).join(', ')}`);

for (const line of taskRows) {
  const columns = line.slice(1, -1).split('|').map((column) => column.trim());
  if (columns.length !== 8) fail(`task row must have 8 columns: ${line}`);
  if (columns.some((column) => !column)) fail(`task row has an empty required column: ${line}`);
  const status = columns[7].match(/^`([A-Z_]+)`$/)?.[1];
  if (!status || !allowedTaskStatuses.has(status)) {
    fail(`invalid task status: ${columns[0]}=${columns[7]}`);
  }
  let dependencies;
  try {
    dependencies = parseDependencyCell(columns[4]);
  } catch (error) {
    fail(`${columns[0]} has invalid dependencies: ${error.message}`);
  }
  for (const dependency of dependencies) {
    if (!taskIds.includes(dependency)) fail(`unknown dependency ${dependency} in ${columns[0]}`);
  }
}

const statusCounts = {};
for (const line of taskRows) {
  const columns = line.slice(1, -1).split('|').map((column) => column.trim());
  const status = columns[7].slice(1, -1);
  statusCounts[status] = (statusCounts[status] ?? 0) + 1;
}

const actualMilestoneCounts = {};
for (const id of taskIds) {
  const milestone = id.match(/^P1R-(M\d)-/)[1];
  actualMilestoneCounts[milestone] = (actualMilestoneCounts[milestone] ?? 0) + 1;
}
for (const [milestone, expected] of Object.entries(expectedMilestoneCounts)) {
  if (actualMilestoneCounts[milestone] !== expected) {
    fail(`${milestone} expected ${expected} tasks, got ${actualMilestoneCounts[milestone] ?? 0}`);
  }
}

const operationFiles = fs.readdirSync(operationDir)
  .filter((file) => file.endsWith('.md'))
  .map((file) => fs.readFileSync(path.join(operationDir, file), 'utf8'));
const operationText = operationFiles.join('\n');

const actorText = fs.readFileSync(path.join(operationDir, '01-角色系统边界与业务总图.md'), 'utf8');
const journeyText = fs.readFileSync(path.join(operationDir, '02-端到端业务旅程台账.md'), 'utf8');
const pageText = fs.readFileSync(path.join(operationDir, '03-全端页面功能登记册.md'), 'utf8');
const ruleText = fs.readFileSync(path.join(operationDir, '04-学习机制与学习引擎规则.md'), 'utf8');
const integrationText = fs.readFileSync(path.join(operationDir, '06-业务联调矩阵.md'), 'utf8');
const e2eText = fs.readFileSync(path.join(operationDir, '08-验收与追溯规范.md'), 'utf8');

const registries = {
  actors: unique(collect(actorText, /^\|\s*`(ACT-P1-[A-Z0-9-]+)`\s*\|/gm)),
  journeys: unique(collect(journeyText, /^###\s+(JNY-P1-\d{2})\b/gm)),
  pages: unique(collect(pageText, /^\|\s*(PAGE-P1-[A-Z0-9-]+)\s*\|/gm)),
  rules: unique(collect(ruleText, /^\|\s*`(RULE-P1-[A-Z0-9-]+)`\s*\|/gm)),
  integrations: unique(collect(integrationText, /^\|\s*`(INT-P1-\d{3})`\s+/gm)),
  e2e: unique(collect(e2eText, /^\|\s*`(E2E-P1-[A-Z0-9-]+)`\s*\|/gm)),
};

const expectedRegistryCounts = {
  actors: 13,
  journeys: 15,
  pages: 56,
  rules: 8,
  integrations: 18,
  e2e: 16,
};
for (const [name, ids] of Object.entries(registries)) {
  if (ids.length !== expectedRegistryCounts[name]) {
    fail(`${name} source registry expected ${expectedRegistryCounts[name]}, got ${ids.length}`);
  }
  verifyCoverage(name, ids, coverage);
}

const gapIds = unique(operationText.match(/(?:CONTRACT|EVENT|IMPLEMENTATION|EVIDENCE)-GAP(?:-[A-Z0-9]+)+/g) ?? []);
const gapCounts = {
  contract: gapIds.filter((id) => id.startsWith('CONTRACT-')).length,
  event: gapIds.filter((id) => id.startsWith('EVENT-')).length,
  implementation: gapIds.filter((id) => id.startsWith('IMPLEMENTATION-')).length,
  evidence: gapIds.filter((id) => id.startsWith('EVIDENCE-')).length,
};
const expectedGapCounts = { contract: 24, event: 16, implementation: 2, evidence: 3 };
for (const [type, expected] of Object.entries(expectedGapCounts)) {
  if (gapCounts[type] !== expected) fail(`${type} GAP count expected ${expected}, got ${gapCounts[type]}`);
}
verifyCoverage('GAP', gapIds, coverage);

for (const marker of [
  'b01505a71f8b6f980d63cd58e3c3687e59daa13a',
  'V2-980-0001…0540',
  'D1', 'D2', 'D3', 'D4', 'D5',
  'historical-candidate',
  'Contract/Data/Security first',
  '生产支付', 'OFF',
  'Phase 2', 'Phase 3',
  'LOCAL-TEST-NO-PASS',
]) {
  if (!`${planReadme}\n${registry}\n${coverage}`.includes(marker)) fail(`required plan marker missing: ${marker}`);
}

const authorityFiles = [
  'AGENTS.md',
  'requirements/README.md',
  'requirements/acceptance-criteria.md',
  'requirements/backlog/README.md',
  'requirements/backlog/DoD-Gate与证据包规范.md',
  'docs/00-vision/document-governance.md',
  'docs/02-architecture/v2-platform-capability-matrix.md',
  'docs/06-design/v2-980plus/README.md',
  'docs/09-roadmap/roadmap.md',
  'docs/10-decisions/0007-phase1-scope-and-development-governance.md',
  'requirements/backlog/Phase-1范围冻结与跨文档基线.md',
  'requirements/backlog/开发实施总纲与功能链条任务分解.md',
  'requirements/backlog/Agent开发SOP与状态流转模板.md',
  'requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md',
  'requirements/backlog/v2-B23plus-Phase1-真实运行与实机测试任务基线.md',
  'requirements/backlog/v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md',
  'requirements/backlog/G0-G4-治理门禁任务基线.md',
  'requirements/backlog/Agent开发状态总报表.md',
];
for (const file of authorityFiles) {
  const text = read(file);
  if (!text.includes('v2-phase1-rebaseline')) fail(`plan authority link missing from ${file}`);
}

for (const file of [
  'requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md',
  'requirements/backlog/v2-B23plus-Phase1-真实运行与实机测试任务基线.md',
  'requirements/backlog/v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md',
  'requirements/backlog/G0-G4-治理门禁任务基线.md',
]) {
  const text = read(file);
  if (!text.includes('Historical / Superseded')) fail(`historical boundary missing from ${file}`);
}

console.log(JSON.stringify({
  result: 'PASS',
  planVersion: 'v1.0',
  baselineCommit: 'b01505a71f8b6f980d63cd58e3c3687e59daa13a',
  taskCount: taskIds.length,
  milestoneCounts: actualMilestoneCounts,
  operationCoverage: Object.fromEntries(
    Object.entries(registries).map(([name, ids]) => [name, ids.length]),
  ),
  gapCounts,
  statusCounts,
  initialStatus: statusCounts.PLANNED === taskIds.length ? 'PLANNED' : 'MIXED',
}, null, 2));
