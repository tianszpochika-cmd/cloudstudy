import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const prdPath = path.join(root, 'requirements', 'product-requirements.md');
const matrixPath = path.join(root, 'requirements', 'feature-matrix.md');
const designDir = path.join(root, 'docs', '06-design');
const traceDir = path.join(designDir, 'traceability');

const prdLines = fs.readFileSync(prdPath, 'utf8').split(/\r?\n/);
const matrix = fs.readFileSync(matrixPath, 'utf8');

// These PRD bullets live under the Phase 1 "not provided" list. They are
// implementation requirements for the adult-only admission gate, not child,
// guardian, or K12 features that may accidentally be scheduled in Phase 1.
const phaseOneIdentityGateLabels = new Map([
  ['儿童账号', '儿童账号（Phase 1 禁止创建；仅 Phase 3 Gate 后另行设计）'],
  ['家长账号', '家长账号（Phase 1 禁止创建；仅 Phase 3 Gate 后另行设计）'],
  ['监护人绑定', '监护人绑定（Phase 1 禁止建立；仅 Phase 3 Gate 后另行设计）'],
  ['未成年人支付', '未成年人支付（Phase 1 禁止；仅 Phase 3 Gate 后另行设计）'],
  ['K12学习目标', 'K12 学习目标（Phase 1 禁止；仅 Phase 3 Gate 后另行设计）'],
  ['无未成年人注册流程', '未成年人注册流程（Phase 1 禁止；仅 Phase 3 Gate 后另行设计）'],
]);

function clean(value) {
  return value
    .replaceAll('**', '')
    .replaceAll('`', '')
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function phaseOneIdentityGate(text) {
  return phaseOneIdentityGateLabels.get(clean(text));
}

function escapeCell(value) {
  return clean(String(value)).replaceAll('|', '\\|');
}

function rootNumber(rootHeading) {
  const match = rootHeading.match(/^(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function phaseOf(rootHeading, sectionHeading, sourceText = '') {
  const value = `${rootHeading} ${sectionHeading} ${sourceText}`;
  const number = rootNumber(rootHeading);
  if (phaseOneIdentityGate(sourceText)) return 'Phase 1';
  // Section 47 is the Phase 1 release gate. Keywords such as K12 or AI in
  // its negative acceptance criteria must not move those controls to a later
  // phase merely because the forbidden capability belongs to that phase.
  if (number === 47) return 'Phase 1';
  if (/Phase\s*3|未成年人|K12|高中升学|教材RAG|教师\/机构/i.test(value)) return 'Phase 3';
  if (/Phase\s*2|AI智能增强|AI学习导师|实时语音|RAG知识库|兴趣小组与社交升级/i.test(value)) return 'Phase 2';
  if (number != null && number >= 3 && number <= 23) return 'Phase 1';
  if (number != null && number >= 24 && number <= 37) return 'Phase 2';
  if (number != null && number >= 38 && number <= 43) return 'Phase 3';
  return '跨阶段/治理';
}

function domainOf(rootHeading, sectionHeading, sourceText = '') {
  const value = `${rootHeading} ${sectionHeading} ${sourceText}`;
  const number = rootNumber(rootHeading);
  if (phaseOneIdentityGate(sourceText)) return 'USR';
  if (number === 47) {
    if (/未成年人|K12|儿童|家长|监护/i.test(value)) return 'USR';
    return 'CROSS';
  }
  if (number != null && number >= 24 && number <= 37) return 'AI2';
  if (number != null && number >= 38 && number <= 43) return 'K12';
  if (/Phase\s*2|AI智能增强|AI学习导师|实时语音|RAG知识库|AI 个性化|AI 实时/i.test(value)) return 'AI2';
  if (/Phase\s*3|未成年人|K12|高中升学|教材RAG|教师\/机构/i.test(value)) return 'K12';
  if (number === 3) return 'ONB';
  if (number === 4 || number === 5) return 'VOC';
  if (number === 6 || number === 7) return 'GRM';
  if (number === 8) return 'LST';
  if (number === 9) return 'RDG';
  if (number === 10) return 'SPK';
  if (number === 11) return 'WRT';
  if (number === 12 || number === 13) return 'ASM';
  if (number === 14 || number === 16) return 'GAM';
  if (number === 15) return 'SOC';
  if (number === 17) return 'USR';
  if (number === 18) {
    if (/会员|权益|订单|交易|支付|Household|家庭组/i.test(value)) return 'COM';
    if (/Admin|教研|运营|审核|Feature Flag|风控|内容管理/i.test(value)) return 'ADM';
    return 'INF';
  }
  if (number === 19) return 'COM';
  if (number === 20) return 'ADM';
  if (/Adaptive Home|新手|测评|地图|课程包/i.test(value)) return 'ONB';
  if (/词汇|词根|短语|句块|SRS|记忆/i.test(value)) return 'VOC';
  if (/语法|长难句|写作|句型/i.test(value)) return /写作/.test(value) ? 'WRT' : 'GRM';
  if (/听力|阅读|口语|音标|Shadowing/i.test(value)) return /口语|音标|Shadowing/.test(value) ? 'SPK' : 'LST';
  if (/游戏|Avatar|奖励|衣柜|收藏|视觉|沉浸/i.test(value)) return 'GAM';
  if (/排行榜|学习室|社交|Feed|小组/i.test(value)) return 'SOC';
  if (/用户|账号|通知|设置|隐私|同步|客服|权限|Deep Link|无障碍/i.test(value)) return 'USR';
  if (/商业化|会员|订单|支付|Household/i.test(value)) return 'COM';
  if (/Admin|教研|运营|审核|Feature Flag/i.test(value)) return 'ADM';
  return 'CROSS';
}

const designAnchors = {
  ONB: 'docs/06-design/v2-980plus/03-Phase1-学习闭环功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  VOC: 'docs/06-design/v2-980plus/03-Phase1-学习闭环功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  GRM: 'docs/06-design/v2-980plus/03-Phase1-学习闭环功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  WRT: 'docs/06-design/v2-980plus/03-Phase1-学习闭环功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  LST: 'docs/06-design/v2-980plus/03-Phase1-学习闭环功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  RDG: 'docs/06-design/v2-980plus/03-Phase1-学习闭环功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  SPK: 'docs/06-design/v2-980plus/03-Phase1-学习闭环功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  ASM: 'docs/06-design/v2-980plus/03-Phase1-学习闭环功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  GAM: 'docs/06-design/v2-980plus/04-Phase1-成长社群商业后台功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  SOC: 'docs/06-design/v2-980plus/04-Phase1-成长社群商业后台功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  USR: 'docs/06-design/v2-980plus/04-Phase1-成长社群商业后台功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  INF: 'docs/06-design/v2-980plus/04-Phase1-成长社群商业后台功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  COM: 'docs/06-design/v2-980plus/04-Phase1-成长社群商业后台功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  ADM: 'docs/06-design/v2-980plus/04-Phase1-成长社群商业后台功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  AI2: 'docs/06-design/v2-980plus/05-Phase2-AI成人高级能力功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  K12: 'docs/06-design/v2-980plus/06-Phase3-K12合规与教师机构功能设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
  CROSS: 'docs/06-design/v2-980plus/07-跨域契约数据事件与验收设计.md；docs/06-design/v2-980plus/01-统一交互与页面状态设计.md',
};

const pageAnchors = {
  ONB: 'apps/mobile + apps/learner-web：onboarding、learn/home、learn/map、courses',
  VOC: 'apps/mobile + apps/learner-web：courses、practice/srs、practice/quick、practice/mastery',
  GRM: 'apps/mobile + apps/learner-web：courses/grammar、practice、learn/session',
  WRT: 'apps/mobile + apps/learner-web：courses/writing、practice、reports',
  LST: 'apps/mobile + apps/learner-web：courses/listening、media、practice',
  RDG: 'apps/mobile + apps/learner-web：courses/reading、reader、practice',
  SPK: 'apps/mobile + apps/learner-web：courses/speaking、recording、practice',
  ASM: 'apps/mobile + apps/learner-web：practice/home、practice/session、checkpoint、reports',
  GAM: 'apps/mobile + apps/learner-web：world、avatar、reward、collection',
  SOC: 'apps/mobile + apps/learner-web：world/study-room、leaderboard、feed',
  USR: 'apps/mobile + apps/learner-web：onboarding、me、settings、privacy',
  INF: 'apps/mobile + apps/learner-web：messages、sync、support、download；apps/admin-web：运营通知；apps/official-site：公开状态/下载/合规入口',
  COM: 'apps/mobile + apps/learner-web + apps/official-site：commerce、orders、pricing',
  ADM: 'apps/admin-web：dashboard、content、review、ops、audit',
  AI2: 'apps/mobile + apps/learner-web + apps/admin-web：AI session、voice、feedback、governance',
  K12: 'apps/mobile + apps/learner-web + apps/admin-web：k12、parent、teacher、org',
  CROSS: '四项目共享宿主与发布/合规/非功能基线',
};

const contractAnchors = {
  ONB: 'Gateway → learner-service/learning-service；usr_learning_profile、learning_plan、learning_session',
  VOC: 'Gateway → learning-service + content-service；vocab_*、lrn_srs_state、content_version',
  GRM: 'Gateway → content-service + assessment-service + learning-service；规则/题目定义归 content，attempt/判分归 assessment，mastery_projection 归 learning',
  WRT: 'Gateway → content-service + assessment-service + learning-service；写作题目/规则版本归 content，草稿/attempt/反馈归 assessment，学习进度归 learning',
  LST: 'Gateway → content-service + media-service + learning-service + assessment-service；媒体/版权归 content+media，播放进度归 learning，听写作答归 assessment',
  RDG: 'Gateway → content-service + learning-service + assessment-service；内容/分支归 content，阅读进度归 learning，阅读测验作答归 assessment',
  SPK: 'Gateway → content-service + media-service + assessment-service；recording_asset、phoneme_lesson、shadowing_session',
  ASM: 'Gateway → content-service + assessment-service + learning-service；题目/答案规则版本归 content，attempt/checkpoint/report 归 assessment，mastery_projection 归 learning',
  GAM: 'Gateway → gamification-service；xp_ledger、streak、avatar、reward_chest、game_session',
  SOC: 'Gateway → social-service；study_room、seat_lease、leaderboard_snapshot、preset_interaction',
  USR: 'Gateway → iam-service + learner-service；user、device、preference、account_deletion',
  INF: 'Gateway → notification-service + workflow/media；message、offline_package、sync_event、ticket',
  COM: 'Gateway → commerce-service；sku、entitlement、order、payment_callback、household',
  ADM: 'Gateway → admin-ops-service + content/commerce services；content_version、review_task、audit_log、feature_flag、risk_case',
  AI2: 'Gateway → ai-orchestrator + assessment/learning services；ai_request、ai_result、prompt_version、consent、cost_ledger',
  K12: 'Gateway → guardian/institution/curriculum-rights services；minor_account、guardian_consent、content_rights、class_report、privacy_request',
  CROSS: '共享 API envelope、Idempotency-Key、requestId/traceId、RBAC、事件、离线和 AdaptivePerformanceEngine',
};

const stateAnchors = {
  ONB: 'ST-B/ST-C；年龄、测评、目标、计划和地图可恢复；锁定/无推荐/弱网有解释',
  VOC: 'ST-D/ST-E/ST-F；内容版本、SRS、媒体失败、题队为空、幂等复习和离线恢复',
  GRM: 'ST-D/ST-E/ST-F；知识点/图谱/练习版本，DAG 失败和规则反馈降级',
  WRT: 'ST-D/ST-E/ST-F；草稿、提交、规则反馈、版权和历史回放',
  LST: 'ST-D/ST-E/ST-G；缓冲、媒体失败、字幕缺失、听写保存和播放器降级',
  RDG: 'ST-D/ST-E/ST-F；内容下线、分支非法、查词、阅读进度和恢复',
  SPK: 'ST-E/ST-G；麦克风拒绝、录音本地保存、上传失败、静音替代',
  ASM: 'ST-E/ST-F；题队、checkpoint、重复提交、离线队列、D+1/D+7 与报告',
  GAM: 'ST-H；结算、资产缺失、离线不发奖、性能降级和幂等补偿',
  SOC: 'ST-I/ST-H；座位租约、WS 恢复、匿名、空房/无成员和受限互动',
  USR: 'ST-A/ST-J；登录冲突、token、设备、注销冷静期、隐私和恢复',
  INF: 'ST-J/ST-K；通知、下载、同步游标、冲突、客服和弱网恢复',
  COM: 'ST-L/ST-J；订单、支付回调、退款、到期降级、权益和家庭组',
  ADM: 'ST-M/ST-N；草稿、双审、发布、回滚、RBAC、导出、审计和异步任务',
  AI2: 'AI request state CREATED→PRECHECKED→RUNNING→POSTCHECK→PERSISTED→DELIVERED；失败安全降级',
  K12: 'K12 gate + 主体/监护/版权/资质状态机；默认关闭、拒绝可解释、撤回可回放',
  CROSS: '共享成功/空/加载/错误/离线/权限/恢复八态；写操作幂等且事件可回放',
};

function classify(text, phase, rootHeading, isTable = false, depth = 0) {
  const groupLabels = /^(功能|场景|交互|原则|规则|架构|控制|内容层级|世界结构示例|学习流程|内容类型|版权边界|规模|适用场景|支持|重要|目标|成本策略|产品|合规|技术|开放前置条件|仅记录|明确|阶段|可做|不直接做|第一阶段推荐对外定位|Phase 1)$/i;
  if (groupLabels.test(text.replace(/[：:]$/, '')) || /[：:]$/.test(text)) return 'group';
  if (phaseOneIdentityGate(text) || rootNumber(rootHeading) === 47) return 'governance';
  if (phase === '跨阶段/治理' || /不得|禁止|不提供|不宣称|不使用|仅面向|必须|资质|版权|合规|隐私|性能|容量|成本|回滚|审计|SLA|P95|P99|备案|授权|门控|前置条件|风险|不直接做/i.test(text)) return 'governance';
  if (/^P[012]\s+——|^Phase\s+[123]$|^\d+\s*(万|人|分钟|天|个|套|元|小时|级|%)$/.test(text)) return 'summary';
  if (isTable) return 'table-fact';
  if (depth > 0) return 'dimension';
  return 'functional';
}

function isCandidate(kind) {
  return kind !== 'group' && kind !== 'summary';
}

function sectionKey(line, currentRoot, currentSection) {
  const heading = line.match(/^(#{1,6})\s+(.+)$/);
  if (!heading) return { root: currentRoot, section: currentSection };
  if (heading[1].length === 1) return { root: clean(heading[2]), section: clean(heading[2]) };
  return { root: currentRoot, section: clean(heading[2]) };
}

function tableCells(line) {
  if (!/^\s*\|/.test(line)) return null;
  const cells = line.split('|').slice(1, -1).map(clean);
  if (!cells.length || cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return null;
  if (cells.every((cell) => !cell)) return null;
  return cells;
}

const sourceItems = [];
let currentRoot = '';
let currentSection = '';
let nextId = 1;
let tableHeader = null;

for (let index = 0; index < prdLines.length; index += 1) {
  const line = prdLines[index];
  const nextHeading = sectionKey(line, currentRoot, currentSection);
  currentRoot = nextHeading.root;
  currentSection = nextHeading.section;

  const bullet = line.match(/^(\s*)(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
  if (bullet) {
    const rawText = clean(bullet[2]);
    const text = phaseOneIdentityGate(rawText) ?? rawText;
    if (!text) continue;
    const phase = phaseOf(currentRoot, currentSection, rawText);
    const domain = domainOf(currentRoot, currentSection, rawText);
    const depth = bullet[1].replaceAll('\t', '  ').length;
    const kind = classify(rawText, phase, currentRoot, false, depth);
    const item = {
      id: `PRD-ATOM-${String(nextId).padStart(4, '0')}`,
      line: index + 1,
      phase,
      domain,
      root: currentRoot,
      section: currentSection,
      kind,
      source: text,
      evidence: `requirements/product-requirements.md:${index + 1}`,
      design: designAnchors[domain],
    };
    if (isCandidate(kind)) {
      sourceItems.push(item);
      nextId += 1;
    }
    continue;
  }

  const cells = tableCells(line);
  if (cells) {
    if (!tableHeader && cells.some((cell) => /阶段|终端|用户画像|产品信息|项|域名|对应 PRD/i.test(cell))) {
      tableHeader = cells;
      continue;
    }
    const joined = cells.join(' / ');
    if (!joined || /^[-:|\s]+$/.test(joined)) continue;
    const phase = phaseOf(currentRoot, currentSection, cells[0] ?? joined);
    const domain = domainOf(currentRoot, currentSection, joined);
    const kind = classify(joined, phase, currentRoot, true, 0);
    if (isCandidate(kind)) {
      sourceItems.push({
        id: `PRD-ATOM-${String(nextId).padStart(4, '0')}`,
        line: index + 1,
        phase,
        domain,
        root: currentRoot,
        section: currentSection,
        kind,
        source: joined,
        evidence: `requirements/product-requirements.md:${index + 1}`,
        design: designAnchors[domain],
      });
      nextId += 1;
    }
  } else if (line.trim() === '') {
    tableHeader = null;
  }
}

const normalized = new Map();
for (const item of sourceItems) {
  const key = item.source.toLowerCase().replaceAll(/[^a-z0-9\u4e00-\u9fff]+/gi, '');
  if (!normalized.has(key)) normalized.set(key, []);
  normalized.get(key).push(item.id);
}
for (const item of sourceItems) {
  const key = item.source.toLowerCase().replaceAll(/[^a-z0-9\u4e00-\u9fff]+/gi, '');
  const duplicates = normalized.get(key) ?? [];
  item.duplicateCount = duplicates.length;
  item.canonicalEvidence = duplicates[0];
}

const explicitFeatures = matrix.split(/\r?\n/)
  .filter((line) => /^\|\s*\*\*FEAT-[A-Z0-9]+-\d{3}\*\*/.test(line))
  .map((line) => {
    const cells = line.split('|').slice(1, -1).map(clean);
    return { id: cells[0], prd: cells[6] ?? '' };
  });

function featureAnchorsFor(item) {
  const sectionRefs = new Set();
  const sectionMatch = item.section.match(/^(\d+(?:\.\d+)?)/);
  if (sectionMatch) sectionRefs.add(sectionMatch[1]);
  const root = rootNumber(item.root);
  if (root != null && root > 0) sectionRefs.add(String(root));
  const matchesPrdRef = (prd, ref) => {
    const escaped = ref.replace('.', '\\.');
    return new RegExp(`§${escaped}(?=$|[^0-9])`).test(prd);
  };
  const ids = explicitFeatures
    .filter((feature) => [...sectionRefs].some((ref) => matchesPrdRef(feature.prd, ref)))
    .map((feature) => feature.id);
  if (ids.length) return ids.join(', ');
  if (item.domain === 'CROSS') return '共享治理主题；必要时新增 SUBFEAT';
  return `FEAT-${item.domain}-*；需按本条证据拆分 SUBFEAT`;
}

for (const item of sourceItems) item.featureAnchors = featureAnchorsFor(item);

function countBy(key) {
  const counts = {};
  for (const item of sourceItems) counts[item[key]] = (counts[item[key]] ?? 0) + 1;
  return counts;
}

function countByPhaseDomain() {
  const counts = {};
  for (const item of sourceItems) {
    const key = `${item.phase}|${item.domain}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const kindCounts = countBy('kind');
const phaseCounts = countBy('phase');
const domainCounts = countBy('domain');
const phaseDomainCounts = countByPhaseDomain();
const uniqueSemanticCount = new Set(sourceItems.map((item) => item.canonicalEvidence)).size;

const phaseDomainRows = Object.entries(phaseDomainCounts)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, count]) => {
    const [phase, domain] = key.split('|');
    return `| ${phase} | ${domain} | ${count} |`;
  }).join('\n');

const inventoryRows = sourceItems.map((item) => [
  item.id,
  item.line,
  item.phase,
  item.domain,
  item.kind,
  `${item.root} / ${item.section}`,
  item.source,
  item.featureAnchors,
  item.design,
  item.duplicateCount > 1 ? `${item.canonicalEvidence}（重复证据 ${item.duplicateCount} 条）` : '—',
].map(escapeCell).join(' | ')).map((row) => `| ${row} |`).join('\n');

const registerRows = sourceItems.map((item) => {
  const designStatus = item.kind === 'governance' || item.domain === 'CROSS'
    ? '共享治理设计已绑定'
    : '业务设计包已绑定；实现前逐条签收';
  const acceptance = item.kind === 'governance'
    ? '按 shared baseline 的权限、隐私、审计、性能和回滚验收'
    : '按对应域设计包：正常/空/加载/错误/离线/权限/恢复 + API/数据/事件验收';
  return `| ${item.id} | ${item.phase} | ${item.domain} | ${item.evidence} | ${item.featureAnchors} | ${item.design} | ${pageAnchors[item.domain]} | ${contractAnchors[item.domain]} | ${stateAnchors[item.domain]} | ${acceptance} | ${designStatus} |`;
}).join('\n');

fs.mkdirSync(traceDir, { recursive: true });
fs.writeFileSync(path.join(traceDir, '03-PRD原子需求候选清单.md'), `# PRD 原子需求候选清单

> 自动生成时间：${new Date().toISOString()}
> 生成器：scripts/audit/generate-prd-atomic-inventory.mjs
> 源文件：requirements/product-requirements.md

## 1. 统计口径

本清单逐行提取 PRD 的功能条目、治理条目和表格事实，并为每条证据生成稳定的 \`PRD-ATOM-*\` 编号。它是 v2 全量设计的来源追溯输入，不把“一个列表项”直接等同于一个可上线 API，也不把同一条在路线总结中重复出现的内容重复计为业务功能；新任务的设计定义仍以 \`docs/06-design/v2-980plus/\` 为准，不回退到 v1 详细设计。

| 指标 | 数量 |
|---|---:|
| PRD 显式 FEAT 记录（功能矩阵） | ${explicitFeatures.length} |
| PRD 原子候选证据行（去除组标题/纯总结） | ${sourceItems.length} |
| 去重后的语义候选行 | ${uniqueSemanticCount} |
| functional | ${kindCounts.functional ?? 0} |
| dimension | ${kindCounts.dimension ?? 0} |
| governance | ${kindCounts.governance ?? 0} |
| table-fact | ${kindCounts['table-fact'] ?? 0} |
| Phase 1 | ${phaseCounts['Phase 1'] ?? 0} |
| Phase 2 | ${phaseCounts['Phase 2'] ?? 0} |
| Phase 3 | ${phaseCounts['Phase 3'] ?? 0} |
| 跨阶段/治理 | ${phaseCounts['跨阶段/治理'] ?? 0} |

“980+”是功能矩阵顶部的宣称值，不能用本表的证据行数量直接替代。它必须在产品负责人确认“功能包、原子能力、治理约束、页面状态是否计数”的口径后，才能回写为正式统计。当前矩阵表内各域分期数字相加为 930，显式 FEAT 行仅为 ${explicitFeatures.length}，详见 [00-功能总账与统计校准](00-功能总账与统计校准.md)。

## 2. 阶段/业务域候选数量

| 阶段 | 业务域 | 候选证据行 |
|---|---|---:|
${phaseDomainRows}

## 3. 使用规则

1. \`PRD-ATOM-*\` 是源证据主键；\`FEAT-*\` 是功能包主键；\`SUBFEAT-*\` 只在子能力拥有独立页面、接口、授权或验收时使用。
2. \`dimension\` 是一个功能的选项、内容字段或变体，默认不再计为独立业务功能；它必须仍然进入设计的输入/输出或内容版本字段。
3. \`governance\` 和 \`table-fact\` 不应被漏掉，但它们进入共享横向设计、CMS、合规、性能或发布设计，不自动增加业务功能数。
4. 同一语义在路线总结、优先级和 v3.3 增量清单中重复时，用 \`canonicalEvidence\` 指向首条证据，避免统计膨胀；每个来源行仍然保留追溯。
5. 任何候选项在进入开发 WBS 前，必须完成设计登记册中的页面、契约/数据、状态/异常、事件和验收签收。

## 4. 全量证据表

| ID | PRD 行 | 阶段 | 域 | 类型 | PRD 章节 | 原文证据 | FEAT/SUBFEAT 锚点 | 设计归属 | 重复/规范证据 |
|---|---:|---|---|---|---|---|---|---|---|
${inventoryRows}
`);

fs.writeFileSync(path.join(traceDir, '04-原子功能设计登记册.md'), `# 原子功能设计登记册

> 自动生成时间：${new Date().toISOString()}
> 生成器：scripts/audit/generate-prd-atomic-inventory.mjs
> 说明：本登记册将每条 PRD 原子候选证据绑定到 v2 设计包和统一设计维度；“已绑定”不等于代码已实现，必须继续通过 contracts、migration、测试和跨端 DoD。历史 Core API/v1 设计字段只表示迁移期兼容或术语参考；v2 任务必须填写目标服务 owner 和 ARCH-* 能力。

## 1. 设计签收字段

每一行都必须能回答：

- 谁在什么页面/路由上操作或观察；
- 哪个 v2 目标服务、AI Orchestrator、事件或数据表拥有事实；若仍处迁移期，必须单独标注 Core API 兼容承载；
- 正常、空、加载、错误、离线、权限和恢复如何表现；
- 哪条验收和埋点能证明结果；
- 哪个阶段门控阻止它提前进入 Phase 1。

本表中的页面、契约、状态和验收列引用域级详细设计模板。具有特殊业务规则的功能必须在对应详细设计中增加 \`FEAT-*\`/\`SUBFEAT-*\` 专节后，才能将“实现前逐条签收”改为“设计签收完成”。

## 2. 设计登记

| PRD ID | 阶段 | 域 | PRD 证据 | FEAT/SUBFEAT 锚点 | 详细设计归属 | 页面/路由宿主 | API/数据事实边界 | 状态/异常边界 | 验收签收 | 当前设计状态 |
|---|---|---|---|---|---|---|---|---|---|---|
${registerRows}
`);

console.log(JSON.stringify({
  prdLines: prdLines.length,
  explicitFeatures: explicitFeatures.length,
  candidateEvidenceRows: sourceItems.length,
  uniqueSemanticCandidates: uniqueSemanticCount,
  kindCounts,
  phaseCounts,
  domainCounts,
  output: [
    'docs/06-design/traceability/03-PRD原子需求候选清单.md',
    'docs/06-design/traceability/04-原子功能设计登记册.md',
  ],
}, null, 2));
