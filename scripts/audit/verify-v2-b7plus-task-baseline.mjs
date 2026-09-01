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
const taskCounts = Object.fromEntries([...Array(16)].map((_, index) => [String(index + 7), 0]));
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
  17: 6,
  18: 6,
  19: 6,
  20: 6,
  21: 6,
  22: 4,
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
const scopeBoundary = (/B15–B18 是 Phase 1 运行态主链；B19–B21 以测试和发布 Gate 为主，B22 只有在 RC Gate 通过后才能执行生产切换/.test(baseline)
  || /B15–B22 为 Phase 1 运行态、测试、发布与上线任务/.test(baseline)
  || /B15 已进入执行并完成代码\/静态预检，B16–B22 仍待认领/.test(baseline)
  || /B15 已完成代码\/静态预检，B16 已完成代码与静态回归但真实运行态被环境阻塞，B17–B22 尚未开发/.test(baseline)
  || /B15 已完成代码\/静态预检，B16 已完成代码与静态回归但真实运行态被环境阻塞，B17 已完成代码、静态门禁与合成旅程回归但真实跨进程运行态被环境阻塞，B18 已完成代码\/静态联调骨架与四端构建但真实 API\/浏览器\/设备运行态被环境阻塞，B19–B22 尚未开发/.test(baseline)
  || /B15 已完成代码\/静态预检，B16 已完成代码与静态回归但真实运行态被环境阻塞，B17 已完成代码、静态门禁与合成旅程回归但真实跨进程运行态被环境阻塞，B18 已完成代码\/静态联调骨架与四端构建但真实 API\/浏览器\/设备运行态被环境阻塞，B19 已完成代码\/静态系统测试基础但真实 API\/E2E\/浏览器\/设备\/专项 QA 运行态被环境阻塞，B20–B22 尚未开发/.test(baseline)
  || /B15 已完成代码\/静态预检，B16 已完成代码与静态回归但真实运行态被环境阻塞，B17 已完成代码、静态门禁与合成旅程回归但真实跨进程运行态被环境阻塞，B18 已完成代码\/静态联调骨架与四端构建但真实 API\/浏览器\/设备运行态被环境阻塞，B19 已完成代码\/静态系统测试基础但真实 API\/E2E\/浏览器\/设备\/专项 QA 运行态被环境阻塞，B20 已完成代码\/静态 Gate 基础但真实安全\/隐私\/内容\/支付\/灾备运行态被环境、资质或证据阻塞，B21–B22 尚未开发/.test(baseline)
  || /B15 已完成代码\/静态预检，B16 已完成代码与静态回归但真实运行态被环境阻塞，B17 已完成代码、静态门禁与合成旅程回归但真实跨进程运行态被环境阻塞，B18 已完成代码\/静态联调骨架与四端构建但真实 API\/浏览器\/设备运行态被环境阻塞，B19 已完成代码\/静态系统测试基础但真实 API\/E2E\/浏览器\/设备\/专项 QA 运行态被环境阻塞，B20 已完成代码\/静态 Gate 基础但真实安全\/隐私\/内容\/支付\/灾备运行态被环境、资质或证据阻塞，B21 已完成代码\/静态发布 Gate 基础但真实 staging\/RC\/观测\/回滚\/Go-No-Go 运行态被环境或证据阻塞，B22 尚未开发/.test(baseline)
  || /B15 已完成代码\/静态预检，B16 已完成代码与静态回归但真实运行态被环境阻塞，B17 已完成代码、静态门禁与合成旅程回归但真实跨进程运行态被环境阻塞，B18 已完成代码\/静态联调骨架与四端构建但真实 API\/浏览器\/设备运行态被环境阻塞，B19 已完成代码\/静态系统测试基础但真实 API\/E2E\/浏览器\/设备\/专项 QA 运行态被环境阻塞，B20 已完成代码\/静态 Gate 基础但真实安全\/隐私\/内容\/支付\/灾备运行态被环境、资质或证据阻塞，B21 已完成代码\/静态发布 Gate 基础但真实 staging\/RC\/观测\/回滚\/Go-No-Go 运行态被环境或证据阻塞，B22 已完成代码\/静态上线 Gate 基础但真实生产切换、迁移、观察期和 Phase 1 验收运行态被环境或证据阻塞/.test(baseline))
  && (/不启用 Phase 2 AI、Phase 3 K12/.test(baseline)
    || /Phase 2\/3 的 `G-P2`、`G-P3` 不属于 Phase 1 上线 Gate/.test(baseline))
  && /代码层完成/.test(baseline)
  && /生产上线/.test(baseline);
const officialSiteCoverage = [...baseline.matchAll(/V2-B\d+-OFS-\d{3}/g)].length >= 3
  && /不承载登录后的学习业务/.test(baseline);
const phaseGates = /G-P2/.test(baseline) && /G-P3/.test(baseline)
  && /F2/.test(baseline) && /F3/.test(baseline) && /冻结/.test(baseline);
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
  scopeBoundary,
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
