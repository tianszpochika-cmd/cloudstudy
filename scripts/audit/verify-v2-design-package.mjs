import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', '06-design', 'v2-980plus');
const registerPath = path.join(outDir, '08-980plus-功能点设计登记册.md');
const matrixPath = path.join(root, 'requirements', 'feature-matrix.md');
const refinementStatus = '待细化签收';

const requiredDocs = [
  'README.md',
  '00-版本基线与980+计数口径.md',
  '01-统一交互与页面状态设计.md',
  '02-全端信息架构与交互模式.md',
  '03-Phase1-学习闭环功能设计.md',
  '04-Phase1-成长社群商业后台功能设计.md',
  '05-Phase2-AI成人高级能力功能设计.md',
  '06-Phase3-K12合规与教师机构功能设计.md',
  '07-跨域契约数据事件与验收设计.md',
  '08-980plus-功能点设计登记册.md',
  '09-追溯与验收矩阵.md',
  '10-设计评审与未决项.md',
  '12-架构与设计一致性审核.md',
];

const expectedPhaseCounts = { 'Phase 1': 540, 'Phase 2': 228, 'Phase 3': 212 };
const expectedDomainCounts = {
  ONB: 32, VOC: 70, GRM: 54, LST: 42, RDG: 38, SPK: 52, WRT: 44, ASM: 80,
  GAM: 92, SOC: 38, USR: 64, INF: 74, COM: 46, ADM: 74, AI2: 68, K12: 62, CROSS: 50,
};
const expectedStatusCounts = { explicit: 184, atomic: 486, pending: 310 };
const expectedBusinessCount = 930;
const expectedCrossCount = 50;
const expectedAudioSource = '0.5x~2.0x 连续变速，快捷档 0.5/0.75/1/1.25/1.5/2，保持音高';
const legacyAudioSourcePattern = /0\.75x\s*\/\s*1\.0x\s*\/\s*1\.25x\s*\/\s*1\.5x/;
const legacyHardSrsSchedulePattern = /间隔梯度按\s*1天\s*->\s*3天\s*->\s*7天\s*->\s*15天\s*->\s*30天\s*->\s*90天\s*递进排程/;

function unescapeCell(value) {
  return String(value ?? '').replaceAll('\\|', '|').trim();
}

function splitCells(line) {
  return line.split('|').slice(1, -1).map(unescapeCell);
}

function fail(message) {
  throw new Error(message);
}

function countBy(items, index) {
  const counts = {};
  for (const item of items) counts[item[index]] = (counts[item[index]] ?? 0) + 1;
  return counts;
}

function main() {
  for (const document of requiredDocs) {
    if (!fs.existsSync(path.join(outDir, document))) fail(`missing required document: ${document}`);
  }
  const register = fs.readFileSync(registerPath, 'utf8');
  const rows = register.split(/\r?\n/)
    .filter((line) => /^\|\s*V2-980-\d{4}\s*\|/.test(line))
    .map(splitCells);
  if (rows.length !== 980) fail(`expected 980 register rows, got ${rows.length}`);

  const ids = rows.map((row) => row[0]);
  ids.forEach((id, index) => {
    const expected = `V2-980-${String(index + 1).padStart(4, '0')}`;
    if (id !== expected) fail(`non-contiguous register id at row ${index + 1}: ${id}, expected ${expected}`);
  });

  const phaseCounts = countBy(rows, 1);
  for (const [phase, expected] of Object.entries(expectedPhaseCounts)) {
    if (phaseCounts[phase] !== expected) fail(`${phase} expected ${expected}, got ${phaseCounts[phase] ?? 0}`);
  }
  const domainCounts = countBy(rows, 2);
  for (const [domain, expected] of Object.entries(expectedDomainCounts)) {
    if (domainCounts[domain] !== expected) fail(`${domain} expected ${expected}, got ${domainCounts[domain] ?? 0}`);
  }

  const requiredFields = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const missingFields = [];
  for (const [index, row] of rows.entries()) {
    for (const field of requiredFields) {
      if (!row[field]) missingFields.push(`row ${index + 1}, column ${field + 1}`);
    }
    const sourceId = row[4];
    if (!/^(FEAT-[A-Z0-9]+-\d{3}|PRD-ATOM-\d{4}|V2-EXT-[A-Z0-9-]+)$/.test(sourceId)) fail(`invalid source id ${sourceId} at row ${index + 1}`);
    if (row[16] === refinementStatus && !sourceId.startsWith('V2-EXT-')) fail(`pending row without V2-EXT source at row ${index + 1}`);
    if (row[16] !== refinementStatus && sourceId.startsWith('V2-EXT-')) fail(`non-pending row has V2-EXT source at row ${index + 1}`);
    if (row[1] === 'Phase 1' && ['AI2', 'K12'].includes(row[2])) fail(`Phase 1 row enters AI2/K12 at row ${index + 1}`);
    if (row[1] === 'Phase 2' && row[2] === 'K12') fail(`Phase 2 row enters K12 at row ${index + 1}`);
    if (row[1] === 'Phase 3' && row[2] === 'AI2') fail(`Phase 3 row enters AI2 at row ${index + 1}`);
  }
  if (missingFields.length) fail(`missing required register fields: ${missingFields.slice(0, 8).join(', ')}`);

  const phaseOneAdultGateRows = rows.filter((row) => row[1] === 'Phase 1'
    && row[2] === 'USR'
    && /儿童账号|家长账号|监护人绑定|未成年人支付|K12 学习目标/.test(row[3]));
  for (const row of phaseOneAdultGateRows) {
    if (!/Phase 1 禁止/.test(row[3]) || !/AGE_REJECTED|年龄 Gate/.test(row[10])) {
      fail(`Phase 1 adult-only gate is represented as a child feature: ${row[0]}`);
    }
  }

  const matrix = fs.readFileSync(matrixPath, 'utf8');
  const explicitIds = [...matrix.matchAll(/^\|\s*\*\*(FEAT-[A-Z0-9]+-\d{3})\*\*/gm)].map((match) => match[1]);
  const registerSources = new Set(rows.map((row) => row[4]));
  const missingExplicit = explicitIds.filter((id) => !registerSources.has(id));
  if (missingExplicit.length) fail(`explicit FEAT ids missing from v2 register: ${missingExplicit.slice(0, 10).join(', ')}`);

  const allText = requiredDocs.map((document) => fs.readFileSync(path.join(outDir, document), 'utf8')).join('\n');
  for (const marker of [
    '唯一全量业务设计与需求落地基线', 'Idempotency-Key', 'AdaptivePerformanceEngine',
    'apps/mobile', 'apps/learner-web', 'apps/admin-web', 'apps/official-site',
    'Phase 1', 'Phase 2', 'Phase 3', 'ST-', 'V2-EXT-', 'PRD-ATOM-', 'FEAT-',
    'content-service', 'assessment-service', 'learning-service',
    '930 个业务域设计单元', '50 个跨域扩展登记位',
    '184 条显式功能包已设计', '486 条 PRD 原子证据已映射', '310 条待细化签收',
    'P0 仅上线 1 款学习游戏：拼句小火车', 'P1 扩展至总计 4 款', '6~8 款是长期目标',
    '0.5x~2.0x 连续变速，快捷档 0.5/0.75/1/1.25/1.5/2，保持音高',
    '艾宾浩斯记忆曲线解释与展示', 'nextReviewAt', 'algorithmVersion',
    'provider', '沙盒', '生产开关默认关闭', '自有、开放许可或合法授权', '2026-08-29',
  ]) {
    if (!allText.includes(marker)) fail(`required design marker missing: ${marker}`);
  }
  if (allText.includes('v1 文档继续作为已冻结的领域事实源')) fail('v1 must not remain the v2 design source of truth');
  if (legacyAudioSourcePattern.test(allText)) fail('legacy audio speed phrase remains in generated v2 design package');
  if (legacyHardSrsSchedulePattern.test(allText)) fail('legacy hard SRS schedule remains in generated v2 design package');
  if (allText.includes('六大游戏')) fail('legacy six-game label remains in generated v2 design package');
  for (const legacyMarker of ['权威官方词库', '柯林斯/牛津']) {
    if (allText.includes(legacyMarker)) fail(`legacy content wording remains in generated v2 design package: ${legacyMarker}`);
  }
  const pendingCount = rows.filter((row) => row[16] === refinementStatus).length;
  const explicitCount = rows.filter((row) => row[16] === '显式功能包已设计').length;
  const atomicCount = rows.filter((row) => row[16] === 'PRD 原子证据已映射').length;
  const businessCount = Object.entries(domainCounts)
    .filter(([domain]) => domain !== 'CROSS')
    .reduce((total, [, count]) => total + count, 0);
  if (businessCount !== expectedBusinessCount || domainCounts.CROSS !== expectedCrossCount) {
    fail(`unexpected business/cross counts: business=${businessCount}, cross=${domainCounts.CROSS ?? 0}`);
  }
  if (explicitCount !== expectedStatusCounts.explicit
    || atomicCount !== expectedStatusCounts.atomic
    || pendingCount !== expectedStatusCounts.pending
    || explicitCount !== explicitIds.length
    || explicitCount + atomicCount + pendingCount !== rows.length) {
    fail(`unexpected status counts: explicit=${explicitCount}, atomic=${atomicCount}, pending=${pendingCount}, matrixExplicit=${explicitIds.length}`);
  }
  const audioRows = rows.filter((row) => row[4] === 'PRD-ATOM-0358');
  if (audioRows.length !== 1) fail(`expected one PRD-ATOM-0358 row, got ${audioRows.length}`);
  const audioRow = audioRows[0];
  if (audioRow[3] !== expectedAudioSource) fail(`PRD-ATOM-0358 source mismatch: ${audioRow[3]}`);
  if (!audioRow[5].includes('PRD §8.1') || /requirements\/product-requirements\.md:\d+/.test(audioRow[5])) {
    fail(`PRD-ATOM-0358 must use stable PRD §8.1 anchor: ${audioRow[5]}`);
  }

  console.log(JSON.stringify({
    result: 'PASS',
    registerRows: rows.length,
    phaseCounts,
    domainCounts,
    statusCounts: { explicit: explicitCount, atomic: atomicCount, pending: pendingCount },
    explicitFeatureIds: explicitIds.length,
    requiredDocs: requiredDocs.length,
  }, null, 2));
}

main();
