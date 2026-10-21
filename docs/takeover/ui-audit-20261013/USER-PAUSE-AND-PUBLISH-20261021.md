# 用户暂停与提交指令 — 2026-10-21

> 人类原话顺序：“你先暂停工作” → “你更新相关文档随后把所有工作内容提交到远程”。这是**新的普通 Git 推送授权**，覆盖旧的“自动续做禁止重试”限制；仍**不允许**绕权限、改安全配置、探凭据、换 SSH、force push。

## 当前状态（发布前）

- 分支 `dev-redesign`；HEAD `5b3ca5a76a5a70286bc34604fc39212ae494d33b`；**index 0**。
- **本地 UI 验收 9 页 / 远程 7 页**（发布前状态，未推）。
- 已有本地提交：MB005 `758dc0fb…`、MB006 C8 `8a66cc73…`；均未推。
- 原 **56 文件 / 14 目录** 保护 **0 漂移**（manifest `.git/codex-local-backups/ui-audit-20261013/preexisting-work.json`）。

## 本轮 WIP 源（当前工作树）

| 文件 | raw SHA-256 |
|---|---|
| `apps/mobile/src/pages/home/home.vue`（C8） | `b097382f77c67acf710433a77da434076ab5e2db40eb5288c9ef838ff041d3ae` |
| `packages/i18n/src/mobile-experience.ts` | `7e2ef7b596eeb15fa60f715a0e00274a7d1290ddf13b1da4c6cc91116311126f`（LF `0bb9f0d6…`） |
| `apps/mobile/src/stores/learner-content.ts` | `c4ef9dd83452ea44f6deda55ac0be2dd3e49a810cd82d183d5342fa9b71cec21` |
| `apps/mobile/src/platform/uni-runtime.ts` | `03b21bab8c4121ec289b5633ae9fab79ba0b64c60d0431f7adbf8953115f265a` |
| `apps/mobile/src/pages/learn/learn.vue`（L2 必要跳转修稿） | `4bd50e4b5af9685f7eabe88e89635f061632d383d0d8e6ae7105d510db90bb03` |

`apps/mobile/package.json` `484382c7…` 与 `pnpm-lock.yaml` `d57a87ca…` 未改。

## 验收状态（不升级）

- MB007 首页 C8：`PRIVATE_CANDIDATE_C8 / UI_NOT_SIGNED / BROWSER_NOT_RUN`；本轮**未跑** C8 浏览器/构建。仅候选“home 401 + refresh 401 清会话后仍停 `#/`”的恢复。
- 未验风险：**auth401** 真实产品 FAIL 仍待 C8 复验；**empty 40/41** 属测试读 DOM 过早；**cross-owner late** 属测试前提 GAP（Profile 缓存）。
- 旧 C7 五源组合的具名受控 H5（ready24 / search19 / nav13 / retry16 / learn-retry9 / late-same13 / learn-late10 / plan-late13；auth3 15 / assessment-home 5；full 34 上下文 68 PNG 零失败；build 0）**只对旧组合有效**，不套用到 C8，不升级真实 IAM/native/业务。
- 所有旧 FAIL、旧矩阵、RECONSTRUCTED 归档与版本保留；C7 原件 `ARCHIVE_GAP` 不冒充。

## 提交边界

- 可作为**用户暂停 WIP 检查点**提交；**不**升级 UI 验收、**不**把推送说成发布完成。
- 不提交原 56 保护文件/14 目录及其它任务 dirty；不提交 `.git`、`.env`、凭据、`node_modules`、`dist`、`.cache`、临时运行数据。
- 自动任务：Root 更新返回 `Automation does not exist ... may have been deleted manually`，本地 `automation.toml` 亦不存在 → **记录为不存在，不创建替代**；人类明确恢复前不再自动续做。
- 服务：Root 启动的 18183 审核服务 **exec 44099** 保持可供查看，不主动停未知进程；18180 无监听按当时事实记录。

## 推送结果

- **PENDING**（本段禁止 fetch/push）。实际推送结果须在第二段执行后填写，未执行前不得称已推送。

## 正式审核证据归档（2026-10-21）

- Root 已有真实审核证据按原字节归档：[root-review-20261021](mobile-home/root-review-20261021/README.md)，含 C3 字体、C4 焦点、C5 placeholder、C6 空态/race、C7+L2 auth401 的 JSON/PNG 与 [HASHES](mobile-home/root-review-20261021/HASHES-ROOT-REVIEW-20261021.json)。
- 边界：历史版本证据，**不是当前 C8 PASS**；race 的 unknown 为诊断 GAP；JSON 不含 headers/token 正文，秘密模式扫描命中 0。
