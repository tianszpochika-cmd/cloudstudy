# MB005 发布阻塞报告 — DSH 执行环境认证失败（2026-10-20）

状态：**BLOCKED_NO_PUSH**。MB005 仍是本地提交、未推送；远程仍为只读事实 `3230ac94188748a66f49c43678781bdd03711af6`。**不得记为 PUSHED**，不升级真实业务/native。MB006 保持 IN_REVIEW/未签；用户最新 95% 暂停线不变；自动任务未改。

本报告为 Root 收窄本任务后唯一新增文件；未 stage、未 commit、未 push、未改其他文件、未改任何源码。

## 1. 当前仓库状态（报告写作前只读核对）

- 分支 `dev-redesign`；HEAD 完整 `687af1017b8ae93da4f8c247ba12ed974898bb22`。[实测] `git rev-parse HEAD` / `git rev-parse --abbrev-ref HEAD`
- 暂存区为空：`git diff --cached --name-only` 无输出，计数 0。[实测]
- 未 stage 的 MB006 候选（作者并行编辑中，本 session 未触碰）：
  - ` M apps/mobile/src/pages/assessment/assessment.vue`
  - ` M packages/i18n/src/mobile-experience.ts`
  [实测] `git status --porcelain=v1 -- <上述两路径>`
- 工作区存在其他既有 dirty/untracked（含 56 保护与作者新证据），数量在并行编辑下会变化，本报告不逐一列举，也未 stage 任何一项。[实测] `git status --porcelain=v1` 计数在本轮收窄前为 73、写作前为 74（+1 来自并行作者的 MB006 证据，非本 session 写文件）。

## 2. 已实际尝试的正常 Git 命令与具名失败

| # | 命令（均为本 session 实际执行） | 结果 / exit | 关键输出 |
|---|---|---|---|
| 1 | `git -c http.proxy=http://127.0.0.1:7897 -c http.version=HTTP/1.1 ls-remote origin refs/heads/dev-redesign` | 无任何 SHA 输出 | 空输出，不能据此认定远程读取成功 [实测-输出] |
| 2 | 同代理配置 `git fetch origin dev-redesign` | 失败；该子命令 exit code 未单独捕获（输出含 fatal） | `error: failed to execute prompt script (exit code 66)`；`fatal: could not read Username for 'https://github.com': No such file or directory`；伴随 msys `sh.exe: *** fatal error - couldn't create signal pipe, Win32 error 5` [实测] |
| 3 | `GIT_TERMINAL_PROMPT=0 git ... -c credential.helper= ls-remote origin refs/heads/dev-redesign` | exit 128 | `fatal: could not read Username for 'https://github.com': terminal prompts disabled` [实测] |
| 4 | `GIT_TRACE=1` + 上述 ls-remote | exit 128 | helper 实为 `'C:\Program Files\GitHub CLI\gh.exe' auth git-credential get`，git 以 `sh.exe -c '...'` 启动；sh 启动即失败（signal pipe, Win32 error 5），认证不可达 [实测] |
| 5 | 同命令加 `-c credential.https://github.com.helper=manager` | exit 128 | trace 显示 `/usr/bin/sh.exe -c 'git credential-manager get'`，同样 sh 启动失败；改 helper 名不改变 shell 启动层 [实测] |
| 6 | `git ls-remote git@github.com:tianszpochika-cmd/cloudstudy.git refs/heads/dev-redesign`（Git 自带 msys ssh） | exit 128 | `C:\Program Files\Git\usr\bin\ssh.exe ... couldn't create signal pipe, Win32 error 5` [实测] |
| 7 | `GIT_SSH=C:\Windows\System32\OpenSSH\ssh.exe git ls-remote git@github.com:...`，及 `ssh -v -o BatchMode=yes -o StrictHostKeyChecking=accept-new -T git@github.com` | exit 128 / exit 255 | 已提供 `id_ed25519`，GitHub 返回 `Permission denied (publickey)`；该密钥未被仓库接受 [实测] |

第 6、7 条属于协议切换探查，已按 Root 收窄指令**停止**，不再重试；不换协议、不信任新 host、不读凭据绕过。

## 3. danger-full-access 请求与拒绝（精确原因）

- 触发命令：第 1+2 步组合（实时 ls-remote + fetch + 祖先核对），仅远端读取与本地 remote-tracking 更新。
- 工具原样返回：`Error: sandbox escalation to "danger-full-access" requires approval, but no approval channel is available`
- 未获任何批准，**未成功提升权限**；其后在普通沙箱下仍有第 2 节所列的替代尝试（helper 改名、SSH/Windows OpenSSH），均未成功。此后未再请求升级。[实测]

## 4. 未发生事项（防混淆）

- **未发生成功的 fetch**（远程分支文件未更新）；**未 push**；**未 commit**；**未 stage**；未更新原任务 7 份文档为“成功”；未修改产品源码；未触碰 MB006 两源候选。
- 无任何远程成功收据，MB005 **不得**记 PUSHED_UI_SCOPED。
- 本地 `origin/dev-redesign` 仍显示 `3230ac94…`，来自更早的 fetch 缓存，**不是**本 session 实时读取结果；不能当作本轮 fetch 成功证据。[推断/读取]
- 远程 `3230ac94…` 是**本轮最后观测值（2026-10-20）**，不是恒真：其来源为 Root 外部只读 HTTPS ls-remote 曾成功（任务给定事实）与本 session 认证 API 只读 `gh api .../git/ref/heads/dev-redesign` 返回同值。[实测-API] 远端此后可能已变；重试前必须重新读取。上述二者都不能表述为“DSH 内部 fetch/push 成功”。

## 5. 本轮失败性质（与旧 TLS 失败区分）

本轮**不是** TLS 握手失败：未出现 `SSL_ERROR_SYSCALL` 一类错误。失败发生在**凭据 helper 的子进程启动层**：git 通过 `sh.exe -c` 运行 helper，而本次所测的 `sh`/`bash`/`ssh`（msys 构建）在启动时即报 `couldn't create signal pipe, Win32 error 5`；同时沙箱升级无审批通道。命令级网络/证书设置未改，全部使用一次性 `-c` 参数，未改 global 配置。[实测 trace]

**当前阻塞不是凭据无效**：同一会话内认证 API 只读 `gh api .../git/ref/heads/dev-redesign` 能取到 ref（`3230ac94…`），说明账号凭据/授权可用；被拒绝的是正常 Git 通过 `sh.exe -c` 拉起 credential helper 的 msys 子进程（Win32 error 5），且无审批通道提升权限。因此不能笼统建议“重新登录/刷新凭据”即可修复。[实测]

## 6. 未验证与不确定

- Windows OpenSSH 使用 `-o StrictHostKeyChecking=accept-new` 是否改动了 `%USERPROFILE%\.ssh\known_hosts`：**未验证**。收窄前只读检查显示该文件已含 github 条目，但不足以证明本次未改写其内容或元数据；未读取或比对文件内容/时间戳。
- 未直接读取或输出私钥、`.env`、token、会话或敏感请求体（SSH 客户端内部使用已有 identity 属正常调用，不等于本 agent 读取密钥内容）；凭据存在性仅在进程内统计（仅打印行数与 username/password 键是否存在），未输出任何密钥值。[实测-统计]
- 本 session 未改 Git 全局/系统配置、代理、TLS 或信任设置；是否触及其他用户级状态未知 [未验证]。
- 收窄前执行过只读认证探测（`cmdkey /list` 仅 target 名、`git-credential-manager --version`、`gh auth status` 且 token 已 redact、两次 gh api 只读）；均为元数据，无密钥输出。记录于此以保持透明。

## 7. 需要恢复的条件（之后才可重试）

- 需要用户/ Root 提供**可用的 Git 执行通道**：即可正常执行 credential helper（不依赖被沙箱拦截的 msys `sh`）的 DSH 执行环境，或提供审批通道，或由具备该通道的会话执行推送。凭据本身已验证可用于认证 API 只读，单纯“重新登录”不是已验证的修复手段。
- 满足后仍按原顺序：先 fetch 并确认 `3230ac94…` 为 HEAD 祖先 → 正常 push `687af101…`（含 4 个提交）→ ls-remote 核完整 SHA → 再更新原任务的 7 份文档。
- 在此之前，MB005 保持 `UI_VERIFIED_LOCAL / PENDING_PUSH`；远程 UI 仍按 7 页计，不称 8 页已发布；MB006 未签，95% 暂停线不变。
