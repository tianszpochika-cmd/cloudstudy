import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
// Reuse the previous independent check in a new output directory; historical
// submitted files remain immutable. All source loading reads the current tree.
const original=fs.readFileSync(path.join(dir,'../reviewer-2/verify.mjs'),'utf8');
fs.writeFileSync(path.join(dir,'verification-run.mjs'),original.replaceAll('delivery-2.json','delivery-3.json').replaceAll("reviewer-2/","reviewer-3/"));
await import('./verification-run.mjs');
