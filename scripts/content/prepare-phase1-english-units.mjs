// Curated first-party lesson candidates. Read-only by design: B9 currently
// assigns a placeholder rights-evidence reference to every draft, and Phase 1
// release requires independent editor, L1, L2 and publisher decisions.
// This script prepares deterministic CREATE_DRAFT commands for that workflow;
// it never impersonates reviewers or publishes content.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sourcePath = fileURLToPath(new URL('./phase1-english-units.json', import.meta.url));
const allowedItemTypes = new Set(['VOCABULARY', 'PHRASE', 'GRAMMAR', 'SENTENCE', 'QUESTION']);
const requiredPhases = ['GOAL', 'MODEL', 'EXPLAIN', 'PRACTICE', 'REVIEW'];
const contentCodePattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,127}$/;
const forbiddenFieldPattern = /^(?:answers?|answerrules?|correctanswers?|expectedanswer|solutions?|scoringrules?|rubric|teachernotes|editornotes|reviewnotes|privatenotes|copyrightevidence)$/i;

export function canonicalLikeContentService(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((entry) => `${canonicalLikeContentService(entry)};`).join('')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalLikeContentService(value[key])};`).join('')}}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(String(value));
}

export function ownerPayload(unit) {
  // Matches B9ContentAdminController.payload() in the current owner. The
  // contentHash field in B9ContentDraftInput must pin the actual stored payload.
  return {
    summary: unit.summary,
    contentLocale: unit.contentLocale,
    targetLevel: unit.targetLevel,
    items: unit.items,
  };
}

export function ownerContentHash(unit) {
  return createHash('sha256').update(canonicalLikeContentService(ownerPayload(unit)), 'utf8').digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function inspectForbiddenFields(value, location) {
  if (Array.isArray(value)) return value.forEach((item, index) => inspectForbiddenFields(item, `${location}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    assert(!forbiddenFieldPattern.test(key), `${location}.${key}: assessment-only field in course projection`);
    inspectForbiddenFields(nested, `${location}.${key}`);
  }
}

export function validatePack(pack) {
  assert(pack?.editorialStatus === 'ORIGINAL_DRAFT_PENDING_INDEPENDENT_REVIEW', 'editorial status must remain pending independent review');
  assert(Array.isArray(pack.units) && pack.units.length >= 3 && pack.units.length <= 8, 'expected a small curated lesson pack');
  const codes = new Set();
  const itemCodes = new Set();
  for (const unit of pack.units) {
    assert(contentCodePattern.test(unit.contentCode), `invalid contentCode: ${unit.contentCode}`);
    assert(!codes.has(unit.contentCode), `duplicate contentCode: ${unit.contentCode}`);
    codes.add(unit.contentCode);
    assert(unit.contentType === 'COURSE_UNIT', `${unit.contentCode}: must be a course unit`);
    assert(typeof unit.title === 'string' && unit.title.trim().length >= 4 && unit.title.length <= 255, `${unit.contentCode}: invalid title`);
    assert(typeof unit.summary === 'string' && unit.summary.trim().length >= 28 && unit.summary.length <= 512, `${unit.contentCode}: summary must be useful on a course card`);
    assert(unit.contentLocale === 'en-US', `${unit.contentCode}: content locale must match the English material`);
    assert(['A1', 'A2', 'B1'].includes(unit.targetLevel), `${unit.contentCode}: unsupported entry level`);
    assert(unit.sourceCode === 'P1_ENGLISH_ORIGINAL_20260923', `${unit.contentCode}: source provenance changed`);
    assert(unit.licenseCode === 'INTERNAL_ORIGINAL_PENDING_REVIEW', `${unit.contentCode}: rights must remain pending review`);
    assert(Array.isArray(unit.items) && unit.items.length >= 5 && unit.items.length <= 12, `${unit.contentCode}: expected a complete learning loop`);
    const phases = new Set();
    for (const [index, item] of unit.items.entries()) {
      assert(contentCodePattern.test(item.itemCode) && item.itemCode.startsWith(`${unit.contentCode}-`), `${unit.contentCode}: invalid itemCode`);
      assert(!itemCodes.has(item.itemCode), `duplicate itemCode: ${item.itemCode}`);
      itemCodes.add(item.itemCode);
      assert(allowedItemTypes.has(item.itemType) && item.itemType !== 'QUESTION', `${item.itemCode}: ungraded lesson must not present an assessment question`);
      assert(item.displayOrder === index + 1, `${item.itemCode}: display order gap`);
      assert(typeof item.stimulusRef === 'string' && item.stimulusRef.startsWith(`text:${unit.contentCode}:`), `${item.itemCode}: invalid text stimulus`);
      assert(typeof item.displayText === 'string' && item.displayText.trim().length >= 25 && item.displayText.length <= 4096, `${item.itemCode}: incomplete learner text`);
      assert(item.definition && typeof item.definition === 'object' && !Array.isArray(item.definition), `${item.itemCode}: missing structured definition`);
      phases.add(item.definition.phase);
      inspectForbiddenFields(item, item.itemCode);
    }
    for (const phase of requiredPhases) assert(phases.has(phase), `${unit.contentCode}: missing ${phase} stage`);
    assert(unit.items.at(-1).definition.phase === 'REVIEW', `${unit.contentCode}: unit must end with review`);
    assert(unit.items.at(-1).definition.feedbackMode === 'SELF_CHECK_NO_SCORE', `${unit.contentCode}: must not imply a graded result`);
  }
  return pack;
}

export async function loadPack() {
  return validatePack(JSON.parse(await readFile(sourcePath, 'utf8')));
}

export function draftPlan(pack) {
  validatePack(pack);
  return pack.units.map((unit) => {
    const contentHash = ownerContentHash(unit);
    const { contentCode, ...draft } = unit;
    return {
      method: 'POST',
      path: '/api/v1/admin/content-commands',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `p1-english-${unit.contentCode}-${contentHash.slice(0, 24)}`,
        'If-Match': '0',
      },
      body: {
        command: 'CREATE_DRAFT',
        contentCode,
        expectedStateVersion: 0,
        content: { ...draft, contentHash },
      },
    };
  });
}

export async function checkPublicCatalog(fetcher = fetch) {
  const response = await fetcher('http://127.0.0.1:18070/api/v1/public/content/catalog', {
    headers: { Accept: 'application/json' }, redirect: 'manual',
  });
  assert(response.status === 200, `public catalog returned HTTP ${response.status}`);
  const payload = await response.json();
  assert(Array.isArray(payload?.data?.items), 'public catalog items missing');
  const pack = await loadPack();
  const codes = new Set(pack.units.map((unit) => unit.contentCode));
  const accidentallyPublished = payload.data.items.filter((item) => codes.has(item.contentCode));
  assert(accidentallyPublished.length === 0, `unreviewed curated units are public: ${accidentallyPublished.map((item) => item.contentCode).join(', ')}`);
  return { publicItemCount: payload.data.items.length, curatedPublishedCount: 0 };
}

async function main(args) {
  if (args.includes('--apply') || args.includes('--publish') || args.includes('--apply-drafts')) {
    throw new Error('Owner rights evidence and independent L1/L2/publisher review are required. This tool only prepares drafts for review.');
  }
  const outputIndex = args.indexOf('--write-plan');
  assert(outputIndex < 0 || (args[outputIndex + 1] && !args[outputIndex + 1].startsWith('--')), '--write-plan requires a file path');
  const pack = await loadPack();
  const commands = draftPlan(pack);
  if (outputIndex >= 0) {
    const target = path.resolve(args[outputIndex + 1]);
    await writeFile(target, `${JSON.stringify({ packCode: pack.packCode, editorialStatus: pack.editorialStatus, commands }, null, 2)}\n`, { flag: 'w' });
  }
  const catalog = args.includes('--check-public') ? await checkPublicCatalog() : undefined;
  console.log(JSON.stringify({
    mode: 'DRY_RUN',
    status: 'PENDING_RIGHTS_AND_INDEPENDENT_REVIEW',
    packCode: pack.packCode,
    unitCount: pack.units.length,
    itemCount: pack.units.reduce((sum, unit) => sum + unit.items.length, 0),
    units: pack.units.map((unit) => ({ code: unit.contentCode, title: unit.title, level: unit.targetLevel, items: unit.items.length, contentHash: ownerContentHash(unit) })),
    ...(catalog ? { catalog } : {}),
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
