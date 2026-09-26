# Batch23 私有四端匿名浏览器回归

在 Batch23 私有发布收据为 `verified` 后，临时 Chromium 容器只连接 `cloudstudy-uat-isolated-3c94b27160` 网络。运行前核对网络与 HTTPS proxy 的私有项目标签均为该项目，浏览器镜像 `cloudstudy-uat-isolated/browser:3c94b27160` 的 ID 为 `sha256:816d356d1fc6fe69f21bfc308ae14ea97672041811ddd2d4983a1ffe8be8681f`。没有使用共享 `yuxuexing-local` 网络或宿主机端口。

[探针](probe-batch23.cjs)记录 26 个匿名样本的 HTTP、浏览器 JWKS CORS、脚本/Console 错误、失败请求、窄屏水平溢出、破图、登录交接、受保护深链 `returnTo`、英文/深色偏好、安全回退和注册/重置空表单校验。结果见 [逐项证据](evidence.json)、[汇总](summary.json)与本目录截图。空表单校验不发送注册或重置请求；未输入凭据、Token 或真实个人数据。

本次结果：26/26 HTTP 200、26/26 JWKS CORS 200；官网旧登录交接 2/2、深链回跳 3/3、官网英文深色交接 4/4、直接偏好 4/4、注册与重置本地校验分别 2/2。页面错误、失败请求、水平溢出和破图均为 0。Batch22 移动社交深链的脚本错误本次未复现。截图只证明对应视口的匿名渲染，不代表真实注册、改密、授权学习或原生移动端通过。

复现时先确认 [Batch23 发布助手](../../../scripts/runtime/batch23-private-promotion.mjs) `status` 为 `verified`，并重新核对网络、proxy、浏览器镜像的标签与 ID。脚本语法检查：

```powershell
node --check artifacts/uat-2026-09-25/docker-isolated-browser-batch23/probe-batch23.cjs
```

私有网络内运行的命令：

```powershell
docker run --rm --network cloudstudy-uat-isolated-3c94b27160 --label com.cloudstudy.uat.project=cloudstudy-uat-isolated-3c94b27160 --mount "type=bind,source=C:\Users\Administrator\Desktop\my\cloudstudy\artifacts\uat-2026-09-25\docker-isolated-browser-batch23\probe-batch23.cjs,target=/probe.cjs,readonly" --mount "type=bind,source=C:\Users\Administrator\Desktop\my\cloudstudy\artifacts\uat-2026-09-25\docker-isolated-browser-batch23,target=/out" -e NODE_PATH=/opt/uat/node_modules --entrypoint node cloudstudy-uat-isolated/browser:3c94b27160 /probe.cjs
```
