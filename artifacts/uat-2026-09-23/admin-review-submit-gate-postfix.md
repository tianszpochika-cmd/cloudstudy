# PAGE-P1-ADMIN-REVIEW 提交双审门禁修复与局部复测

2026-09-23。对应 [首次负向验收](admin-review-publish-boundary.md) 的 PENDING 版权草稿仍可点击“提交双审”缺口。本次仅收束 B9 内容工作台和 content owner 的提交入口，不声明合法内容双审、发布或四端分发完成。

## 修复

- content owner 的 `SUBMIT_REVIEW` 在变更版本状态和写提交事件前重新检查当前版本；PENDING/不可分发版权返回 `409 CONTENT_RIGHTS_NOT_READY`。后台状态投影新增只读 `reviewSubmissionReady` 与阻断原因，和命令共用同一判断。当前 owner 尚无绑定版本与哈希的持久 PASS 校验报告，也无必需媒体 `READY/CLEAN` 的可信事实，因此即使版权有效，提交仍以 `CONTENT_REVIEW_EVIDENCE_UNAVAILABLE` 失败关闭。
- Admin Web 只接受 owner 投影的布尔值 `reviewSubmissionReady === true`。字段缺失或为字符串时禁用按钮；选择内容后还须成功读取单条详情并核对内容编码、版本、状态版本和资格，详情读取失败时按钮保持禁用。实际提交前再次读取并复核，任何不匹配均不发送 POST。页面提示压缩为“版权、校验或媒体材料未就绪，暂不能提交。”；成功提示为“已提交双审。”

## 验证与证据

| 范围 | 结果 |
|---|---|
| Admin Web 资格映射、详情读取失败、提交前复核与按钮测试 | 5/5 通过；`vue-tsc --noEmit` 通过；当前 Vite 模块编译 HTTP 200。 |
| content-service 全量 Maven 测试 | 36 个 suite、226 项测试，0 failure/error，2 skipped；其中新增 B9 权利边界测试 10/10。 |
| B9 契约片段 | JSON 与 `pnpm contracts:validate` 通过。汇总 OpenAPI 与片段仍有漂移，需集成时在其他并行契约改动稳定后合并。 |
| 本机候选环境授权浏览器 | 新 `.invalid` 合成 staff + 未发布 PENDING 草稿；1280px 与 390px 均见按钮禁用及短提示，文档宽度等于视口宽度，Page Error 0。仅验证前端负向门禁，当前运行中的 content owner 尚未返回新增 readiness 字段。 |
| 精确清理 | 合成草稿和版本移除；账号禁用，活跃会话/设备均为 0，内容残留 0。 |

浏览器 [结构化证据](admin-review-submit-ui-postfix/mue1v6vec61518/evidence.json)、[1280px 截图](admin-review-submit-ui-postfix/mue1v6vec61518/review-button-1280.png)、[390px 截图](admin-review-submit-ui-postfix/mue1v6vec61518/review-button-390.png)；[可重复脚本](admin-review-submit-ui-postfix.mjs) 仅使用本机随机合成身份并在 `finally` 精确清理。前两次局部复测发现并修正新增提示处的 Vue 标签闭合错误；两次合成数据均按脚本清理，最终复测为上述通过结果。

## 未关闭边界

新 content-service 源码尚未进入当前运行镜像，因此 `SUBMIT_REVIEW` 的 409 行为需要下一批部署后经 Gateway 再测。合法版权核验、版本绑定 PASS 报告、media owner `READY/CLEAN` 事实、四主体双审及发布正向链仍缺；本次不生成任何授权或媒体证明。
