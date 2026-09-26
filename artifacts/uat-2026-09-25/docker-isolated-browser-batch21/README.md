# Batch21 私有 Docker 四端浏览器冒烟

## 范围

本次仅访问 Batch21 私有栈的 HTTPS 入口，浏览器全程匿名。没有提交账号、密码、Token 或业务写请求。运行容器使用 `--rm`，证据只写入本目录。

运行前复核到 Docker 网络 `cloudstudy-uat-isolated-3c94b27160` 的 Compose project label 和 HTTPS proxy 的 `com.cloudstudy.uat.project` label 都是 `cloudstudy-uat-isolated-3c94b27160`；网络内 24 个容器名均以该私有项目名前缀开头。复用已有浏览器镜像 `cloudstudy-uat-isolated/browser:3c94b27160`，镜像 ID 为 `sha256:816d356d1fc6fe69f21bfc308ae14ea97672041811ddd2d4983a1ffe8be8681f`。浏览器临时容器自身也带相同项目 label。

## 结果

- 11 个官网、学习 Web、管理 Web、移动 H5 页面样本覆盖 390px 和 1280px 视口，并补充 2 个匿名深链回登录测试；合计 **13/13 HTTP 200**。
- 从全部 13 个页面执行到 JWKS 的浏览器跨域 fetch，**13/13 返回 HTTP 200**；浏览器成功读取响应，代表本次 fetch 没有触发 CORS 拒绝。`Access-Control-Allow-Origin` 响应头在页面脚本中不可读（记录为 `null`），因此本证据不单独断言其头字段值。
- **0** 页面/控制台错误、**0** 失败请求、**0** 横向溢出、**0** 已加载后损坏的图片。
- Learner 深链 `/settings/notifications?tab=in-app#preferences` 和 Admin 深链 `/permissions?scope=roles` 均匿名进入登录页；登录页 `redirect` 和 sessionStorage 的 owner return-to 值都完整保留，**2/2**。
- 人工查看四端 390px 截图：没有明显裁切或横向漂移；官网长页内容连续，学习端、管理端和移动 H5 登录卡片均完整显示。

这些结果只说明当前私有镜像的匿名入口、浏览器渲染和深链回登录状态可见。没有授权会话，因此不代表登录后学习、教研、运营、数据保存或完整业务流程通过，也不新增 PAGE-P1 PASS。

## 复跑

语法检查：

```powershell
node --check 'artifacts/uat-2026-09-25/docker-isolated-browser-batch21/probe-batch21.cjs'
```

浏览器复测使用已核验的私有网络和本地镜像；`--rm` 自动移除临时容器：

```powershell
docker run --rm --network cloudstudy-uat-isolated-3c94b27160 --label com.cloudstudy.uat.project=cloudstudy-uat-isolated-3c94b27160 --mount "type=bind,source=C:\Users\Administrator\Desktop\my\cloudstudy\artifacts\uat-2026-09-25\docker-isolated-browser-batch21\probe-batch21.cjs,target=/probe.cjs,readonly" --mount "type=bind,source=C:\Users\Administrator\Desktop\my\cloudstudy\artifacts\uat-2026-09-25\docker-isolated-browser-batch21,target=/out" -e NODE_PATH=/opt/uat/node_modules --entrypoint node cloudstudy-uat-isolated/browser:3c94b27160 /probe.cjs
```

## 证据

- [结构化浏览器结果](evidence.json)
- [指标摘要](summary.json)
- 四端主页面截图：`official-site-{390,1280}.png`、`learner-web-{390,1280}.png`、`admin-web-{390,1280}.png`、`mobile-h5-{390,1280}.png`
- 直接登录页截图：`learner-login-1280.png`、`admin-login-1280.png`、`mobile-login-390.png`
- 深链回登录截图：`learner-notification-settings-return-to-390.png`、`admin-permissions-return-to-1280.png`
