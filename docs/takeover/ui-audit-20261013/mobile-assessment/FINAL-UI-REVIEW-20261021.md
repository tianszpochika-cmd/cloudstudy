# MB006 C8 最终 UI 审签（2026-10-21）

**状态：`UI_ACCEPTED_LOCAL` / `PUBLISH_BLOCKED`。** 这是 Root 对**本页实际 H5 受控 UI** 的具名范围审签，**不是**后台/IAM/native/整页业务验收，也不是 R1/IT 阶段门 READY，更不是全前端 Console-clean。

## 版本与源

| 文件 | 精确 raw SHA-256 |
|---|---|
| `apps/mobile/src/pages/assessment/assessment.vue` | `41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86`（44989B） |
| `packages/i18n/src/mobile-experience.ts` | `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` |
| `apps/mobile/package.json` | `484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078` |
| `pnpm-lock.yaml` | `d57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624` |

服务事实：18183 新 session 99776 / PID 37960（creation 2026-10-21 08:27:39.861499），旧 93491 / PID 40996 无 inflight 后 Ctrl-C。旧服务为 pre-resolved `vue-router` 4.6.4；Root 保存 served module 前后以 fresh HTTP 确认真实路由 **4.4.4**。旧 4.6.4 证据仅保留环境 scope，**不升级**为“4.4.4 锁定 PASS”。

## 通过范围（Root 实际执行 + 源码独审）

| 组 | 结果 | 证据 |
|---|---|---|
| back guard（6 cases） | **95/95 PASS_SCOPED_ACTUAL**，stable/deps/closed true | `dsh-20261020-backguard/runs/codex-20261021-c8-all-1/results.json` |
| author | **32/32 PASS** | `dsh-20261020-author/runs/codex-20261021-c8-author-1/results.json` |
| risk keyboard / pointer / busy | **31 / 30 / 31** 全 PASS_EXECUTED_CHECKS | `dsh-20261020-risk/runs/codex-20261021-c8-{keyboard-1/keyboard,pointer-1/pointer,busy-1/busy-retest}/results.json` |
| matrix | **34 MEASURED / 226 PNG**，review/incomplete/failed/error 0；四主题、中英、320/390/768/1280 + 200% 短屏 | `dsh-20261020-matrix/runs/codex-20261021-c8-full-1/results.json` |
| owner submit-2 | **22/22 PASS_EXECUTED_CHECKS**，`latePacket.received=true`（HTTP200 实际 receipt + fulfill，无取消），notRun 0 | `dsh-20261021-owner/runs/codex-20261021-c8-owner-submit-2/owner-late-submit/results.json` |
| owner read-2 | **23/23 PASS_EXECUTED_CHECKS**，同上稳定；14 条 warnings **原样保留**（不称全 console-clean） | `dsh-20261021-owner/runs/codex-20261021-c8-owner-read-2/owner-late-read/results.json` |
| auth3 | **15/15**，warning 0、pageerror 0，仅共享 i18n/路由的 5 项每页窄 smoke；旧即时编辑范围**未重做**、旧 PASS 不变 | `dsh-20261021-auth3/runs/codex-20261021-c8-auth3-1/results.json` |
| fonts | 21 检查，actual **Microsoft YaHei / Segoe UI**，root 16/24、H1 28/39.2；不声称自动断言每种字体风格 | `dsh-20261021-fonts/runs/codex-20261021-c8-fonts-1/results.json` |
| nav | guide-2 15、cycle-2 17、today-2 12 PASS；reload-1 11 PASS | `dsh-20261021-navigation/runs/codex-20261021-c8-nav-*/results.json` |
| build | Root `build:h5` **exit 0** | Root 原始日志（`dsh-dispatch-20261021` 私有保存） |

owner run1（submit-1 / read-1）为 cleanup 缺 `item.releaseAll` 的脚本错误 exit 2，22/23 检查已执行但**不能签全组**；保留并分类为 script 缺陷。fixture 单导出修复后 run2 最终通过。

## 视觉核对（Root 同次 view_image，≥5 点）

轻导航单 H1；560 max 自然流、普通字体；语义紫按钮/边界；完整整行选项 + selected 第二行；真实 70 分 7/10 与 concept 60 分 6/10 差异仅合成数据；无硬件状态栏；按钮自然排列；当前 FULL/ZERO 既有反馈保留；快速开始缺契约以诚实小字说明。Root **未**凭 concept 签实际页。

## 未通过/保留（不得称整页全绿）

- **states 完整 suite 仍为 FAIL**：read503 / skipped / restore401 三 case 的唯一失败检查均为 `no-console-warnings`（分别 12 / 9 / 6 条关联 route 警告）；核心 current-page 断言全通过，0 visible 旧题 / 0 unhandled / 0 pageerror。
- `settings-baseline-1` 从未挂载 assessment，独立复现 **9 条 text 内 AppIcon warnings**；today-2 有 2 条，owner-read 14 条——均原样保留，不假称本页修复其他页。
- Root 静态确认 assessment 新模板**没有** text 内 AppIcon；关联未重排页面的警告建 **follow-up 台账**，不逐条猜来源。

## GAP（继续，不升级）

SKIPPED 保守计划契约；首次 start 未知结果恢复；retest `data{}` vs bodyless 未实证；真实后台/IAM/native **未 PASS**；旧 source/GAP 不升级当前 PASS。R1/IT 阶段门**不签 READY**。

## 发布与计数

- 本地 UI 已签 **8 → 9** 页；远程仍 **7** 页（MB005 `758dc0fb…` 与本页均未推）。
- HEAD `687af101…`；远程 `3230ac94…` 仅旧只读观测，**不称同步**。
- 本轮只准备本页单独提交；**publish 仍 blocked**（DSH Git credential-helper 子进程权限阻塞，未 fetch/push/SSH/探凭据）。下一页为 **MB007 首页**。
