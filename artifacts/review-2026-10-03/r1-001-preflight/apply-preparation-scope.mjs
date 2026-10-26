import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const filename = path.join(root, 'docs/06-design/v2-980plus/redesign/task-specs/R1-001-041.json');
const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const othersBefore = sha(JSON.stringify(data.tasks.filter(t => t.id !== 'R1-001')));
const task = data.tasks.find(t => t.id === 'R1-001');
if (!task) throw new Error('R1-001 source specification missing');
const extras = [
  ['apps/official-site/components/SiteStartButton.vue', '本卡11页共用CTA改用受控Web/mobile注册入口；不建立官网认证会话'],
  ['apps/official-site/composables/useOfficialSiteLinks.ts', '复用固定注册helper与当前UI locale/theme；新增本卡公开entry适配，不接认证写接口'],
  ['packages/i18n/src/official-site.ts', '只补课程范围的内容准备中文案；其它公示空文案保持各自语义'],
  ['apps/official-site/utils/site-content.mjs', '同步本卡pricing/download独立公开页登记，不开放官网login/register业务页'],
  ['apps/official-site/tests/b13-official-site.test.mjs', '把旧301/去start断言更新为本卡独立页面与受控注册目标；保留公开安全断言'],
  ['apps/official-site/tests/b14-fe-005.test.mjs', '更新本卡CTA/课程出口旧断言，保留官网不持有业务Token与权限边界'],
  ['apps/official-site/tests/website-entry.test.mjs', '保留设备对应注册及恶意链接负例；公开路由包含本卡pricing/download'],
  ['apps/official-site/tests/browser/website-runtime.cjs', '更新pricing/download与CTA旧浏览器断言；本卡双视口/失败恢复需真实证据']
];
for (const [relative, purpose] of extras) {
  if (!fs.statSync(path.join(root, relative)).isFile()) throw new Error('Expected current file missing: ' + relative);
  if (!task.filePlan.edit.some(item => item.path === relative)) task.filePlan.edit.push({ path: relative, purpose, exists: true });
}
for (const [relative, reason] of [
  ['config/local-ports.json', '本卡18182公开站点、18180/18183目标和18070公开读端口；不以全量busy杀共享实例'],
  ['config/toolchain-baseline.json', '当前端口摘要与Node/pnpm锁版本；本卡不执行Java或写schema'],
  ['apps/official-site/nuxt.config.ts', '现有固定公开Gateway/Web/mobile地址，不读取或修改秘密配置'],
  ['apps/official-site/plugins/foundation.ts', '本卡现有locale/theme/design-token基础输入'],
  ['apps/official-site/components/PublicStatus.vue', '复用title/message覆盖课程空态，不全局替换公示空文案']
]) {
  const existing = task.readFirst.find(item => item.path === relative);
  if (!existing) task.readFirst.push({ path: relative, section: reason });
  else if (!existing.section && existing.reason) { existing.section = existing.reason; delete existing.reason; }
}
const commerceContract = 'packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json';
for (const [relative, section] of [
  ['packages/contracts/openapi/v1/openapi.json', '三项公开GET与源片段一致；不改canonical响应或认证接口'],
  ['packages/contracts/generated/openapi.ts', '三项公开GET生成TS映射；本卡不手写生成类型'],
  ['docs/06-design/v2-980plus/redesign/input-gates.md', '§1输入/输出范围，§2/3/4/6本卡只读准备；完整运行Gate另验'],
  ['docs/06-design/v2-980plus/redesign/execution-handbook.md', '§1/2/3认领、start/submit和逐卡审批；禁止自审']
]) if (!task.readFirst.some(item => item.path === relative)) task.readFirst.push({ path: relative, section });
if (!task.contractRefs.some(item => item.path === commerceContract)) task.contractRefs.push({
  path: commerceContract,
  operations: ['getB13PublicCommerceCatalog'],
  action: 'consume',
  notes: '仅复用既有公开价格读口及其失败语义，不改正式契约，不开放购买/订单/认证接口'
});
task.steps[0].action = '主Agent按P1R-M3-008确认本切片认领，核验本卡公开只读范围的固定端口、Node/pnpm、公开契约和前端基础；记录dirty快照。本卡不写领域DB、不改IAM/Java DTO/Outbox。真实公开上游、双视口和失败恢复是交付验证，不能用准备签收当通过。';
task.steps[0].check = '具备本卡现有来源/契约/组件及受控公开配置证明即可准备；不要求本卡将产出的页面改造/集成TC先完成。实际服务使用和运行验收另核实例与合成输入；无数据库写入不申请共享库清理权限。';
task.steps[1].action = '读取公开projection，独立保留目录、价格、下载和公示的状态与更新时间；整体失败和单facet失败都不得降为空目录/空价格成功。现有commerce degraded header要同时转换为前端可解释状态，仅影响该facet，不伪造服务端发布/可用性事实。';
task.steps[2].action = '恢复pricing/download为独立可读公开页（200及诚实状态），不301回示例start。11页复用PublicStatus/PublicDocument；课程通过既有title/message参数与共享i18n显示“内容准备中”，其它公示保留原语义。无真实方案不显示购买，无有效版本不假下载；保留受控注册CTA并同步公开路由。';
task.steps[3].action = '统一11页共享CTA及课程出口，复用buildPublicLearningEntry，通过useOfficialSiteLinks/SiteStartButton直达Web/mobile既有注册入口，透传uiLocale/theme并固定安全returnTo；/start仍是辅助示例页，不作为注册分流。更新本卡受影响旧301/CTA/sitemap断言，不删安全测试。';
task.commands[1].command = 'node --test apps/official-site/tests/public-projection-bff.test.mjs apps/official-site/tests/b13-official-site.test.mjs apps/official-site/tests/b14-fe-005.test.mjs apps/official-site/tests/website-entry.test.mjs';
task.commands[1].purpose = '复测本卡BFF/独立公开页/CTA与安全入口及路由；旧断言必须按新设计更新，静态/VM测试不能代替TC01…03';
task.commands[1].when = '本卡交付后由主Agent复跑；保持无Token/恶意跳转/失败不假空态断言，另做双视口与真实公开上游恢复';
const othersAfter = sha(JSON.stringify(data.tasks.filter(t => t.id !== 'R1-001')));
if (othersAfter !== othersBefore) throw new Error('Unrelated task specifications changed');
fs.writeFileSync(filename, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({ changedTask: task.id, editFiles: task.filePlan.edit.length, other40TasksUnchanged: true, reviewChange: 'CHG-R1-004' }));
