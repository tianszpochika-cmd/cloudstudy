# B6 代码层验证与测试阶段交接

> 历史执行记录：本验证基于 v1 Java 17/`core-api` 兼容实现。它只证明 B6 旧任务的代码/静态证据，不证明 v2 Gateway、IAM/RBAC 或微服务迁移已完成；v2 验收须另按 `ARCH-*` 能力和新任务证据执行。

## 本轮范围

B6 按任务基线实现 13 个代码开发任务：

- `DEV-12-003/004/006/008/009/010`：Web/H5/App/iPad/微信小程序/PWA 构建矩阵、响应式与设备规则、四档性能和媒体降级、无障碍、四条客户端 E2E 场景清单、设备/弱网验收证据结构。
- `DEV-13-001~007`：质量门禁、关键路径、鉴权与敏感扫描边界、可靠性运行记录、可观测性看板、备份恢复演练记录、Fail-closed 发布 Gate。

## 已交付的代码证据

| 层 | 交付 |
|---|---|
| 契约 | `packages/contracts/fragments/b6-platform-quality.openapi.json`、B6 事件片段；生成到 `packages/contracts/openapi/v1/openapi.json` 和 `packages/contracts/generated/` |
| 数据 | `database/mysql/migrations/V0015__create_platform_quality_release_b6.sql`，包含构建、兼容性、质量运行、告警、备份演练和发布 Gate 事实表 |
| Core API | `modules/b6/B6PlatformService`、`B6PlatformController`；写操作幂等，构建/质量/恢复事实可回放，缺证据时 Gate 返回 `BLOCKED` |
| 前端 | `apps/learner-web/src/pages/B6PlatformPage.vue`、`apps/mobile/src/pages/b6-platform/b6-platform.vue`、`apps/admin-web/src/views/AdminB6ReleaseView.vue` |
| 性能 | `packages/performance/src/index.ts` 支持 Ultra/High/Medium/Performance、低帧率/内存/离线自动降级、禁止自动升档、Three.js/波形/Rive/粒子 fallback policy |
| 发布 | `config/b6-platform-matrix.json`、`scripts/release/validate-b6-platform-matrix.mjs`、Web PWA manifest/service worker、`tests/e2e/b6/b6-scenarios.json` |

## 代码层验证命令

```powershell
pnpm contracts:merge
pnpm contracts:generate
pnpm contracts:validate
pnpm db:validate
pnpm release:b6:check
pnpm test:b6
pnpm --filter @englishflow/performance typecheck
pnpm --filter @englishflow/learner-web typecheck
pnpm --filter @englishflow/admin-web build
pnpm exec tsc --noEmit -p apps/mobile/tsconfig.json
$mavenCmd = Join-Path $env:TEMP 'englishflow-maven-3.9.9\runtime\bin\mvn.cmd'
& $mavenCmd -f services/core-api/pom.xml -q -Dtest=B6PlatformServiceTest test
```

## 测试阶段待补证

1. Web/H5 浏览器真实 viewport、键盘/读屏、200% 字体、减少动效和截图基线。
2. iOS、Android、iPad 真机安装、横竖屏、权限拒绝、后台恢复和应用商店审核。
3. 微信小程序条件编译产物、审核材料和平台能力差异。
4. Windows PWA 离线缓存、更新、安装和回滚运行态。
5. 真实弱网、队列积压、媒体断点、幂等压力和故障注入；`B6_E2E_BASE_URL` 设置后可执行 `tests/e2e/b6/b6-core-paths.test.mjs` 的浏览器 smoke。
6. MySQL/Redis/S3 备份恢复、RTO/RPO 演练和发布回滚；真实支付/商户资质/版权/隐私 Gate 签字。

这些是测试、运行和发布证据，不阻塞本轮代码开发完成；没有证据时后端发布 Gate 会保持 `BLOCKED`，不会把代码层完成误报为可上线。
