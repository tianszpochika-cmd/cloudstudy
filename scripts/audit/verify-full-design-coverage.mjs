import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function uniqueMatches(text, pattern) {
  return new Set(text.match(pattern) ?? []);
}

const matrix = read('requirements/feature-matrix.md');
const designDir = path.join(root, 'docs', '06-design');
const v2Dir = path.join(designDir, 'v2-980plus');
const designText = fs.readdirSync(v2Dir, { recursive: true })
  .filter((entry) => entry.endsWith('.md'))
  .map((entry) => fs.readFileSync(path.join(v2Dir, entry), 'utf8'))
  .join('\n');
const inventory = read('docs/06-design/traceability/03-PRD原子需求候选清单.md');
const register = read('docs/06-design/traceability/04-原子功能设计登记册.md');
const featureTraceability = read('docs/06-design/traceability/01-需求设计追溯矩阵.md');
const sectionTraceability = read('docs/06-design/traceability/02-PRD章节目录与设计归属.md');
const legacyEntryPoints = [
  'docs/06-design/detailed-specs/README.md',
  'docs/06-design/phase-1/README.md',
  'docs/06-design/phase-1/uiux-specs/00_README_设计文档索引.md',
  'docs/06-design/phase-1/uiux-specs/source.md',
  'docs/06-design/phase-1/full-coverage/成长社群商业后台原子功能补充设计.md',
  'docs/06-design/phase-1/full-coverage/学习与练习原子功能补充设计.md',
  'docs/06-design/phase-1/full-coverage/UIUX需求追溯与页面状态补充设计.md',
  'docs/06-design/phase-2/AI成人学习与AI服务详细设计.md',
  'docs/06-design/phase-2/AI成人学习与实时交互UIUX详细设计.md',
  'docs/06-design/phase-3/K12未成年人教师机构与合规详细设计.md',
  'docs/06-design/phase-3/K12未成年人教师机构UIUX与页面状态详细设计.md',
  'docs/06-design/shared/全局横向设计基线.md',
  'requirements/backlog/Phase-1范围冻结与跨文档基线.md',
];

const matrixIds = uniqueMatches(matrix, /FEAT-[A-Z0-9]+-\d{3}/g);
const designIds = uniqueMatches(designText, /FEAT-[A-Z0-9]+-\d{3}/g);
const inventoryIds = uniqueMatches(inventory, /PRD-ATOM-\d{4}/g);
const registerIds = uniqueMatches(register, /PRD-ATOM-\d{4}/g);
const missingMatrixIds = [...matrixIds].filter((id) => !designIds.has(id));
const missingRegisterIds = [...inventoryIds].filter((id) => !registerIds.has(id));
const requiredDocs = [
  'docs/06-design/v2-980plus/README.md',
  'docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  'docs/06-design/v2-980plus/02-全端信息架构与交互模式.md',
  'docs/06-design/v2-980plus/03-Phase1-学习闭环功能设计.md',
  'docs/06-design/v2-980plus/04-Phase1-成长社群商业后台功能设计.md',
  'docs/06-design/v2-980plus/05-Phase2-AI成人高级能力功能设计.md',
  'docs/06-design/v2-980plus/06-Phase3-K12合规与教师机构功能设计.md',
  'docs/06-design/v2-980plus/07-跨域契约数据事件与验收设计.md',
  'docs/06-design/v2-980plus/08-980plus-功能点设计登记册.md',
  'docs/06-design/v2-980plus/09-追溯与验收矩阵.md',
  'docs/06-design/v2-980plus/11-架构映射与任务重基线.md',
  'docs/06-design/v2-980plus/12-架构与设计一致性审核.md',
  'docs/02-architecture/v2-microservices-architecture.md',
  'requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md',
  'docs/06-design/traceability/01-需求设计追溯矩阵.md',
  'docs/06-design/traceability/02-PRD章节目录与设计归属.md',
];
const missingDocs = requiredDocs.filter((file) => !exists(file));
const readme = read('docs/06-design/v2-980plus/README.md');
const b7TaskBaseline = read('requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md');
const phase1Interaction = read('docs/06-design/v2-980plus/01-统一交互与页面状态设计.md');
const phase2Design = read('docs/06-design/v2-980plus/05-Phase2-AI成人高级能力功能设计.md');
const phase2Gate = /Phase 2/.test(phase2Design) && /Schema/.test(phase2Design) && /降级/.test(phase2Design);
const phase1AdultGate = /儿童账号、家长账号、监护绑定、未成年人支付和 K12 学习目标/.test(phase1Interaction)
  && /不创建相应主体或权益事实/.test(phase1Interaction);
const frontendFoundationDesign = /packages\/i18n/.test(phase1Interaction)
  && /UI locale/.test(phase1Interaction)
  && /contentLocale/.test(phase1Interaction)
  && /亮色、暗色、跟随系统和高对比/.test(phase1Interaction);
const v2Authority = /唯一全量业务设计与需求落地基线/.test(readme)
  && !/v1 文档继续作为已冻结的领域事实源/.test(readme);
const v2Traceability = /\.\.\/v2-980plus\//.test(featureTraceability)
  && /\.\.\/v2-980plus\//.test(sectionTraceability)
  && !/detailed-specs\/|phase-1\/full-coverage|phase-2\/AI成人|phase-3\/K12/.test(featureTraceability + sectionTraceability);
const b7TaskBaselineBound = /V2-CODE-BASELINE-20260822/.test(b7TaskBaseline)
  && /V2-B7-PLAT-001/.test(b7TaskBaseline)
  && /V2-B14-TEST-006/.test(b7TaskBaseline)
  && /apps\/official-site/.test(b7TaskBaseline)
  && /V2-EXT/.test(b7TaskBaseline);
const legacyEntryPointsMarked = legacyEntryPoints.every((file) => {
  const text = read(file);
  return /历史/.test(text) && /v2-980plus/.test(text);
});
const report = {
  matrixFeatureIds: matrixIds.size,
  v2DesignFeatureIds: designIds.size,
  missingV2MatrixIds: missingMatrixIds,
  inventoryRows: inventoryIds.size,
  registerRows: registerIds.size,
  missingRegisterIds,
  requiredDocs: requiredDocs.length,
  missingDocs,
  phase2Gate,
  phase1AdultGate,
  frontendFoundationDesign,
  v2Authority,
  v2Traceability,
  b7TaskBaselineBound,
  legacyEntryPoints: legacyEntryPoints.length,
  legacyEntryPointsMarked,
  result: missingMatrixIds.length === 0
    && missingRegisterIds.length === 0
    && missingDocs.length === 0
    && phase2Gate
    && phase1AdultGate
    && frontendFoundationDesign
    && v2Authority
    && v2Traceability
    && b7TaskBaselineBound
    && legacyEntryPointsMarked
    ? 'PASS'
    : 'FAIL',
};

console.log(JSON.stringify(report, null, 2));
if (report.result !== 'PASS') process.exitCode = 1;
