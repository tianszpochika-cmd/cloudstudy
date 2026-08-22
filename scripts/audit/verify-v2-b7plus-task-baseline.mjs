import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const baseline = read('requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md');
const register = read('docs/06-design/v2-980plus/08-980plus-功能点设计登记册.md');
const taskIds = baseline
  .split(/\r?\n/)
  .map((line) => line.match(/^\|\s*(V2-B(\d+)-[A-Z0-9]+-\d{3})\s*\|/))
  .filter(Boolean)
  .map((match) => match[1]);
const taskCounts = Object.fromEntries([...Array(10)].map((_, index) => [String(index + 7), 0]));
for (const taskId of taskIds) {
  const batch = taskId.match(/^V2-B(\d+)-/)?.[1];
  if (batch in taskCounts) taskCounts[batch] += 1;
}

const expectedCounts = {
  7: 7,
  8: 7,
  9: 7,
  10: 8,
  11: 7,
  12: 7,
  13: 8,
  14: 6,
  15: 6,
  16: 6,
};
const expectedBatches = Object.keys(expectedCounts);
const batchesPresent = expectedBatches.every((batch) => new RegExp(`## .*B${batch} `).test(baseline));
const countsMatch = expectedBatches.every((batch) => taskCounts[batch] === expectedCounts[batch]);
const appHosts = ['apps/mobile', 'apps/learner-web', 'apps/admin-web', 'apps/official-site'];
const appHostsPresent = appHosts.every((host) => baseline.includes(host));
const miniappBoundary = /apps\/miniapp-wechat/.test(baseline)
  && /条件编译兼容壳/.test(baseline)
  && /独立业务路由或 API 层/.test(baseline);
const frontendFoundation = /V2-B7-FE-007/.test(baseline)
  && /packages\/i18n/.test(baseline)
  && /UI locale 与 `contentLocale` 分离/.test(baseline)
  && /亮色\/暗色\/跟随系统\/高对比主题/.test(baseline)
  && /Nuxt SSR/.test(baseline);
const architectureRefs = [
  'ARCH-GW-001', 'ARCH-IAM-001', 'ARCH-IAM-002', 'ARCH-DATA-001', 'ARCH-EVT-001',
  'ARCH-API-001', 'ARCH-OBS-001', 'ARCH-REL-001', 'ARCH-DEP-001', 'ARCH-SEC-001',
  'ARCH-SVC-001', 'ARCH-LCM-001',
];
const architectureRefsPresent = architectureRefs.every((ref) => baseline.includes(ref));
const codeOnlyBoundary = /仅设计和实施代码层开发/.test(baseline)
  && /不把真实生产部署/.test(baseline)
  && /代码层完成/.test(baseline);
const officialSiteCoverage = [...baseline.matchAll(/V2-B\d+-OFS-\d{3}/g)].length >= 3
  && /不承载登录后的学习业务/.test(baseline);
const phaseGates = /G-P2/.test(baseline) && /G-P3/.test(baseline)
  && /未解冻前/.test(baseline) && /冻结/.test(baseline);
const v2ExtIds = new Set(register.match(/V2-EXT-[A-Z0-9-]+/g) ?? []);
const v2ExtExcluded = v2ExtIds.size === 310
  && /310 个 `V2-EXT-\*` 占位单元拆成代码任务/.test(baseline)
  && !/\bV2-B\d+-EXT-/.test(baseline);
const noLegacyTaskReuse = !/DEV-\d{2}-\d{3}/.test(baseline)
  && /继承旧 `DEV-\*` 的完成状态/.test(baseline);

const checks = {
  batchesPresent,
  countsMatch,
  appHostsPresent,
  miniappBoundary,
  frontendFoundation,
  architectureRefsPresent,
  codeOnlyBoundary,
  officialSiteCoverage,
  phaseGates,
  v2ExtExcluded,
  noLegacyTaskReuse,
};
const result = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';

console.log(JSON.stringify({
  taskCount: taskIds.length,
  taskCounts,
  expectedCounts,
  v2ExtCount: v2ExtIds.size,
  checks,
  result,
}, null, 2));

if (result !== 'PASS') process.exitCode = 1;
