# clyunedev 公网入口只读冒烟（2026-09-23）

本轮从本机经 HTTPS 对已登记的五个公网入口执行匿名 GET；没有登录、写入或查看 Cookie/Token。四个页面返回 200，Gateway 健康接口返回 200。响应长度仅用于证明非空，不作为页面加载或业务功能通过。

| 入口 | HTTP | Content-Type | 响应长度 |
| --- | ---: | --- | ---: |
| `https://clyunedev.com/` | 200 | `text/html; charset=utf-8` | 114204 |
| `https://learn.clyunedev.com/` | 200 | `text/html` | 641 |
| `https://admin.clyunedev.com/` | 200 | `text/html` | 447 |
| `https://mobile.clyunedev.com/` | 200 | `text/html` | 1040 |
| `https://api.clyunedev.com/api/v1/health` | 200 | `application/json` | 307 |

本机没有该服务器的运行环境文件/可核验镜像版本；这些匿名响应不能证明公网容器包含本轮修复，也不能证明 SPA JavaScript、API、登录、同意、媒体或学习闭环。当前 19 个本地 Docker 应用镜像仍是旧标签，且 `docker ps` 只显示本地基础设施。本轮源码修复优先在本地 Java/前端进程验证；待批量重建镜像后记录新标签，部署到服务器仍需独立版本与浏览器验收。

同一公网 Gateway 的公开课程目录与公开方案目录均返回 200、各 0 项；匿名 GET `/api/v1/grammar/points` 和 `/api/v1/learning/reports/DAILY` 均为 404。这些响应与本地发现的内容发布和技能/报告缺口一致，但仍不能反推服务器内部镜像 SHA 或授权用户结果。
