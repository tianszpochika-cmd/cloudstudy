// Test-only ESM loader for the locked Node 20 runtime; tsc remains the type gate.
import { register } from 'node:module';
register('./typescript-loader.mjs', import.meta.url);
