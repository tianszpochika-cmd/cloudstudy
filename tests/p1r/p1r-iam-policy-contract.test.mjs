import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  validateIamPolicyContract,
  validateIamPolicyContractData,
} from '../../scripts/audit/p1r-iam-policy-contract-check.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const fragment = JSON.parse(fs.readFileSync(path.join(root, 'packages', 'contracts', 'fragments', 'b8', 'b8-auth-iam.openapi.json'), 'utf8'));

function assertMutationFails(mutate, expected) {
  const document = structuredClone(fragment);
  mutate(document);
  const report = validateIamPolicyContractData({ document });
  assert.equal(report.result, 'FAIL', report.errors.join('\n'));
  assert(report.errors.some((error) => expected.test(error)), `missing ${expected}; got ${report.errors.join('\n')}`);
}

test('IAM policy contract audit passes the real B8 fragment without a compatibility escape', () => {
  const report = validateIamPolicyContract({ root });
  assert.equal(report.result, 'PASS', report.errors.join('\n'));
  assert.deepEqual(report.errors, []);
  assert.equal(report.summary.requiredPolicyOperationCount, 8);
  assert.equal(report.summary.coveredPolicyOperationCount, 8);
  assert.equal(report.summary.structuredPdpOperationCount, 1);
});

test('client role, tenant and owner values cannot become authorization facts', () => {
  assertMutationFails((document) => {
    document['x-b8-iam-policy-governance'].clientAuthority.trusted = true;
    document['x-b8-iam-policy-governance'].clientAuthority.prohibitedAuthorityFields = [];
  }, /client authority must be explicitly untrusted|client authority prohibition is incomplete/);
});

test('principal tenant and role facts must retain server provenance', () => {
  assertMutationFails((document) => {
    document.components.schemas.B8AuthorityProvenance.properties.authority.const = 'CLIENT_ASSERTED';
  }, /authority provenance must be IAM_SERVER_DERIVED/);
});

test('adult confirmation and birth year cannot directly pass the adult Gate', () => {
  assertMutationFails((document) => {
    document.components.schemas.B8AdultGateRequest['x-server-decision-required'].rule = 'confirmed birthYear grants access';
  }, /adult Gate input must not directly authorize access/);
});

test('adult Gate cannot lose policy evidence or revalidation', () => {
  assertMutationFails((document) => {
    document.components.schemas.B8AdultGateResponse.required = ['status', 'learningAccess', 'effectiveAt'];
  }, /adult Gate response lacks authoritative policy\/evidence\/revalidation fields/);
});

test('required consent cannot lose document digest or withdrawal restriction', () => {
  assertMutationFails((document) => {
    document.components.schemas.B8Consent.required = document.components.schemas.B8Consent.required.filter((field) => !['document', 'withdrawalEffect', 'revalidation'].includes(field));
  }, /consent record lacks purpose\/document\/withdrawal\/revalidation facts/);
});

test('remote PDP cannot become the unconditional normal authorization path', () => {
  assertMutationFails((document) => {
    document.paths['/internal/v1/iam/policy-bundles/active'].get['x-pep-pdp'].perRequestRemotePdp = true;
  }, /normal PEP path must not call PDP for every request/);
});

test('remote PDP requires trusted service identity and structured owner provenance', () => {
  assertMutationFails((document) => {
    document.paths['/internal/v1/iam/pdp/decisions'].post.security = [{ bearerAuth: [] }];
    document.components.schemas.B8PdpResourceContext.required = ['resourceType', 'resourceId'];
  }, /PDP endpoint must require B8ServiceIdentity|PDP resource context lacks owner\/tenant\/rights provenance/);
});

test('missing policy or revocation facts must remain fail closed', () => {
  assertMutationFails((document) => {
    document.components.schemas.B8AuthorizationEnforcement.properties.defaultDecision.const = 'ALLOW';
    document['x-b8-iam-policy-governance'].pepPdp.failClosedOn = [];
  }, /authorization enforcement default must be DENY|PEP\/PDP fail-closed reasons are incomplete/);
});

test('policy document must bind roles to permissions and permissions to ABAC rules', () => {
  assertMutationFails((document) => {
    document.components.schemas.B8PolicyDocument.required = ['name', 'rules'];
    document.components.schemas.B8PolicyRule.required = ['effect', 'actions', 'resourceTypes', 'conditions'];
  }, /policy document must include RBAC role bindings|policy rule must bind required permissions/);
});

test('policy approval must be a server-derived second-person decision', () => {
  assertMutationFails((document) => {
    const approval = document.paths['/api/v1/iam/policy-versions/{policyVersionId}/approvals'].post;
    approval['x-separation-of-duties'].selfApproval = 'allowed';
    approval.requestBody.content['application/json'].schema = { type: 'object', properties: { approverId: { type: 'string' } } };
  }, /policy self-approval must be forbidden|must use B8PolicyApprovalRequest/);
});

test('policy activation and revocation cannot skip cache invalidation', () => {
  assertMutationFails((document) => {
    delete document.paths['/api/v1/iam/policy-versions/{policyVersionId}/activate'].post['x-cache-invalidation'];
    document.components.schemas.B8PolicyCacheInvalidationReceipt.properties.denyUntilCurrentVersionProven.const = false;
  }, /must require cache invalidation|PEPs must deny until the current policy version is proven/);
});

test('policy writes retain canonical idempotency, errors and correlation headers', () => {
  assertMutationFails((document) => {
    const operation = document.paths['/api/v1/iam/policy-versions/{policyVersionId}/revoke'].post;
    operation['x-idempotency'].required = false;
    operation.responses['403'] = { $ref: '#/components/responses/B8Forbidden' };
    delete document.components.responses.B8PolicyVersionMutation.headers['X-Trace-Id'];
  }, /must require Idempotency-Key|403 must use ApiForbidden|must expose X-Trace-Id/);
});
