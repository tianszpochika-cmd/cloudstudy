import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
const read = (path) => readFile(join(root, path), "utf8");

async function collect(directory) {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (
      entry.isDirectory() &&
      ![".nuxt", ".output", "node_modules", "dist"].includes(entry.name)
    )
      files.push(...(await collect(path)));
    else if (/\.(mjs|ts|vue)$/.test(entry.name)) files.push(path);
  }
  return files;
}

test("official site reads a controlled Gateway base URL and restores locale/theme", async () => {
  const gateway = await read("apps/official-site/utils/gateway.ts");
  const links = await read(
    "apps/official-site/composables/useOfficialSiteLinks.ts",
  );
  const publicProjection = await read(
    "apps/official-site/server/api/public-projection.get.ts",
  );
  const foundation = await read("apps/official-site/utils/v2-foundation.ts");
  const app = await read("apps/official-site/app.vue");
  assert.match(gateway, /resolveGatewayBaseUrl/);
  assert.match(publicProjection, /resolveGatewayBaseUrl/);
  assert.match(links, /buildLearnerLoginLink/);
  assert.match(foundation, /localeStorage: browserStorage/);
  assert.match(foundation, /storage: browserStorage/);
  assert.match(app, /officialI18nAdapter\.restore\(\)/);
  assert.match(app, /officialThemeController\.restore\(\)/);
});

test("clyunedev official image builds mobile handoff with the public mobile origin", async () => {
  const compose = await read("infra/docker/clyunedev/docker-compose.core.yml");
  const dockerfile = await read("infra/docker/clyunedev/Dockerfile.official-site");
  assert.match(compose, /NUXT_PUBLIC_MOBILE_H5_URL:\s+https:\/\/mobile\.clyunedev\.com/);
  assert.match(dockerfile, /ARG NUXT_PUBLIC_MOBILE_H5_URL/);
  assert.match(dockerfile, /NUXT_PUBLIC_MOBILE_H5_URL="\$\{NUXT_PUBLIC_MOBILE_H5_URL\}"/);
});

test("official site applies explicit URL locale/theme preferences after restore", async () => {
  const app = await read("apps/official-site/app.vue");
  const header = await read("apps/official-site/components/SiteHeader.vue");
  assert.match(app, /route\.query\.locale/);
  assert.match(app, /route\.query\.theme/);
  assert.match(app, /resolvePublicUiLocale/);
  assert.match(app, /resolvePublicThemeMode/);
  assert.match(header, /officialI18nAdapter\.subscribe/);
  assert.doesNotMatch(header, /buildPublicLearningEntry|authLink|login-link|menu-login/);
});

// R1-001 supersedes 8a689ec5's closed-account UI policy. Canonical auth rules remain unchanged.
test("R1-001 public entry links to learner registration and retains adult/read-only boundaries", async () => {
  const header = await read("apps/official-site/components/SiteHeader.vue");
  const start = await read("apps/official-site/pages/start.vue");
  const button = await read("apps/official-site/components/SiteStartButton.vue");
  const links = await read("apps/official-site/composables/useOfficialSiteLinks.ts");
  const home = await read("apps/official-site/pages/index.vue");
  const courseIndex = await read("apps/official-site/pages/courses/index.vue");
  const copy = await read("packages/i18n/src/official-site.ts");
  assert.match(header, /SiteStartButton/);
  assert.match(header, /menu-example/);
  assert.doesNotMatch(header, /menu-login|login-link|authLink/);
  for (const source of [button, start, courseIndex]) assert.match(source, /registerLink\(\)/);
  assert.match(links, /buildPublicLearningEntry/);
  assert.match(start, /data-register-entry/);
  assert.match(start, /data-sample-entry/);
  assert.match(start, /to="\/#practice-example"/);
  assert.match(start, /role="status"[\s\S]*official\.c8a7b34f12/);
  assert.equal((start.match(/official\.c8a7b34f12/g) || []).length, 1);
  assert.match(home, /id="practice-example"/);
  assert.match(copy, /18 岁以上成人与大学生/);
  assert.match(copy, /通过前不开放学习能力/);
  assert.match(copy, /c03e46770e: "去注册"/);
  assert.match(copy, /r1CoursesPreparing: "课程准备中"/);
  assert.match(copy, /c7044fa394: "界面示意"/);
  assert.match(copy, /个人数据查看、导出和删除功能当前无法通过学习账号访问/);
  assert.doesNotMatch(copy, /学习账号注册与登录(?:当前)?暂不可用|学习账号注册暂不可用/);
  assert.doesNotMatch(copy, /初期免费开放|初期开放的学习功能免费使用|同一个账号登录即可查看已经保存/);
});

test("official site exposes all eight state semantics without color-only status", async () => {
  const state = await read("apps/official-site/utils/public-state.mjs");
  const helper = await read("apps/official-site/utils/ui-state.mjs");
  for (const value of [
    "loading",
    "empty",
    "error",
    "permission",
    "recovery",
    "offline",
    "success",
    "partial",
  ]) {
    assert.match(`${state}\n${helper}`, new RegExp(value));
  }
  assert.match(state, /toPublicUiState/);
  assert.match(state, /icon:/);
  assert.match(state, /role:/);
});

test("official site remains public read-only and has no client authority facts", async () => {
  const files = [
    "apps/official-site/app.vue",
    ...(
      await Promise.all(
        ["pages", "components", "composables", "utils", "server"].map(
          (directory) => collect(`apps/official-site/${directory}`),
        ),
      )
    ).flat(),
  ];
  const source = (await Promise.all(files.map(read))).join("\n");
  assert.doesNotMatch(
    source,
    /Math\.random|X-Role|X-Tenant|X-Owner|tenantId|ownerId/i,
  );
  assert.doesNotMatch(
    source,
    /createOrder|createPayment|createEntitlement|paymentCallback|webhook/i,
  );
  assert.doesNotMatch(source, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
});
