# Batch22 私有镜像匿名浏览器烟测（2026-09-25）

## 范围与边界

Batch22 `verified` 后，在私有 HTTPS 入口运行了只读匿名浏览器烟测。没有填写账号、密码、Token，也没有提交会改变业务数据的请求。逐项结果见 [evidence.json](evidence.json)，汇总见 [summary.json](summary.json)。

覆盖项：

- 官网、Learner Web、Admin Web、Mobile H5 主入口在 390px 与 1280px 的布局、图片、Console 和失败请求；三套业务登录页（官网不持有业务登录，单独检查官网登录入口是否跳转到对应学习端）。
- 官网桌面登录入口跳转 Learner Web 登录，官网移动菜单登录入口跳转 Mobile H5 登录。
- Learner Web 通知设置深链、Admin Web 权限页深链匿名返回登录页，并核对 `redirect` 与 sessionStorage 中的 returnTo。
- Mobile H5 的 B12 社交入口（`/pages/b4-social/b4-social`，含 B12 社交扩展卡片）匿名返回 Mobile 登录页，核对最终 hash route 与双重编码解码后的 `returnTo`。
- 从每个样本页面执行浏览器端 JWKS fetch；统计页面/Console 错误、失败请求、390px 横向溢出、已加载破图和深链状态。

这些匿名入口结果只验证 HTTP/浏览器渲染、登录导航和 B12 受保护入口回登录，不代表任何授权后的学习、成长、管理或数据写入功能通过，也不能据此升级 PAGE-P1 状态。

## 运行前检查（只读）

运行前由主 Agent 确认 Batch22 已完成验证、目标仍为私有项目 `cloudstudy-uat-isolated-3c94b27160`，并确认此网络不连接共享项目：

```powershell
docker network inspect cloudstudy-uat-isolated-3c94b27160 --format '{{ index .Labels "com.docker.compose.project" }}'
docker inspect cloudstudy-uat-isolated-3c94b27160-https-proxy --format '{{ index .Config.Labels "com.cloudstudy.uat.project" }}'
docker image inspect cloudstudy-uat-isolated/browser:3c94b27160 --format '{{.Id}}'
```

预期 project 与 proxy label 都是 `cloudstudy-uat-isolated-3c94b27160`；预构建浏览器镜像 ID 应为 `sha256:816d356d1fc6fe69f21bfc308ae14ea97672041811ddd2d4983a1ffe8be8681f`。任一检查不匹配时停止并报告，不切换网络、镜像、端口或项目。

## 检查与执行

静态语法检查不访问浏览器或 Docker：

```powershell
node --check 'artifacts/uat-2026-09-25/docker-isolated-browser-batch22/probe-batch22.cjs'
```

在主 Agent 通知 Batch22 发布完成后，按 Batch21 的隔离方式运行唯一临时浏览器容器；容器只读挂载脚本，结果只写入本证据目录，`--rm` 自动移除临时容器：

```powershell
docker run --rm --network cloudstudy-uat-isolated-3c94b27160 --label com.cloudstudy.uat.project=cloudstudy-uat-isolated-3c94b27160 --mount "type=bind,source=C:\Users\Administrator\Desktop\my\cloudstudy\artifacts\uat-2026-09-25\docker-isolated-browser-batch22\probe-batch22.cjs,target=/probe.cjs,readonly" --mount "type=bind,source=C:\Users\Administrator\Desktop\my\cloudstudy\artifacts\uat-2026-09-25\docker-isolated-browser-batch22,target=/out" -e NODE_PATH=/opt/uat/node_modules --entrypoint node cloudstudy-uat-isolated/browser:3c94b27160 /probe.cjs
```

预期 16 个检查结果：8 个四端主入口视口、3 个直接登录页、2 个官网登录交接和 3 个匿名 returnTo 深链。脚本不执行 Docker build，也不对已运行的产品容器执行重建/重启。运行后需人工查看 390px 截图，尤其是四端主入口、官网移动登录交接、Mobile H5 登录及 B12 受保护入口回登录截图。

## 本次结果

16/16 页面 HTTP 200、16/16 浏览器内 JWKS CORS 200，官网登录交接 2/2、受保护深链 returnTo 3/3；失败请求、390px 横向溢出和破图均为 0。移动 B12 社交深链回登录时产生一条 `pageErrors: ["Object"]`，已在 [主报告](../batch22-isolated-uat.md)登记，仍待修复及新镜像复测。本目录的截图均由本次 Batch22 浏览器运行产生。
