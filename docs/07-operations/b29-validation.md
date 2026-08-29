# B29 后端真实运行验证

> 日期：2026-08-24  
> 模式：`local-real`  
> 结论：B29 已完成；B30 自有 IAM JWT 注册登录仍未开始。

## 1. 运行证据

真实探针 `scripts/runtime/b29-runtime-probe.mjs` 在本机运行中的 14 个 Java 进程上采集了外部证据：

- 证据文件：`evidence/b29/b29-runtime-20260824125527.json`
- 14/14 进程拥有独立 PID、Java 25、固定 loopback 端口和可追溯产物；
- 14/14 readiness/liveness 返回 `UP/200`；
- Gateway `/api/v1` 受保护请求未认证返回 `401`，响应带 `X-Request-Id` 和 `X-Trace-Id`；
- 11 个领域 owner schema 和 IAM schema 可由独立账号连接读取，core-api 保持 legacy compatibility；
- 当前尚未承载 Phase 1 本机业务事实的 `media-service`、`gamification-service`、`social-service`、`commerce-service`、`admin-ops-service`、`analytics-service` 在 `local-real` 下为明确 fail-closed，不提供内存或静态业务事实，也未被前端路径路由。

## 2. 验证命令

```powershell
pnpm test:b29
pnpm b29:static
pnpm b29:probe
$env:B29_RUNTIME_EVIDENCE_FILE = 'evidence/b29/b29-runtime-20260824125527.json'
pnpm b29:bootstrap
Remove-Item Env:B29_RUNTIME_EVIDENCE_FILE
```

结果：B29 测试 `7/7`，静态检查 `256`，运行检查 `8/8`，`runtimeGate=runtime-verified`。

## 3. 真实边界

B29 只证明后端进程、端口、健康、网关安全边界、owner schema 和观测基础可以真实运行；它不证明注册登录、有效 JWT、认证后学习业务、Kafka/Outbox 联动或四端页面已经可用。下一章 B30 必须启动平台自有 IAM JWT/JWKS，并以浏览器注册账号后继续完成 IAM principal/session/audit 的数据库读回。
