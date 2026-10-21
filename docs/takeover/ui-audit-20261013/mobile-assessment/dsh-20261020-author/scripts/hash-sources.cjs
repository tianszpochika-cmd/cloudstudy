#!/usr/bin/env node
// Compute raw-byte and LF-normalized SHA-256 for one or more files.
// Usage: node hash-sources.cjs [--out file.json] <file> [file...]
const fs = require('fs');
const crypto = require('crypto');

const args = process.argv.slice(2);
let out = null;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') out = args[++i];
  else files.push(args[i]);
}

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const records = files.map((f) => {
  const abs = require('path').resolve(f);
  const buf = fs.readFileSync(abs);
  const lf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  return {
    file: f,
    abs,
    bytes: buf.length,
    rawSha256: sha(buf),
    lfSha256: sha(lf),
    lastWriteTime: fs.statSync(abs).mtime.toISOString(),
  };
});

const json = JSON.stringify(records, null, 2);
if (out) fs.writeFileSync(out, json + '\n');
process.stdout.write(json + '\n');
