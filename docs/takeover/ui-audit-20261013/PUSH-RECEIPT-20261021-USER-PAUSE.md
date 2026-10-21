# 用户暂停检查点 — 推送结果收据（2026-10-21）

**状态：`LOCAL_COMMITTED_PUSH_FAILED`。** 本地提交成功，远程未更新。

| 项 | 值 |
|---|---|
| 主提交 SHA | `b64db8e935c1899569211cf0a825e727d836cf0c` |
| 主提交 parent | `5b3ca5a76a5a70286bc34604fc39212ae494d33b` |
| 分支 | `dev-redesign` |
| 提交范围 | 361 文件（Root 已审 index；product 5 / entry 3 / CHANGELOG / doc 352），+389713 −170 |
| push 命令 | `git push origin HEAD:dev-redesign`（仅一次） |
| push exit | **128** |
| 失败原因 | Git 经 `sh.exe -c` 拉起凭据 helper 时 msys 子进程崩溃（signal pipe / Win32 error 5，历史同一 helper 子进程权限阻塞）；非凭据失效、非 TLS 失败 |
| ls-remote | 未执行（push 失败后立即停止网络，未换 transport） |
| UI 计数 | 本地已验 **9**；远程仍按 **7**，本轮未新核 |
| 既有本地未推 | MB005 `758dc0fb…`、MB006 C8 `8a66cc73…` 仍在本地 |

## 说明

- 本收据是**本地提交 + 推送失败**记录，不是发布、不是远程同步。
- 远程 `3230ac94…` 仅为旧只读观测，**不得**推断为已同步。
- 未使用 force / 未换 SSH / 未调整 helper / 未绕权限 / 未读取凭据。
- 需要在人类本机正常 Git 认证环境执行：`git push origin HEAD:dev-redesign`；成功后再补远程 SHA 核验。

## 内容边界

- C8 首页候选 `UI_NOT_SIGNED / BROWSER_NOT_RUN`；auth401、empty 40/41、cross-owner late 风险未清。
- Learn L2 仅必要跳转修稿，非整页重设计。
- 旧 C7 五源受控证据仅历史有效，不套 C8；旧 FAIL / GAP / RECONSTRUCTED 归档全部保留。
- 原 56 保护文件 / 14 目录未进入本提交，raw 0 漂移。
