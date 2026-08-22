# E2E 测试

至少覆盖新用户测评到首课、练习反馈到复习、内容发布到学习端可见三条路径。

B6 已登记四条跨端场景到 `tests/e2e/b6/b6-scenarios.json`。设置 `B6_E2E_BASE_URL` 后运行 `node --test tests/e2e/b6/b6-core-paths.test.mjs` 才会访问真实 Web 服务；未设置时只执行场景清单校验，不把未运行的浏览器证据误报为通过。
