#!/usr/bin/env node
import { validateContracts } from './contracts/validate-contracts.mjs';

try {
  const result = validateContracts({ quiet: process.argv.includes('--json') });
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
