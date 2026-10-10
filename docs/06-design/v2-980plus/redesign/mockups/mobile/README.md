# 移动端静态交互原型（mockups/mobile）

更新时间：2026-10-01。本目录是**移动端的静态 HTML/JS 交互原型**，用于验证 UI、演示数据与交互流程；**不代表 `apps/mobile` 的正式 uni-app 前端重构已完成**。

## 目录内容

| 文件 / 目录 | 说明 |
|---|---|
| [`DEMO-GUIDE.md`](DEMO-GUIDE.md) | 演示指南：演示身份与入口、`localStorage` 持久化键位、统一演示数据、今日场景切换与故障注入方式 |
| [`index.html`](index.html) | 原型入口页面 |
| [`app.js`](app.js) | 原型主逻辑（路由、状态、渲染） |
| [`learning.js`](learning.js) | 学习链相关逻辑（计划、轮次、章节进度、查词、写作草稿等） |
| [`evidence/`](evidence/README.md) | 批次证据归档，索引见该目录的 [README](evidence/README.md) |

## 预览方式

按 `DEMO-GUIDE.md` 的说明，通过静态服务访问 `http://127.0.0.1:18283/mobile/`，读盘即时生效，**不要另起端口**。

## 证据边界

- 原型使用**静态演示数据**，不是真实后端联调结果。
- 本目录的截图与断言数量**不能**用于宣布完整业务验收或整体冻结。
- 读屏、软键盘、iOS/Android 真机、TTS 真实语音、3D 联网及全部横屏与高对比按住态**尚未验证**。
- 历史 before 证据保留当时缺陷时点；从当前代码重跑只会得到当前界面，**不能重建过去缺陷**。新的修改应存入新的证据目录。

未关闭事项与历史缺陷分别记录，见 [`evidence/README.md`](evidence/README.md)。
