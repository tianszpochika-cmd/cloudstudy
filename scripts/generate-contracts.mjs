#!/usr/bin/env node
import { generateContracts } from './contracts/generate-contracts.mjs';

try {
  const result = generateContracts();
  console.log(`Contract generation passed: ${result.outputs.length} generated files.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
