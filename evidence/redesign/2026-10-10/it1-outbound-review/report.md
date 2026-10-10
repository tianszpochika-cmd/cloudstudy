# IT-1 出站自审

日期：2026-10-10。审查者是本轮执行代理，不是 Luna。结论：**PASS_WITH_GAPS**。

`accepted` = false。`it1Outbound` = false。`lunaStamp` = false。`station-acceptance/` 下的 REJECT / FAIL 与 IT-2 BLOCKED 原件没有改写。本页不把任何卡升级为 Luna 签收，也不发布完成百分比。

## 证据

| 目录 | 结论 | 说明 |
|---|---|---|
| `evidence/redesign/2026-10-10/it1-named-gates` | PASS | 后缀 `c08e65d3`。真实 Chrome，临时 profile，只放行本轮测试证书 SPKI。Web 与 H5，1280×900 与 390×844。 |
| `evidence/redesign/2026-10-10/R1-014` | PASS | 四套 owner schema 空库 → Flyway 种子 10 题 → 浏览器回归 → 删库。`retainedSchemasLeft` = 2，`qidaUnchanged` = true，监听端口已空。 |
| `evidence/redesign/2026-10-10/it2-score-browser` | PASS | 同一轮 Chrome。10 题奇正偶误，行内反馈与「答对 N 题，共 10 题」分开核对，公开重测 201。不是 IT-2 出站。 |
| `evidence/redesign/2026-10-10/it1-recheck` | 历史 PASS | 后缀 `ce0aa296`，未签。本轮没有改那份报告。 |

收尾原文：四套 `r1_named_20261010_*_c08e65d3` 删除后计数为 0。保留库 `r1_it1_browser_20261010_iam_5d9f4b7e` 与 `r1_it1_browser_20261010_cnt_5d9f4b7e` 仍在。钥匙串未改（`KEYCHAIN_UNTOUCHED`）。

## 具名门

| 卡 | 本轮浏览器事实 | 自审 |
|---|---|---|
| R1-001 | 官网 11 页 × 2 视口 200，无横向溢出、无 pageerror。课程空态「课程准备中」，价格「收费方案暂未开放」。主页与课程「去注册」到达 `18180/register`，页上有「仅面向 18 岁以上成人与大学生」。 | 通过本轮具名范围。不恢复原 R1-001 完整验收，不把历史 SOURCE_SCOPED_PASS 改写成业务卡 ACCEPTED。 |
| R1-002 / R1-015 | 注册直达 `https://127.0.0.1:18087/api/v1/auth/register`，201。 | 通过。历史 R1-002 独立终审不改写。 |
| R1-003 | 同键同体重放 201 且 sessionId 相同，账号数 1。同键改 deviceName 后 409，账号数仍 1。Web 与 H5 都做了。 | 通过。 |
| R1-004 | 本轮登录请求直达 IAM，200。没有重跑历史 14 项刷新轮换 / 重放撤销套件。 | 登录路径通过。刷新轮换仍以 2026-10-09 已签收套件为准，本轮不重复宣称。 |
| R1-005 | Web 踢 H5、H5 踢 Web。页面上的「退出此设备」发出 Gateway `POST /api/v1/iam/devices/{id}/kickout` 200。被踢端下次刷新打到 IAM `/api/v1/auth/token/refresh` 并得到 401，随后回到登录页。 | 通过。 |
| R1-006 | 出生年 2015 时继续按钮保持禁用，表单没有提交这个年份。同一 Chrome 会话另发成人门 `{confirmed:true, birthYear:2015, policyVersion}`，200 且 REJECTED。库内 `adult_gate_status=REJECTED`，账号 ACTIVE，会话 ACTIVE。 | 通过，但见 GAP-1。 |
| R1-007 | 拒绝后进入无权限页，句子含「当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。」设置与帮助可打开。H5 画像显示「成人核验：未通过」。Web 用「退出登录」，H5 用「返回登录」，退出后回到登录。 | 通过。画像一行是本轮产品修复，见下。 |
| R1-008 | 同意页读到已发布版本后，继续按钮在勾选前为禁用。签署走 Gateway。 | 通过。历史 R1-008 独立终审不改写。 |
| R1-009 | 页面没有撤回按钮。已登录会话 `PUT /api/v1/iam/consents` 把 `ADULT_LEARNING` 设为 `WITHDRAWN` 后，`GET /api/v1/learner/targets` 为 403。 | 通过接口与随后的 403。见 GAP-2。 |
| R1-010 | 停掉 learner 再启动，目标读回 200。 | 通过。 |
| R1-011 | 新账号从引导按主按钮进入定级。 | 通过。 |
| R1-012 | 已有账号与未知账号的重置申请都是 IAM `POST /api/v1/auth/password-reset/request` 202。 | 通过。 |
| R1-013 | 拒绝账号再次登录后，打开引导页会回到无权限页。重试按钮与改年份控件计数为 0。Web 与 H5 的 `bounced` 都是 true。 | 通过。 |
| R1-014 | 上表各卡在本轮四套干净库上的汇总为 PASS，结束后库已删。 | 通过本轮 17 卡回归范围。不是 114 卡墙。 |
| R1-016 | 门说明与同意文案的必选句都在；「再试一次」「改年份」只出现在否定句里，没有对应按钮、链接或月/日输入。 | 通过。 |
| R1-017 | 画像字段可见。未访问过定级的首页引导条可以去定级。 | 通过。H5 画像在学员资料读失败时仍显示成人核验，这是本轮源码改动。 |

密码、刷新没有打到 Gateway（`passwords-and-refresh-stay-off-gateway` PASS）。证据 JSON 没有 Bearer 令牌，也没有 `correctOption`。

## 本轮源码

`apps/mobile/src/pages/profile/profile.vue`：成人核验一行改到独立卡片，按 `session.adultGate` 显示。被拒绝的账号读不到学员资料时，页面仍显示「未通过」。浏览器证据是 `minor-exits-h5-*` PASS。

证据脚本 `it1-named-gates/run.mjs`：不再调用 `security add-trusted-cert`，也不改钥匙串。Chrome 临时 profile 使用 `--ignore-certificate-errors-spki-list=<本轮测试 CA 的 SPKI>`。Java 仍用临时 PKCS12 truststore。

## 剩余 GAP

1. **GAP-MINOR-FORM**：未成年年份不能从继续按钮提交。拒绝结论来自同一浏览器里的成人门请求，不是表单提交。客户端 `getFullYear() - 18` 门闩没有改。
2. **GAP-WITHDRAW-UI**：学习同意撤回没有页面按钮。证据是已登录会话里的 `PUT /consents`，然后学习口 403。
3. **GAP-H5-RELOAD**：H5 只改 hash 不会重载文档，内存里的成人门状态会停在旧值。证据在进入首页前加了 `?reload=` 强制加载文档。产品路由本身在文档加载后会把 REJECTED 用户从首页/引导送到无权限页。
4. **GAP-RATE-BUDGET**：`/api/v1/iam` 在网关里属于高风险类，默认 30 次/分钟，而且限流发生在认出登录用户之前，所以这轮密集回环请求共用一个额度。证据进程把 `GATEWAY_RATE_LIMIT_HIGH_RISK_ADMIN_REQUESTS` 设为 2000，只作用于这次启动的 Gateway。生产默认值没有改。因此本轮踢设备证据没有覆盖默认 30 次额度。
5. **GAP-IT2-STATION**：`it2-station` 仍是临时 JWKS、三服务共用一张库，原报告里的浏览器全链是 NOT_RUN。本轮浏览器计分补的是 10 题与公开重测，不把那份站级回放改写成三个独立 schema 的出站。
6. **GAP-R1-029-HISTORY**：`R1-029` 原件仍是 3 个 NOT_RUN（公开重测当时 404、浏览器全链、重测按钮当时未接通）。其后 `it2-station` 与本轮 `it2-score-browser` 已经看到公开重测 201 和可点的重测按钮。原件不回写。
7. **GAP-LUNA**：没有 Luna 签字。IT-1 不能写成 ACCEPT，IT-2 不能写成出站。

## 未跳过的卡

本轮要求的具名门都有浏览器结果。没有把未完成卡写入卡账第 4 节。
