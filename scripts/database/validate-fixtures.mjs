import fs from 'node:fs';
import path from 'node:path';
import { repositoryRoot } from './lib/migration-utils.mjs';

const fixturePath = path.join(repositoryRoot, 'tests', 'fixtures', 'mysql', 'core-foundation.json');
const seedPath = path.join(repositoryRoot, 'database', 'mysql', 'seeds', 'dev', 'V0001__core-foundation.sql');
const forbiddenKey = /^(password|token|accessToken|refreshToken|apiKey|secret|privateKey)$/i;
const forbiddenValue = /(?:^|[^\d])1[3-9]\d{9}(?:$|[^\d])|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function walk(value, location = '$') {
  if (Array.isArray(value)) return value.flatMap((item, index) => walk(item, `${location}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => {
      const errors = forbiddenKey.test(key) ? [`fixture 包含敏感字段名: ${location}.${key}`] : [];
      return errors.concat(walk(item, `${location}.${key}`));
    });
  }
  if (typeof value === 'string' && forbiddenValue.test(value)) return [`fixture 包含手机号或邮箱样式: ${location}`];
  return [];
}

const errors = [];
let fixture;
try {
  fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
} catch (error) {
  errors.push(`无法读取 fixture JSON: ${error.message}`);
}

if (fixture) {
  if (fixture.synthetic !== true) errors.push('fixture.synthetic 必须为 true');
  if (fixture.seedRunId !== 'seed-core-foundation-v1') errors.push('fixture.seedRunId 不符合固定合成标识');
  for (const required of ['mediaAssets', 'idempotencyKeys', 'outboxEvents', 'auditLogs']) {
    if (!Array.isArray(fixture[required]) || fixture[required].length === 0) errors.push(`fixture.${required} 必须为非空数组`);
  }
  errors.push(...walk(fixture));
}

if (!fs.existsSync(seedPath)) errors.push(`缺少 seed SQL: ${seedPath}`);
else {
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  if (!/seed-core-foundation-v1/.test(seedSql)) errors.push('seed SQL 缺少固定合成 seedRunId');
  if (/DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE/i.test(seedSql)) errors.push('seed SQL 包含禁止的破坏性语句');
  if (!/fixture\/core-foundation\//.test(seedSql)) errors.push('seed SQL 缺少 fixture asset_key 标记');
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log('合成 fixture 静态校验通过：无手机号、邮箱、凭证字段或破坏性清理语句');
}
