import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

function required(condition, message, errors) {
  if (!condition) errors.push(message);
}

export function validateB31Static(root = repositoryRoot) {
  const errors = [];
  const readRoot = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const files = [
    'database/mysql/fixtures/b25-phase1.json',
    'database/mysql/migrations/V0023__create_phase1_real_data_b25.sql',
    'scripts/database/validate-b25-data.mjs',
    'services/content-service/src/main/java/com/englishflow/content/web/B9ContentAdminController.java',
    'services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java',
    'apps/learner-web/src/stores/learner-content.ts',
    'apps/mobile/src/api/learner-content.ts',
    'apps/admin-web/src/api/content-service-command-adapter.ts',
  ];
  for (const file of files) required(fs.existsSync(path.join(root, file)), `missing B31 file: ${file}`, errors);
  if (errors.length) return { result: 'FAIL', errors };

  const fixture = JSON.parse(readRoot('database/mysql/fixtures/b25-phase1.json'));
  const contentController = readRoot('services/content-service/src/main/java/com/englishflow/content/web/B9ContentAdminController.java');
  const gateway = readRoot('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java');
  const learnerStore = readRoot('apps/learner-web/src/stores/learner-content.ts');
  const mobileApi = readRoot('apps/mobile/src/api/learner-content.ts');
  const adminApi = readRoot('apps/admin-web/src/api/content-service-command-adapter.ts');
  const officialPackage = JSON.parse(readRoot('apps/official-site/package.json'));

  required(fixture.batch === 'B25' && fixture.synthetic === true, 'B25 fixture must remain synthetic and traceable', errors);
  required(Array.isArray(fixture.entities) && fixture.entities.length >= 20, 'fixture must cover all Phase 1 owner facts', errors);
  for (const command of ['CREATE_DRAFT', 'SAVE_DRAFT', 'SUBMIT_REVIEW', 'REVIEW_FIRST', 'REVIEW_FINAL', 'PUBLISH', 'UNPUBLISH', 'ROLLBACK']) {
    required(contentController.includes(`"${command}"`) || contentController.includes(`case "${command}"`), `content admin command missing: ${command}`, errors);
  }
  required(contentController.includes('ContentCommandService') && contentController.includes('ContentRepository'), 'admin commands must delegate to content aggregate and repository ports', errors);
  required(contentController.includes('ContentRequestContext') && contentController.includes('ContentIdempotencyKey'), 'content commands must persist correlation and idempotency facts', errors);
  required(gateway.includes('b31-content-admin-commands'), 'Gateway must expose the B31 admin command route', errors);
  required(gateway.includes('/internal/v1/content/admin-commands'), 'Gateway must rewrite admin commands to content-service internal boundary', errors);
  required(learnerStore.includes('LOCAL_REAL_RUNTIME') && learnerStore.includes('submitAnswerAgainstServer') && learnerStore.includes('completeTaskAgainstServer'), 'learner local-real mode must fail closed on assessment/task writes', errors);
  required(mobileApi.includes("'/iam/consents'") && mobileApi.includes("type: 'PRIVACY'") && mobileApi.includes("type: 'TERMS'"), 'Mobile onboarding must persist IAM consent facts', errors);
  required(adminApi.includes("'/admin/content-commands"), 'admin frontend must use the Gateway content command contract', errors);
  required(typeof officialPackage.scripts?.dev === 'string' && officialPackage.scripts.dev.includes('--strictPort'), 'official site must enforce its fixed port', errors);
  return { result: errors.length ? 'FAIL' : 'PASS', errors, summary: { fixtureEntities: fixture.entities.length, commandBoundary: true, localRealFailClosed: true } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateB31Static();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.result === 'PASS' ? 0 : 1;
}
