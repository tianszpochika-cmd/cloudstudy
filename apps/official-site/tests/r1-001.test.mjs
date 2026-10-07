import test from "node:test";
import assert from "node:assert/strict";
import { createI18n } from "@englishflow/i18n";
import { officialWebsiteMessages } from "@englishflow/i18n/official-site";
import { publicRoutes } from "../utils/site-content.mjs";
import { buildPublicLearningEntry } from "../utils/public-links.mjs";

// Current-source R1 contract. Uses the already running fixed-port site; never starts a runner.
const origin = "http://127.0.0.1:18182";
const routes = ["/", "/courses", "/pricing", "/download", "/announcements", "/about", "/compliance", "/status", "/privacy", "/terms", "/minors"];
const read = async (route) => {
  const response = await fetch(origin + route, { redirect: "manual" });
  assert.equal(response.status, 200, route + " must be directly 200");
  return response.text();
};

test("R1-001 PAGE canonical eleven original URLs remain direct 200 public pages", async () => {
  for (const route of routes) {
    assert.ok(publicRoutes.includes(route), route + " must be indexed");
    const html = await read(route);
    assert.match(html, /<h1[\s>]/, route + " has visible page content");
    assert.doesNotMatch(html, /type=["']password["']/i, route + " does not receive passwords");
  }
});

test("R1-001 honest course, price and download messages do not promise approved offers", async () => {
  const courses = await read("/courses");
  assert.match(courses, /课程准备中/);
  assert.match(courses, /正式课程尚未发布/);
  const pricing = await read("/pricing");
  assert.match(pricing, /收费方案暂未开放/);
  assert.match(pricing, /不提供购买或支付入口/);
  const download = await read("/download");
  assert.match(download, /下载准备中/);
  assert.match(download, /不提供安装包或应用商店下载入口/);
  for (const html of [pricing, download]) {
    assert.doesNotMatch(html, /href=["'][^"']*\.(?:apk|ipa|exe|dmg)(?:[?"'])/i);
    assert.doesNotMatch(html, /¥\s*\d|￥\s*\d|data-purchase|data-checkout/);
  }
});

test("R1-001 handoff to learner registration has adult boundary and controlled URL preferences", async () => {
  const query = "?locale=zh-CN&theme=dark&utm_source=r1-audit&returnTo=%2F%2Fevil.test&redirect=https%3A%2F%2Fevil.test&access_token=forbidden";
  const html = await read("/start" + query);
  assert.match(html, /18 岁以上成人与大学生/);
  assert.match(html, /通过前不开放学习能力/);
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));
  const registration = hrefs.map((h) => new URL(h, origin)).filter((u) => u.pathname === "/register");
  assert.ok(registration.length > 0, "actual SSR page exposes registration");
  for (const url of registration) {
    assert.equal(url.origin, "http://127.0.0.1:18180");
    assert.equal(url.searchParams.get("returnTo"), "/home");
    assert.equal(url.searchParams.get("uiLocale"), "zh-CN");
    assert.equal(url.searchParams.get("theme"), "dark");
    assert.equal(url.searchParams.get("utm_source"), "r1-audit");
    for (const key of ["access_token", "redirect", "owner", "tenant", "role"]) assert.equal(url.searchParams.has(key), false);
  }
  assert.match(html, /href="\/#practice-example"/);
  // Helper still rejects unsafe configured origins; the site doesn't build an arbitrary destination.
  assert.throws(() => buildPublicLearningEntry({ base: "javascript:alert(1)" }));
});

test("R1-001 en-US UI resolves actual shared zh-CN fallback without changing content locale", () => {
  const i18n = createI18n({ locale: "en-US", contentLocale: "en-US", messages: officialWebsiteMessages });
  for (const [key, expected] of [
    ["r1CoursesPreparing", "课程准备中"],
    ["r1PricingPreparing", "收费方案暂未开放"],
    ["r1DownloadPreparing", "下载准备中"],
    ["c03e46770e", "去注册"],
  ]) assert.equal(i18n.t("official." + key), expected);
  assert.equal(i18n.locale, "en-US");
  assert.equal(i18n.contentLocale, "en-US");
});
