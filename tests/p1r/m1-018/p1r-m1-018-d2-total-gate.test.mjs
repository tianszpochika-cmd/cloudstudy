import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  EXPECTED_ATOMIC_EVENT_GAPS,
  EXPECTED_CONTRACT_GAPS,
  EVENT_GAP_ALIAS,
  parseM1018Matrix,
  validateM1018D2TotalGateData,
} from '../../../scripts/audit/p1r-m1-018-d2-total-gate.mjs';
import {
  M1018_IAM_CANONICAL_EVENT_GOVERNANCE,
  M1018_IAM_GAP_D2_CLOSURE_TASKS,
} from '../../../scripts/contracts/event-catalog-policy.mjs';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8'));
const policy = readJson('config/p1r-m1-018-d2-total-gate.v1.json');
const registry = readJson('config/p1r-gap-registry.v1.json');
const catalog = readJson('packages/contracts/events/v1/catalog.json');
const ownerPolicy = readJson('config/p1r-data-ownership.v1.json');
const b26Runtime = readJson('config/b26-event-runtime.json');
const g0 = readJson('config/g0-scope-governance.json');
const g3 = readJson('config/g3-test-security-observability.json');
const m0_006 = readJson('evidence/p1r/m0/P1R-M0-006/manifest.json');
const matrixMarkdown = fs.readFileSync(path.join(root, 'requirements/backlog/v2-phase1-rebaseline/04-追溯覆盖矩阵.md'), 'utf8');
const iamFragment = readJson('packages/contracts/events/v1/fragments/m1-018-iam-v2.events.json');
const iamEventNames = Object.keys(M1018_IAM_CANONICAL_EVENT_GOVERNANCE);
const eventGapFamilies = {
  'EVENT-GAP-IAM-001': 'EVENT-GAP-IAM',
  'EVENT-GAP-BIND-IAM-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-IAM-002': 'EVENT-GAP-BIND',
  'EVENT-GAP-ONB-001': 'EVENT-GAP-ONB',
  'EVENT-GAP-ONB-002': 'EVENT-GAP-ONB',
  'EVENT-GAP-PLACEMENT-PLAN': 'EVENT-GAP-PLACEMENT',
  'EVENT-GAP-CONTENT-DUPLICATE': 'EVENT-GAP-CONTENT',
  'EVENT-GAP-BIND-CONT-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-ASM-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-LRN-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-GAM-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-SOC-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-NOTIF-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-BIND-PRIV-001': 'EVENT-GAP-BIND',
  'EVENT-GAP-USR-DEL-001': 'EVENT-GAP-USR-DEL',
  [EVENT_GAP_ALIAS]: 'EVENT-GAP-BIND',
};

const ownerTasks = Object.fromEntries([
  ...EXPECTED_CONTRACT_GAPS.map((id, index) => [id, [`P1R-M1-${String([8, 8, 17, 15, 8, 14, 16, 16, 13, 9, 11, 12, 12, 13, 17, 17, 3, 13, 13, 13, 9, 13, 16, 17][index]).padStart(3, '0')}`]]),
  ['EVENT-GAP-IAM-001', [...M1018_IAM_GAP_D2_CLOSURE_TASKS['EVENT-GAP-IAM-001']]],
  ['EVENT-GAP-BIND-IAM-001', [...M1018_IAM_GAP_D2_CLOSURE_TASKS['EVENT-GAP-BIND-IAM-001']]],
  ['EVENT-GAP-BIND-IAM-002', [...M1018_IAM_GAP_D2_CLOSURE_TASKS['EVENT-GAP-BIND-IAM-002']]],
  ['EVENT-GAP-ONB-001', ['P1R-M1-006', 'P1R-M1-011']],
  ['EVENT-GAP-ONB-002', ['P1R-M1-006', 'P1R-M1-012']],
  ['EVENT-GAP-PLACEMENT-PLAN', ['P1R-M1-006', 'P1R-M1-012']],
  ['EVENT-GAP-CONTENT-DUPLICATE', ['P1R-M1-006', 'P1R-M1-008']],
  ['EVENT-GAP-BIND-CONT-001', ['P1R-M1-006', 'P1R-M1-008']],
  ['EVENT-GAP-BIND-ASM-001', ['P1R-M1-006', 'P1R-M1-010', 'P1R-M1-013']],
  ['EVENT-GAP-BIND-LRN-001', ['P1R-M1-006', 'P1R-M1-013']],
  ['EVENT-GAP-BIND-GAM-001', ['P1R-M1-006', 'P1R-M1-014']],
  ['EVENT-GAP-BIND-SOC-001', ['P1R-M1-006', 'P1R-M1-014']],
  ['EVENT-GAP-BIND-NOTIF-001', ['P1R-M1-006', 'P1R-M1-016']],
  ['EVENT-GAP-BIND-PRIV-001', ['P1R-M1-006', 'P1R-M1-017']],
  ['EVENT-GAP-USR-DEL-001', ['P1R-M1-006', 'P1R-M1-017']],
  [EVENT_GAP_ALIAS, ['P1R-M1-006', 'P1R-M1-018']],
]);

function acceptedTask(id) {
  return { id, status: 'ACCEPTED' };
}

function staticReports() {
  return Object.fromEntries(policy.requiredStaticChecks.map((check) => [check.id, {
    result: 'PASS',
    exitCode: 0,
    executed: true,
    argv: [...check.argv],
  }]));
}

function futureCatalog() {
  const nextCatalog = structuredClone(catalog);
  const existingByName = new Map((nextCatalog.events ?? []).map((event) => [event.eventName, event]));
  for (const sourceEvent of iamFragment.events) {
    const event = {
      ...structuredClone(sourceEvent),
      status: 'CANONICAL_D2',
      'x-p1r-governance': structuredClone(M1018_IAM_CANONICAL_EVENT_GOVERNANCE[sourceEvent.eventName].governance),
    };
    const existing = existingByName.get(sourceEvent.eventName);
    if (existing) Object.assign(existing, event);
    else nextCatalog.events.push(event);
  }
  for (const [name, schema] of Object.entries(iamFragment.payloadSchemas)) nextCatalog.payloadSchemas[name] = structuredClone(schema);
  const byGap = new Map(nextCatalog['x-p1r-event-governance'].plannedClosures.map((closure) => [closure.gapId, closure]));
  nextCatalog['x-p1r-event-governance'].plannedClosures = [...EXPECTED_ATOMIC_EVENT_GAPS, EVENT_GAP_ALIAS].map((gapId) => ({
    ...(byGap.get(gapId) ?? {}),
    gapId,
    family: eventGapFamilies[gapId],
    status: 'D2_CONTRACT_CLOSED',
    d2ClosureTasks: [...ownerTasks[gapId]],
  }));
  return nextCatalog;
}

function fixture() {
  const nextRegistry = structuredClone(registry);
  const nextCatalog = futureCatalog();
  const tasks = new Map();
  for (const ids of Object.values(ownerTasks)) for (const id of ids) tasks.set(id, acceptedTask(id));
  for (const id of ['P1R-M4-007', 'P1R-M5-010', 'P1R-M8-002', 'P1R-M8-003', 'P1R-M8-004', 'P1R-M8-006']) tasks.set(id, acceptedTask(id));
  tasks.set('P1R-M1-018', { id: 'P1R-M1-018', status: 'IN_PROGRESS' });
  const manifests = {};
  for (const gap of nextRegistry.gaps) {
    if (!EXPECTED_CONTRACT_GAPS.includes(gap.id) && !EXPECTED_ATOMIC_EVENT_GAPS.includes(gap.id) && gap.id !== EVENT_GAP_ALIAS) continue;
    const ids = ownerTasks[gap.id];
    gap.closureTasks = [...ids];
    gap.status = 'OPEN';
    gap.closureEvidence = null;
    const taskId = ids[0];
    const evidencePath = `evidence/p1r/m1/${taskId}/manifest.json`;
    manifests[evidencePath] ??= {
      taskId,
      canonicalTaskStatus: 'ACCEPTED',
      sourceCommit: 'a'.repeat(40),
      sourceIds: [taskId],
      actors: ['owner-agent'],
      reviewer: 'independent-reviewer',
      decision: 'ACCEPTED',
    };
    manifests[evidencePath].sourceIds.push(gap.id);
  }
  return {
    policy: structuredClone(policy),
    matrixMarkdown,
    registry: nextRegistry,
    catalog: nextCatalog,
    ownerPolicy,
    iamFragment: structuredClone(iamFragment),
    b26Runtime: structuredClone(b26Runtime),
    g0: structuredClone(g0),
    g3: structuredClone(g3),
    m0_006: structuredClone(m0_006),
    tasks: [...tasks.values()],
    manifests,
    iamEventDecision: structuredClone(policy.iamEventDecision),
    staticChecks: staticReports(),
    requireStaticChecks: true,
  };
}

function evaluate(mutate = () => {}) {
  const input = fixture();
  mutate(input);
  return validateM1018D2TotalGateData(input);
}

function prepareFinal(input) {
  input.mode = 'final';
  const task = input.tasks.find((item) => item.id === 'P1R-M1-018');
  task.status = 'ACCEPTED';
  for (const gap of input.registry.gaps) {
    if (!EXPECTED_CONTRACT_GAPS.includes(gap.id) && !EXPECTED_ATOMIC_EVENT_GAPS.includes(gap.id) && gap.id !== EVENT_GAP_ALIAS) continue;
    const taskId = gap.closureTasks[0];
    gap.status = 'CLOSED';
    gap.closureEvidence = `evidence/p1r/m1/${taskId}/manifest.json`;
  }
}

test('review mode accepts source-ready catalog while all target registry records remain open', () => {
  const report = evaluate();
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.deepEqual(report.summary, {
    contractGapCount: 24,
    atomicEventGapCount: 15,
    eventGapAliasCount: 1,
    eventGapRecordCount: 16,
    closedContractGapCount: 0,
    closedAtomicEventGapCount: 0,
    aliasStatus: 'OPEN',
    runtimeStatus: 'NOT_RUNTIME_VERIFIED',
    b26Decision: 'NO-GO',
  });
});

test('review mode accepts a mixed registry when existing closed records carry canonical evidence', () => {
  const report = evaluate((input) => {
    const gap = input.registry.gaps.find((item) => item.id === EXPECTED_CONTRACT_GAPS[0]);
    const taskId = gap.closureTasks[0];
    gap.status = 'CLOSED';
    gap.closureEvidence = `evidence/p1r/m1/${taskId}/manifest.json`;
  });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
});

test('final mode accepts only after every target registry record has canonical evidence', () => {
  const report = evaluate((input) => {
    prepareFinal(input);
  });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
});

test('final mode rejects the M1-018 owner task before its own acceptance', () => {
  const report = evaluate((input) => {
    prepareFinal(input);
    input.tasks.find((task) => task.id === 'P1R-M1-018').status = 'IN_PROGRESS';
  });
  assert.equal(report.result, 'FAIL');
  assert.match(report.errors.join('\n'), /P1R-M1-018.*ACCEPTED/);
});

const mutations = [
  ['policy contract count', (input) => { input.policy.expectedCounts.contractGaps = 25; }, /Contract|count/],
  ['policy atomic set, alias counted as event', (input) => { input.policy.atomicEventGapIds[0] = EVENT_GAP_ALIAS; }, /atomic Event|policy/],
  ['matrix missing gap', (input) => { input.matrixMarkdown = input.matrixMarkdown.replace('`CONTRACT-GAP-ADM-001`', '`CONTRACT-GAP-REMOVED`'); }, /matrix/],
  ['registry missing atomic record', (input) => { input.registry.gaps = input.registry.gaps.filter((gap) => gap.id !== EXPECTED_ATOMIC_EVENT_GAPS[0]); }, /registry/],
  ['review record carrying closure evidence', (input) => { input.registry.gaps.find((gap) => gap.id === EXPECTED_CONTRACT_GAPS[0]).closureEvidence = 'evidence/p1r/m1/P1R-M1-008/manifest.json'; }, /closure evidence/],
  ['missing owner task', (input) => { input.registry.gaps.find((gap) => gap.id === EXPECTED_CONTRACT_GAPS[0]).closureTasks = []; }, /closureTasks|owner/],
  ['fake Evidence path', (input) => { input.registry.gaps.find((gap) => gap.id === EXPECTED_CONTRACT_GAPS[0]).closureEvidence = 'evidence/b1/P1R-M1-008/manifest.json'; }, /Evidence|canonical|closure/],
  ['fake Evidence reviewer', (input) => { prepareFinal(input); const gap = input.registry.gaps.find((item) => item.id === EXPECTED_CONTRACT_GAPS[0]); input.manifests[gap.closureEvidence].reviewer = ''; }, /reviewer/],
  ['historical IAM v1 promotion', (input) => { input.catalog.events.find((event) => event.eventName === 'auth.account.registered.v1').status = 'CANONICAL_D2'; }, /historical|promoted/],
  ['client event producer', (input) => { input.catalog['x-p1r-event-governance'].transportPolicy.clientProducer = 'ALLOWED'; }, /client|transport/],
  ['catalog runtime promotion', (input) => { input.catalog['x-p1r-event-governance'].runtimeStatus = 'PASS'; }, /runtime/],
  ['B26 GO promotion', (input) => { input.b26Runtime.defaultDecision = 'GO'; }, /B26/],
  ['M0-006 blocker wash', (input) => { input.m0_006.decision = 'ACCEPTED'; input.m0_006.canonicalTaskStatus = 'ACCEPTED'; }, /M0-006/],
  ['alias closed without canonical evidence during review', (input) => { const gap = input.registry.gaps.find((item) => item.id === EVENT_GAP_ALIAS); gap.status = 'CLOSED'; gap.closureEvidence = null; }, /alias|Evidence|closure/],
];

for (const [name, mutate, expected] of mutations) {
  test(`fails closed: ${name}`, () => {
    const report = evaluate(mutate);
    assert.notEqual(report.result, 'PASS');
    assert.match(report.errors.join('\n'), expected);
  });
}

const iamMutations = [
  ['IAM decision opts out of cross-service events', (input) => { input.iamEventDecision.decision = 'NO_CROSS_SERVICE_EVENT'; }, /frozen|MINIMAL|decision/],
  ['IAM decision replaces one canonical event', (input) => { input.iamEventDecision.canonicalEventNames[0] = 'account.deletion.requested.v2'; }, /frozen|canonical|IAM/],
  ['IAM catalog deletes bootstrap event', (input) => { input.catalog.events = input.catalog.events.filter((event) => event.eventName !== iamEventNames[0]); }, /missing|exactly|IAM/],
  ['IAM catalog adds an extra canonical event', (input) => { input.catalog.events.push({ eventName: 'iam.unapproved.v2', domain: 'iam', status: 'CANONICAL_D2' }); }, /exactly|IAM/],
  ['IAM catalog changes producer owner', (input) => { input.catalog.events.find((event) => event.eventName === iamEventNames[0])['x-p1r-governance'].producer.service = 'learner-service'; }, /exactly|governance/],
  ['IAM catalog changes consumer group', (input) => { input.catalog.events.find((event) => event.eventName === iamEventNames[1])['x-p1r-governance'].consumers[0].consumerGroup = 'client-browser'; }, /exactly|governance/],
  ['IAM catalog changes Kafka topic', (input) => { input.catalog.events.find((event) => event.eventName === iamEventNames[2])['x-p1r-governance'].transport.topic = 'platform.other.v1'; }, /exactly|governance/],
  ['IAM catalog changes payload reference', (input) => { input.catalog.events.find((event) => event.eventName === iamEventNames[2]).payloadSchema.$ref = '#/payloadSchemas/Other'; }, /fragment|payload|IAM/],
  ['IAM fragment changes payload schema', (input) => { input.iamFragment.payloadSchemas.M1018IamAccountBootstrapCreated.required = []; }, /exactly|payload/],
];

for (const [name, mutate, expected] of iamMutations) {
  test(`fails closed: ${name}`, () => {
    const report = evaluate(mutate);
    assert.notEqual(report.result, 'PASS');
    assert.match(report.errors.join('\n'), expected);
  });
}

const integrityMutations = [
  ['review contract record is not allowed to close', (input) => { input.registry.gaps.find((gap) => gap.id === EXPECTED_CONTRACT_GAPS[0]).status = 'CLOSED'; }, /status|Evidence|closure/],
  ['review owner task other than M1-018 is not accepted', (input) => { input.tasks.find((task) => task.id === 'P1R-M1-008').status = 'IN_PROGRESS'; }, /ACCEPTED/],
  ['duplicate task input', (input) => { input.tasks.push({ id: 'P1R-M1-018', status: 'ACCEPTED' }); }, /duplicates/],
  ['duplicate matrix input', (input) => { const row = '| `CONTRACT-GAP-ADM-001` | M1-008 |'; input.matrixMarkdown = input.matrixMarkdown.replace(row, `${row}\n${row}`); }, /duplicates/],
  ['duplicate matrix closure owner', (input) => { input.matrixMarkdown = input.matrixMarkdown.replace('M1-006/011', 'M1-006/006/011'); }, /duplicates a task/],
  ['duplicate manifest input', (input) => { input.manifests = [{ path: 'evidence/p1r/m1/P1R-M1-008/manifest.json', manifest: input.manifests['evidence/p1r/m1/P1R-M1-008/manifest.json'] }, { path: 'evidence/p1r/m1/P1R-M1-008/manifest.json', manifest: input.manifests['evidence/p1r/m1/P1R-M1-008/manifest.json'] }]; prepareFinal(input); }, /duplicates/],
  ['catalog closure remains planned', (input) => { input.catalog['x-p1r-event-governance'].plannedClosures[0].status = 'PLANNED'; }, /D2_CONTRACT_CLOSED/],
  ['catalog closure duplicates an owner task', (input) => { const closure = input.catalog['x-p1r-event-governance'].plannedClosures.find((item) => item.gapId === 'EVENT-GAP-ONB-001'); closure.d2ClosureTasks.push(closure.d2ClosureTasks[0]); }, /duplicate-free/],
  ['static reports are omitted', (input) => { delete input.staticChecks; }, /static checker/],
  ['static report command is forged', (input) => { input.staticChecks['api-contract'].argv = ['scripts/forged.mjs']; }, /argv/],
  ['static report is not PASS', (input) => { input.staticChecks['event-governance'].result = 'FAIL'; }, /did not report PASS/],
  ['static checker bypass flag', (input) => { input.requireStaticChecks = false; }, /disabled/],
  ['checkpoint is retargeted', (input) => { input.policy.sourceCheckpoint = 'a'.repeat(40); }, /checkpoint/],
  ['task start commit is retargeted', (input) => { input.policy.taskStartCommit = 'b'.repeat(40); }, /taskStartCommit/],
  ['canonical input path is retargeted', (input) => { input.policy.canonicalInputs.eventCatalog = 'config/fake.json'; }, /canonical input/],
  ['mode policy is weakened', (input) => { input.policy.modes.review.allowTargetRegistryStatus = 'CLOSED'; }, /mode/],
  ['prohibition is removed', (input) => { input.policy.prohibitions.pop(); }, /prohibitions/],
];

for (const [name, mutate, expected] of integrityMutations) {
  test(`fails closed: ${name}`, () => {
    const report = evaluate(mutate);
    assert.notEqual(report.result, 'PASS');
    assert.match(report.errors.join('\n'), expected);
  });
}

test('matrix parser exposes exact GAP ownership cells', () => {
  const parsed = parseM1018Matrix(matrixMarkdown);
  assert.equal(parsed.ids.length, 45);
  assert.deepEqual(parsed.closureTasks['EVENT-GAP-BIND'], ['P1R-M1-006', 'P1R-M1-018']);
});
