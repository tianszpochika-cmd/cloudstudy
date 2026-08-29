import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requirementsDir = path.join(root, 'requirements');
const designDir = path.join(root, 'docs', '06-design');
const v2DesignDir = path.join(designDir, 'v2-980plus');
const traceDir = path.join(designDir, 'traceability');
const matrixPath = path.join(requirementsDir, 'feature-matrix.md');
const prdPath = path.join(requirementsDir, 'product-requirements.md');

const matrix = fs.readFileSync(matrixPath, 'utf8');
const prd = fs.readFileSync(prdPath, 'utf8');

function clean(value) {
  return value
    .replaceAll('**', '')
    .replaceAll('`', '')
    .replaceAll('<br>', ' / ')
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replaceAll('|', '\\|')
    .trim();
}

function phaseOf(value) {
  if (/Phase 1/i.test(value)) return 'Phase 1';
  if (/Phase 2/i.test(value)) return 'Phase 2';
  if (/Phase 3/i.test(value)) return 'Phase 3';
  return '未标注';
}

function domainOf(id) {
  return id.match(/^FEAT-([A-Z0-9]+)-/)?.[1] ?? 'UNKNOWN';
}

function designOf(domain) {
  const map = {
    ONB: '[03-Phase1-学习闭环功能设计](../v2-980plus/03-Phase1-学习闭环功能设计.md)',
    VOC: '[03-Phase1-学习闭环功能设计](../v2-980plus/03-Phase1-学习闭环功能设计.md)',
    GRM: '[03-Phase1-学习闭环功能设计](../v2-980plus/03-Phase1-学习闭环功能设计.md)',
    WRT: '[03-Phase1-学习闭环功能设计](../v2-980plus/03-Phase1-学习闭环功能设计.md)',
    LST: '[03-Phase1-学习闭环功能设计](../v2-980plus/03-Phase1-学习闭环功能设计.md)',
    RDG: '[03-Phase1-学习闭环功能设计](../v2-980plus/03-Phase1-学习闭环功能设计.md)',
    SPK: '[03-Phase1-学习闭环功能设计](../v2-980plus/03-Phase1-学习闭环功能设计.md)',
    ASM: '[03-Phase1-学习闭环功能设计](../v2-980plus/03-Phase1-学习闭环功能设计.md)',
    GAM: '[04-Phase1-成长社群商业后台功能设计](../v2-980plus/04-Phase1-成长社群商业后台功能设计.md)',
    SOC: '[04-Phase1-成长社群商业后台功能设计](../v2-980plus/04-Phase1-成长社群商业后台功能设计.md)',
    USR: '[04-Phase1-成长社群商业后台功能设计](../v2-980plus/04-Phase1-成长社群商业后台功能设计.md)',
    INF: '[04-Phase1-成长社群商业后台功能设计](../v2-980plus/04-Phase1-成长社群商业后台功能设计.md)',
    COM: '[04-Phase1-成长社群商业后台功能设计](../v2-980plus/04-Phase1-成长社群商业后台功能设计.md)',
    ADM: '[04-Phase1-成长社群商业后台功能设计](../v2-980plus/04-Phase1-成长社群商业后台功能设计.md)',
    AI2: '[05-Phase2-AI成人高级能力功能设计](../v2-980plus/05-Phase2-AI成人高级能力功能设计.md)',
    K12: '[06-Phase3-K12合规与教师机构功能设计](../v2-980plus/06-Phase3-K12合规与教师机构功能设计.md)',
  };
  return map[domain] ?? '[07-跨域契约数据事件与验收设计](../v2-980plus/07-跨域契约数据事件与验收设计.md)';
}

const featureRows = matrix
  .split(/\r?\n/)
  .filter((line) => /^\|\s*\*\*FEAT-[A-Z0-9]+-\d{3}\*\*/.test(line))
  .map((line) => {
    const cells = line.split('|').slice(1, -1).map(clean);
    const id = cells[0];
    const domain = domainOf(id);
    return {
      id,
      domain,
      category: cells[1] ?? '',
      name: cells[2] ?? '',
      detail: cells[3] ?? '',
      platforms: cells[4] ?? '',
      phase: phaseOf(cells[5] ?? ''),
      prd: cells[6] ?? '',
      design: designOf(domain),
    };
  });

const designText = fs.readdirSync(v2DesignDir, { recursive: true })
  .filter((entry) => entry.endsWith('.md'))
  .map((entry) => fs.readFileSync(path.join(v2DesignDir, entry), 'utf8'))
  .join('\n');

const phaseCounts = Object.fromEntries(['Phase 1', 'Phase 2', 'Phase 3', '未标注'].map((phase) => [
  phase,
  featureRows.filter((row) => row.phase === phase).length,
]));
const domainCounts = {};
for (const row of featureRows) domainCounts[row.domain] = (domainCounts[row.domain] ?? 0) + 1;

const featureTable = featureRows.map((row) => {
  const present = designText.includes(row.id) ? '已出现' : '缺失';
  return `| ${row.id} | ${row.phase} | ${row.domain} | ${row.name} | ${row.prd} | ${row.design} | ${present} |`;
}).join('\n');

const headings = [];
let rootHeading = '';
for (const [index, line] of prd.split(/\r?\n/).entries()) {
  const match = line.match(/^(#{1,4})\s+(.+)$/);
  if (!match) continue;
  const level = match[1].length;
  const title = match[2].trim();
  if (level === 1) rootHeading = title;
  const lineNumber = index + 1;
  let phase = '跨阶段/基础';
  if (/Phase\s*2|Phase 2|AI智能增强|AI学习导师|实时语音|RAG知识库|兴趣小组与社交升级/i.test(rootHeading + ' ' + title)) phase = 'Phase 2';
  else if (/Phase\s*3|Phase 3|未成年人|K12|教师\/机构|教材RAG/i.test(rootHeading + ' ' + title)) phase = 'Phase 3';
  else if (lineNumber < 3477 || /Phase 1/i.test(rootHeading + ' ' + title)) phase = 'Phase 1';
  headings.push({ lineNumber, level, title, phase });
}

const sectionTable = headings.map((item) => {
  const domain = item.phase === 'Phase 2' ? 'AI2' : item.phase === 'Phase 3' ? 'K12' :
    item.title.match(/词汇|词根|短语|SRS/i) ? 'VOC' :
    item.title.match(/语法|长难句|句型|写作/i) ? 'GRM' :
      item.title.match(/听力|阅读|口语|音标|Shadowing|Language Clips/i) ? 'LST' :
        item.title.match(/游戏|Avatar|奖励|衣柜|收藏|视觉|沉浸/i) ? 'GAM' :
          item.title.match(/排行榜|学习室|社交|Feed/i) ? 'SOC' :
            item.title.match(/用户|账号|通知|设置|隐私|同步|客服|权限|Deep Link|无障碍/i) ? 'USR' :
              item.title.match(/商业化|会员|订单|支付|Household/i) ? 'COM' :
                item.title.match(/Admin|教研|运营|Feature Flag|审核/i) ? 'ADM' :
                  'ONB';
  return `| PRD:${item.lineNumber} | ${item.phase} | ${'#'.repeat(item.level)} ${item.title} | ${designOf(domain)} |`;
}).join('\n');

const domainTable = Object.entries(domainCounts)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([domain, count]) => `| ${domain} | ${count} |`).join('\n');

fs.mkdirSync(traceDir, { recursive: true });
fs.writeFileSync(path.join(traceDir, '01-需求设计追溯矩阵.md'), `# 需求—设计追溯矩阵\n\n> 自动生成时间：${new Date().toISOString()}\n> 生成器：scripts/audit/generate-design-traceability.mjs\n\n## 1. 当前 FEAT 记录统计\n\n| 阶段 | 记录数 |\n|---|---:|\n| Phase 1 | ${phaseCounts['Phase 1']} |\n| Phase 2 | ${phaseCounts['Phase 2']} |\n| Phase 3 | ${phaseCounts['Phase 3']} |\n| 未标注 | ${phaseCounts['未标注']} |\n| 合计 | ${featureRows.length} |\n\n> 该表只统计 184 个显式 \`FEAT-*\` 功能包，不等于全部范围登记。v2 冻结口径为 980 条登记行 = 930 个业务域单元 + 50 个跨域登记位，成熟度为 184/486/310；三层数字用途不同，不构成算术冲突，详见 00-功能总账与冻结统计。\n\n## 2. 业务域记录数\n\n| 域 | 显式 FEAT 数 |\n|---|---:|\n${domainTable}\n\n## 3. 显式功能包映射\n\n| 功能 ID | 阶段 | 域 | 功能名称 | PRD | 设计归属 | ID 是否出现 |\n|---|---|---|---|---|---|---|\n${featureTable}\n\n## 4. PRD 章节级映射\n\n章节级映射用于确保 PRD 的非表格要求也有设计归属；原子子功能仍需在补充文档中按 SUBFEAT-* 拆解。\n\n| PRD 行 | 阶段 | 章节 | 设计归属 |\n|---:|---|---|---|\n${sectionTable}\n\n## 5. 追溯状态定义\n\n- 已出现：设计文本出现对应显式功能 ID，仍需人工确认语义完整性。\n- 缺失：没有找到对应功能 ID，必须补充设计或修正功能台账。\n- 章节映射不是完成证明；每个原子子功能还必须具备页面、API、数据、状态、异常和验收证据。\n`);

fs.writeFileSync(path.join(traceDir, '02-PRD章节目录与设计归属.md'), `# PRD 章节目录与设计归属\n\n> 自动生成时间：${new Date().toISOString()}\n\n本文按 PRD 标题建立章节级设计归属，防止未进入功能矩阵的原则、基础设施、Phase 2/3 和非功能要求被遗漏。\n\n| PRD 行 | 层级 | 阶段 | 标题 | 建议设计域 |\n|---:|---:|---|---|---|\n${sectionTable}\n`);

console.log(JSON.stringify({
  featureRows: featureRows.length,
  phaseCounts,
  domainCounts,
  prdHeadings: headings.length,
  output: [
    'docs/06-design/traceability/01-需求设计追溯矩阵.md',
    'docs/06-design/traceability/02-PRD章节目录与设计归属.md',
  ],
}, null, 2));
