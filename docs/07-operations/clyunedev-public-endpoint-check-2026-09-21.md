# clyunedev 公网入口独立复核（2026-09-21）

> 结论：`clyunedev` 的官网、学习 Web、管理 Web 与 Gateway 健康接口均可从公网经 HTTPS 访问；本次只验证公网入口响应，**不构成**正式 `clyune.com` 生产发布、浏览器端到端验收或 Phase 1 验收。

## 复核范围与方法

- 复核日期：2026-09-21（Asia/Shanghai）。
- 复核位置：服务器外的 Windows 客户端；不依赖服务器本机 DNS resolver。
- 方法：对每个入口执行 HTTPS `GET`，跟随重定向，连接超时 10 秒、总超时 20 秒；记录 HTTP 状态、实际远端 IPv4、响应类型和公开响应体中的非敏感字段。
- 本次客户端没有服务器 root 的可用 SSH 私钥，故不能将本次公网观察扩展为服务器 Git SHA、Docker 容器、卷、秘密权限或本机日志的实时核验。

## 公网结果

| 入口 | 实际远端 IPv4 | HTTPS `GET` | 响应特征 |
| --- | --- | --- | --- |
| `https://clyunedev.com` | `37.120.160.36` | `200 OK` | `Server: nginx`，`Content-Type: text/html;charset=utf-8`；页面标题为“语学星｜让每一次学习都走向下一步” |
| `https://learn.clyunedev.com` | `37.120.160.36` | `200 OK` | `Server: nginx`，`Content-Type: text/html` |
| `https://admin.clyunedev.com` | `37.120.160.36` | `200 OK` | `Server: nginx`，`Content-Type: text/html` |
| `https://api.clyunedev.com/api/v1/health` | `37.120.160.36` | `200 OK` | `Server: nginx`，`Content-Type: application/json`，HSTS `max-age=31536000; includeSubDomains`，含 Gateway 请求 ID |

Gateway 健康接口的公开 JSON 表明：`service=api-gateway`、`status=UP`、`version=1.0.0`、`build=p1r-m2-001-boundary`。本次不记录会随请求变化的 `requestId`、`traceId` 和服务端时间，也不记录 Cookie、Token、秘密或用户数据。

## 关于 HTTP HEAD 的说明

首次使用 HTTP `HEAD` 请求 `https://api.clyunedev.com/api/v1/health` 时收到 `404`；随后以正确的健康探测语义执行 HTTP `GET`，得到上表所列的 `200 OK` 和健康 JSON。因此本报告以 `GET` 为可用性证据。

若将来有负载均衡器、外部监控或 CDN 使用 `HEAD` 监控该路径，应将此差异作为一个明确的兼容性检查项：要么让监控使用 `GET`，要么经受控变更为 Gateway/Nginx 明确支持同路径的 `HEAD`，并重新做公网验证。不要把本次 `GET` 成功推导为所有 HTTP 方法都已验证。

## 仍未由本次检查覆盖的事项

- 四个前端的真实浏览器加载、Console、CORS、注册/登录、错误态、移动响应式和业务链路。
- Gateway 到 IAM、领域服务、owner schema、Kafka、审计与工作流的逐跳真实业务调用。
- 服务器当前 Git SHA、Compose 容器/镜像版本、服务日志、健康检查、数据卷、备份恢复、告警与防火墙状态。
- 正式域名 `clyune.com`、正式生产发布与所有 Phase 1/合规 Gate。

继续服务器操作前，仍应先执行 [2026-09-21 跨电脑交接快照](clyunedev-cross-device-handoff-2026-09-21.md) 中的只读核验，且不得为解决状态差异而执行 `git reset --hard`、`git clean`、`docker system prune` 或 `docker compose down -v`。
