import { printMigrationPlan, validateMigrationSet } from './lib/migration-utils.mjs';

const result = validateMigrationSet();
if (result.errors.length > 0) {
  for (const error of result.errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log(`迁移静态校验通过: ${result.migrations.length} 个迁移`);
  printMigrationPlan(result.migrations);
}
