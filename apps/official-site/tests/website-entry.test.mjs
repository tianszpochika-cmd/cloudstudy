import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicLearningEntry } from "../utils/public-links.mjs";
import { publicRoutes } from "../utils/site-content.mjs";

test("free entry uses device-specific register/login routes and fixed safe return paths", () => {
  for (const mobile of [false, true])
    for (const login of [false, true]) {
      const url = new URL(
        buildPublicLearningEntry({
          base: "https://learn.example.test/",
          mobile,
          login,
          theme: "dark",
          locale: "zh-CN",
          campaign: {
            utm_source: "official",
            redirect: "https://evil.test",
            returnTo: "//evil.test",
            access_token: "secret",
          },
        }),
      );
      const params = mobile
        ? new URLSearchParams(url.hash.split("?")[1])
        : url.searchParams;
      assert.equal(url.origin, "https://learn.example.test");
      assert.equal(
        params.get("returnTo"),
        mobile ? "/pages/home/home" : "/home",
      );
      assert.equal(params.get("theme"), "dark");
      assert.equal(params.get("utm_source"), "official");
      for (const forbidden of ["redirect", "access_token"])
        assert.equal(params.has(forbidden), false);
      assert.equal(
        mobile ? url.hash.split("?")[0] : url.pathname,
        mobile
          ? `#/pages/${login ? "login/login" : "register/register"}`
          : login
            ? "/login"
            : "/register",
      );
    }
});
test("entry configuration rejects credentials, executable URLs and embedded query/hash destinations", () => {
  for (const base of [
    "javascript:alert(1)",
    "https://name:password@example.test",
    "//evil.test",
    "https://example.test?returnTo=evil",
    "https://example.test/#/arbitrary",
  ])
    for (const mobile of [false, true])
      assert.throws(() => buildPublicLearningEntry({ base, mobile }));
});
test("sitemap exposes public website routes and six learning descriptions without retired pricing pages", () => {
  assert.equal(new Set(publicRoutes).size, publicRoutes.length);
  for (const route of [
    "/world",
    "/help",
    "/method",
    "/start",
    "/courses/daily-words",
    "/privacy",
  ])
    assert.ok(publicRoutes.includes(route));
  for (const route of ["/pricing", "/download", "/login", "/register"])
    assert.ok(!publicRoutes.includes(route));
});
