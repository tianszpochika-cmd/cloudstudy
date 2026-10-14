# MB-004 — 正式Mobile学习设置重设计（进行中）

正式页：`http://127.0.0.1:18183/#/pages/onboarding/onboarding`。当前 **IN_PROGRESS / 未签UI**，只读[四幕实施计划](implementation-plan.md)与[排版参照](concept.png)已准备；参照是生成概念，不是实际页面截图。原正式页raw SHA为`812ef4a4469c70dd211d7256dadca2a1fae31903d8ce3b124f4e3d809e3cf345`。四态正式page候选aa20及专属i18n5de已落盘但未运行类型/模板/browser验收，详见[最新暂停](../PAUSE-20261015-0214.md)；所有六份source未提交。

## 已实施的窄安全差量

- `session.confirmAdultGate`仅保留响应明示的PASSED/REJECTED/REQUIRED/UNKNOWN；缺失响应和transport失败为UNKNOWN，学习继续fail closed，避免把503当资格拒绝。真实Pinia/store模块7项受控检查通过，含logout后迟到响应；[原始日志](20261015-root/adult-verdict-tests.log)。不是实际后台判定/浏览器PASS。
- `saveOnboarding(consentsRecorded=true)`在改目标前GET当前IAM adult/consent summary，必要性未满足或账号变化即停止；不代用户再PUT三条consent，owner/version/idempotency和服务端PEP仍负责目标写入。真实API模块7项受控检查通过，含非法/读失败零写入与换号，见[具名快照](20261015-root/client-guard-tests.json)。不是业务闭环PASS。
- 原显式签署路径的默认版本fallback及409自动重签 **尚未补修**；新正式页不能从无权威发布投影的状态调用它。GET consents是历史记录，不是未签发布目录；current summary用于已满足事实续步，不能造法律正文或逐项当前版本。

## 后续必须验收

四种实际态全面重排、对应中英文i18n、原生年份/整行checkbox语义与立即值、busy/错误/读取恢复、目标保存读回及只读摘要/明确调整。按最终源码冻结做真实H5视觉、主题、响应式、200%、keyboard/pointer/状态与独立复审；当前尚未跑，不得以本页单元检查、概念或计划签UI。

已有只读before fixture证据位于`.git/codex-local-backups/onboarding-preaudit-20261014`，包括原gate503错误跳forbidden及busy控件可编辑。原始正式源备份在`.git/codex-local-backups/mb004-redesign-20261015/onboarding.before.vue`。root早期尝试整页delete+add因工具同目标多操作校验失败，未改正式源；作者从原812ef接续，无已完成UI丢失或被重做。

另有待真实复验的既有行为：saveOnboarding在目标保存时将已有uiLocale/contentLocale/theme/motion等与固定默认值比较，并可能PATCH回默认。新页面保存目标应保留用户现有偏好；此处源码关切已记录，未在本轮受控7项默认偏好fixture中覆盖，不可据其PASS放过。账号设置/学习语言/主题是独立事实，不由目标编辑覆盖。

真实IAM/learner owner/审计、发布文档投影及native/物理输入/读屏尚未验。原56受保护文件hash变化0；不动服务器/生产数据、契约或阶段Gate。
