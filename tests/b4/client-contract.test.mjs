import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('B4 learner clients expose real page/state entry points', () => {
  const webRouter = read('apps/learner-web/src/router/index.ts');
  const mobilePages = read('apps/mobile/src/pages.json');
  const webApi = read('apps/learner-web/src/api/b4.ts');
  assert.match(webRouter, /path:\s*['"]\/world['"]\s*,[\s\S]{0,180}B4WorldPage\.vue/);
  assert.match(mobilePages, /pages\/world\/world/);
  assert.match(webApi, /listB4Notifications/);
  assert.match(webApi, /createB4GameSession|startB4GameSession/);
  assert.match(webApi, /startB4Focus\([^)]*durationMinutes/);
  assert.match(webApi, /updateB4OfflineDownload/);
  assert.match(webApi, /cleanupB4OfflineDownload/);
});

test('B4 client code keeps performance and offline state explicit', () => {
  const source = [
    'apps/learner-web/src',
    'apps/mobile/src',
  ].flatMap((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    const files = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const current = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(current);
        else if (/\.(ts|vue)$/.test(entry.name)) files.push(fs.readFileSync(current, 'utf8'));
      }
    };
    visit(absolutePath);
    return files;
  }).join('\n');
  for (const tier of ['Ultra', 'High', 'Medium', 'Performance']) assert.match(source, new RegExp(tier));
  assert.match(source, /offline|离线|弱网/i);
  assert.match(source, /暂停|恢复|pause|resume/i);
  assert.match(source, /growth\.nodes|galaxyNodes|VOCAB_ORBIT/);
  assert.match(source, /challengeToken/);
  assert.match(source, /itemCode/);
  assert.match(source, /PART_RECEIVED|downloadState/);
});

test('B4 game clients render server release metadata and disable unavailable sessions', () => {
  const web = read('apps/learner-web/src/pages/B4WorldPage.vue');
  const mobile = read('apps/mobile/src/pages/b4-games/b4-games.vue');
  const clientSource = [
    read('apps/learner-web/src/domain/b4.ts'),
    read('apps/learner-web/src/stores/b4.ts'),
    read('apps/mobile/src/domain/b4.ts'),
    read('apps/mobile/src/stores/b4.ts'),
  ].join('\n');
  for (const page of [web, mobile]) {
    assert.doesNotMatch(page, /六大|SIX RULED/);
    assert.match(page, /releasePhase/);
    assert.match(page, /disabled.*enabled/);
  }
  assert.match(clientSource, /B4_GAME_RELEASE_PHASES/);
  assert.match(clientSource, /enabled: value\.enabled === true/);
});
