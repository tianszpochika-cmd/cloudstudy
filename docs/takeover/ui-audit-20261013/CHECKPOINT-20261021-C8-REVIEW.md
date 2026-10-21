# C8 审核断点 — 2026-10-21

> 状态：**IN_REVIEW，未签收**。本文件只转录 Root 实际 JSON 事实与范围，不把本页记为完成，不改 CHANGELOG，不 commit/push。角色：DSH 实现/测试/文档，Root 分发与独立审核。

## 源与服务

- C8 页：`apps/mobile/src/pages/assessment/assessment.vue` = `41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86`（44989B）；i18n `6ac6800e…`、mobile `package.json` `484382c7…`、lock `d57a87ca…` 未变。
- 18183：旧 session 93491 / PID 40996（creation 2026-10-20 22:28，无 inflight 后 Ctrl-C）；新 **99776 / PID 37960**（creation 2026-10-21 08:27:39.861499），绑定 `127.0.0.1` strict。
- 路由环境：`package.json` 改于 20 Oct 23:19，旧服务为 pre-resolved 4.6.4；Root 保存 served module 前后，fresh HTTP 确认实际路由 **v4.4.4**。旧 4.6.4 证据仅保留其环境 scope，**不升级**为“锁定 4.4.4 PASS”。

## C8 实际修复点（Root 核对）

- entry home 别名 `'/'` 仅在 home intent 允许时 permit；Root DEV 实测收到 `to.path='/'`、`to.meta.route=pages/home/home`。
- forward 取消旧 Promise 时以框架 `CANCELLED` 结束，不回滚旧 delta。
- onShow / owner / hide 重新 gate 期间用轻准备遮住旧业务内容。
- `syncTitle` 正确处理 late Promise。

## 实际执行结果

| 组 | 运行 | 结果 |
|---|---|---|
| back guard | `codex-20261021-c8-all-1` 6 cases | **95/95 PASS_SCOPED_ACTUAL**，`stable/deps/closed=true`；含 cancel-confirm、busy-back、repeat-back、repeat-back-confirm、native explicit accept、clean-back。H5 浏览器原生对话框**不等于** native App 验收。[results](mobile-assessment/dsh-20261020-backguard/runs/codex-20261021-c8-all-1/results.json) |
| author | `codex-20261021-c8-author-1` | **32/32 PASS**。[results](mobile-assessment/dsh-20261020-author/runs/codex-20261021-c8-author-1/results.json) |
| risk | keyboard 31、pointer 30、busy-retest 31 | 均 `PASS_EXECUTED_CHECKS`（以 raw JSON 为准）。[keyboard](mobile-assessment/dsh-20261020-risk/runs/codex-20261021-c8-keyboard-1/keyboard/results.json)、[pointer](mobile-assessment/dsh-20261020-risk/runs/codex-20261021-c8-pointer-1/pointer/results.json)、[busy](mobile-assessment/dsh-20261020-risk/runs/codex-20261021-c8-busy-1/busy-retest/results.json) |
| matrix | `codex-20261021-c8-full-1` | **34 MEASURED / 226 PNG**，review/incomplete/failed/error 均 0；四主题、中英、320/390/768/1280 + 200% 短屏。[results](mobile-assessment/dsh-20261020-matrix/runs/codex-20261021-c8-full-1/results.json) |
| fonts | `codex-20261021-c8-fonts-1` | 21 检查；六态 CDP 实际字体 **Microsoft YaHei / Bold**、**Segoe UI / semibold**；root 16/24，H1 28/39.2。Root 原“宋体观感”疑点已由 used-font 证据排除，**不要为此改产品**。[results](mobile-assessment/dsh-20261021-fonts/runs/codex-20261021-c8-fonts-1/results.json) |
| nav | guide-2 15、cycle-2 17、today-2 12 | 均 PASS，真实目标 DOM 就绪/相应 GET，canonical `'#/'` 或完整 home 路径明确支持，unknown 0/pageerror 0。[guide](mobile-assessment/dsh-20261021-navigation/runs/codex-20261021-c8-nav-guide-2/results.json)、[cycle](mobile-assessment/dsh-20261021-navigation/runs/codex-20261021-c8-nav-cycle-2/results.json)、[today](mobile-assessment/dsh-20261021-navigation/runs/codex-20261021-c8-nav-today-2/results.json) |
| reload | `codex-20261021-c8-nav-reload-1` | 11 PASS；真 reload 同 assess `accepted=1/start=1/GET=1`。[results](mobile-assessment/dsh-20261021-navigation/runs/codex-20261021-c8-nav-reload-1/results.json) 旧 risk hash-goto 恢复 FAIL **保留**（未等同真刷新，不能抹）。 |

## 图像核对（Root 同次 view_image）

concept + 当前 guide/report/英文 200 selected-C/中文 HC 重测：轻导航单 H1、560 max 自然流、普通字体、语义紫按钮/边界、完整整行选项与 selected 第二行、真实 70 分 7/10 与 concept 60 分 6/10 差异仅合成数据、无硬件状态栏、按钮自然排列、当前 FULL/ZERO 既有反馈保留、快速开始缺契约以诚实小字说明。Root **没有**凭 concept 签实际页。

## states：不能称整个 suite PASS

- `codex-20261021-c8-states-all-1`：[run](mobile-assessment/dsh-20261021-states/runs/codex-20261021-c8-states-all-1/run.json)
  - start503 **10/10**；read503 **12/13**、skipped **12/13**、restore401 **12/13**。
  - 三处唯一 FAIL 均为 `no-console-warnings`（分别 12/9/6 条 text 内组件警告）；pageerror/unhandled/unknown 为 0；恢复 401 可见旧 question/report/skipped 帧 0。
- `codex-20261021-c8-restore401-visible-1`：32 assessment 帧 0 旧题。[run](mobile-assessment/dsh-20261021-states/runs/codex-20261021-c8-restore401-visible-1/run.json)
- `codex-20261021-c8-nav-settings-baseline-1`：从正常 login 直接 settings、从未挂载 assessment；9 checks 运行、9 条同族 warnings；`code401/408` 等 text 内 AppIcon 既有缺陷。[results](mobile-assessment/dsh-20261021-navigation/runs/codex-20261021-c8-nav-settings-baseline-1/results.json)
- today-2 另有 2 条、cycle-2 有 9 条目标页 warnings。记录为**关联未重设计页面待逐页修**，不归为 assessment 源码产生，也不静默豁免成“全 Console-clean”。

## 待 Root 决定（未签）

- 本页最终签收仍待 Root 对上述 scope 及 owner 迟到包 / 3 个 auth 窄回归的决定；owner 晚返回与 3 auth 新测试**准备中未签**。
- 所有 GAP 继续：SKIPPED 保守计划契约、首次 start 未知结果恢复、retest `data{}` vs bodyless 未实证；真实后台/IAM/native 未 PASS。旧 source/GAP **不得**升级当前 PASS。

## 额度/保护/发布

- 保护：原 56 文件 / 14 目录，08:33 再核 **零漂移**（`.git/codex-local-backups/dsh-dispatch-20261021/protection-0833.json`）。
- 最近 quota **67% / 周 42%**，`ordinary=true`；reset `1792558092` = **今天 12:48:12 CST**，heartbeat 12:50 后每 5h；阈值 **95%**。
- Git：HEAD `687af101…`；本地签 8 / 远程 7；MB005 `758dc0fb…` 未推；C8 **未提交**；未查新 remote，**不称同步**。DSH helper 子进程阻塞不重试、不探密钥/SSH，Root 不代 Git。
