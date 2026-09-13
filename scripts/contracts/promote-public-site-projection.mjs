// One-shot contract promotion for the public site projection.
//
// Layer 1 to 3 move the canonical owner to content-service, which is where the controller is and
// where the endpoint's own meta says it is served. Layers 4 and 5 recompute every governance value
// with the modules that own those algorithms, so nothing is hand-computed. Layer 6 moves the two
// Gateway tests that pinned the previous baseline.
//
// Run without --apply to see what would change; run with --apply to write it.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const apply = process.argv.includes('--apply');
const note = (message) => console.log(`  ${apply ? '' : '[dry-run] '}${message}`);

// ---------------------------------------------------------------- layer 1: contract fragment
const fragmentPath = 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json';
let fragment = fs.readFileSync(fragmentPath, 'utf8');

const ownerBefore = '{ "ruleId": "public-site", "priority": 900, "match": { "type": "PREFIX", "path": "/api/v1/public/site", "methods": ["GET"] }, "upstreamOwner": "admin-ops-service"';
const ownerAfter = '{ "ruleId": "public-site", "priority": 900, "match": { "type": "PREFIX", "path": "/api/v1/public/site", "methods": ["GET"] }, "upstreamOwner": "content-service"';
if (!fragment.includes(ownerBefore)) throw new Error('layer 1: the public-site rule is not in the expected state');
fragment = fragment.replace(ownerBefore, ownerAfter);
note('layer 1a: public-site owner -> content-service');

const executionBefore = `        "ruleId": "public-site",
        "defaultStatus": "UNAVAILABLE",
        "defaultReason": "canonical_owner_admin_ops_conflicts_with_current_content_controller",
        "projections": []`;
const executionAfter = `        "ruleId": "public-site",
        "defaultStatus": "UNAVAILABLE",
        "defaultReason": "no_exact_canonical_execution_target",
        "projections": [
          {
            "projectionId": "public-site.projection",
            "status": "AVAILABLE",
            "publicPathTemplate": "/api/v1/public/site/projection",
            "methods": [
              "GET"
            ],
            "executionKind": "UPSTREAM",
            "upstreamOwner": "content-service",
            "targetUriConfig": "gateway.b14.service-base-urls.content",
            "pathStrategy": "PRESERVE_PUBLIC_PATH",
            "targetPathTemplate": "/api/v1/public/site/projection",
            "controllerEvidence": {
              "sourcePath": "services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java",
              "requestMapping": "/api/v1/public/site/projection"
            }
          }
        ]`;
if (!fragment.includes(executionBefore)) throw new Error('layer 1: the public-site execution entry is not in the expected state');
fragment = fragment.replace(executionBefore, executionAfter);
JSON.parse(fragment);
note('layer 1b: public-site execution entry now has one available projection');

// ---------------------------------------------------------------- layer 2 and 3: gateway code
const policyPath = 'services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRoutePolicy.java';
let policy = fs.readFileSync(policyPath, 'utf8');
const policyBefore = 'rule("public-site", 900, MatchType.PREFIX, "/api/v1/public/site", "admin-ops-service"';
if (!policy.includes(policyBefore)) throw new Error('layer 2: the public-site rule is not in the expected state');
policy = policy.replace(policyBefore, 'rule("public-site", 900, MatchType.PREFIX, "/api/v1/public/site", "content-service"');
note('layer 2: GatewayRoutePolicy owner -> content-service');

const executionPath = 'services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java';
let execution = fs.readFileSync(executionPath, 'utf8');
const evidenceAnchor = `    private static final ControllerEvidence CONTENT_LEARNER_CATALOG = evidence("content-service",`;
if (!execution.includes(evidenceAnchor)) throw new Error('layer 3: the evidence anchor is missing');
execution = execution.replace(evidenceAnchor, `    private static final ControllerEvidence CONTENT_PUBLIC_SITE_PROJECTION = evidence("content-service",
            "services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java", "/api/v1/public/site/projection");
${evidenceAnchor}`);

const definitionsAnchor = '        add(definitions, "public-commerce",';
if (!execution.includes(definitionsAnchor)) throw new Error('layer 3: the definitions anchor is missing');
execution = execution.replace(definitionsAnchor, `        add(definitions, "public-site",
                preserve("projection", "/api/v1/public/site/projection", CONTENT_PUBLIC_SITE_PROJECTION, HttpMethod.GET));
${definitionsAnchor}`);

const reasonLine = '            Map.entry("public-site", "canonical_owner_admin_ops_conflicts_with_current_content_controller"),\n';
if (!execution.includes(reasonLine)) throw new Error('layer 3: the fail-closed reason line is missing');
execution = execution.replace(reasonLine, '');
note('layer 3: projection added and the fail-closed reason removed');

// ---------------------------------------------------------------- layer 4: gateway contract check
const checkPath = 'scripts/audit/p1r-gateway-contract-check.mjs';
let check = fs.readFileSync(checkPath, 'utf8');
const checkReasonLine = "  'public-site': 'canonical_owner_admin_ops_conflicts_with_current_content_controller',\n";
if (!check.includes(checkReasonLine)) throw new Error('layer 4: the expected-unavailable reason line is missing');
check = check.replace(checkReasonLine, '');
note('layer 4a: public-site removed from the expected unavailable reasons');

if (apply) {
  fs.writeFileSync(fragmentPath, fragment);
  fs.writeFileSync(policyPath, policy);
  fs.writeFileSync(executionPath, execution);
  fs.writeFileSync(checkPath, check);
}

// ---------------------------------------------------------------- layer 5: governance digests
// Recomputed with the modules that own the algorithms, after layer 4 has been written so the
// imported check module reflects the new state.
const { executionTargetPlanDigest } = await import('../audit/p1r-gateway-contract-check.mjs');
const boundary = JSON.parse(fragment)['x-p1r-gateway-boundary'];

const planDigest = executionTargetPlanDigest(boundary);
const availableOperations = boundary.routeExecutions.reduce((total, entry) => total
  + entry.projections.reduce((count, projection) => count + (projection.status === 'AVAILABLE' ? projection.methods.length : 0), 0), 0);
note(`layer 5a: execution target plan digest -> ${planDigest.slice(0, 16)}…, operations -> ${availableOperations}`);
if (apply) {
  check = fs.readFileSync(checkPath, 'utf8');
  check = check.replace(/FROZEN_EXECUTION_TARGET_PLAN_SHA256 = '[0-9a-f]{64}'/u, `FROZEN_EXECUTION_TARGET_PLAN_SHA256 = '${planDigest}'`);
  check = check.replace(/EXPECTED_AVAILABLE_EXECUTION_OPERATION_COUNT = \d+/u, `EXPECTED_AVAILABLE_EXECUTION_OPERATION_COUNT = ${availableOperations}`);
  fs.writeFileSync(checkPath, check);
}

// The compatibility baseline digests are computed by compatibility-diff.mjs itself, but they read
// the canonical OpenAPI, which only reflects this change after the fragments are merged. Merging
// first is what makes these two digests describe the new state rather than the old one.
if (apply) {
  const merge = spawnSync(process.execPath, ['scripts/contracts/merge-b1-fragments.mjs', '--write'],
    { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
  if (merge.status !== 0) throw new Error(`merge failed: ${merge.stdout}\n${merge.stderr}`);
  note(`layer 5: fragments merged (${(merge.stdout ?? '').trim().slice(0, 70)})`);
}

const diff = await import('./compatibility-diff.mjs');
const canonical = JSON.parse(fs.readFileSync('packages/contracts/openapi/v1/openapi.json', 'utf8'));
const gatewayRoot = canonical[diff.M2001_OPENAPI_ROOT_EXTENSION];
const rootDigest = diff.stableGovernanceSha256(gatewayRoot);
const mergedBoundary = apply ? gatewayRoot : boundary;
const targetPolicyDigest = diff.stableGovernanceSha256(mergedBoundary.executionTargetPolicy);
note(`layer 5b: gateway root digest -> ${rootDigest}`);
note(`layer 5c: execution target policy digest -> ${targetPolicyDigest}`);

if (!apply) {
  console.log('');
  console.log('dry run complete. Re-run with --apply, then merge the fragments so the canonical OpenAPI');
  console.log('picks up the change, then recompute M2001_OPENAPI_EXPECTED_SEMANTIC_SHA256 from the merged');
  console.log('document with buildM2001OpenApiExpectedProjection and the frozen allowance.');
  process.exit(0);
}

let diffSource = fs.readFileSync('scripts/contracts/compatibility-diff.mjs', 'utf8');
diffSource = diffSource.replace(/M2001_GATEWAY_ROOT_SEMANTIC_SHA256 = '[0-9a-f]{64}'/u, `M2001_GATEWAY_ROOT_SEMANTIC_SHA256 = '${rootDigest}'`);
diffSource = diffSource.replace(/M2001_EXECUTION_TARGET_POLICY_SEMANTIC_SHA256 = '[0-9a-f]{64}'/u, `M2001_EXECUTION_TARGET_POLICY_SEMANTIC_SHA256 = '${targetPolicyDigest}'`);
fs.writeFileSync('scripts/contracts/compatibility-diff.mjs', diffSource);
console.log('  layers 1-5 applied. Next: pnpm contracts:merge, then the expected-projection digest.');
