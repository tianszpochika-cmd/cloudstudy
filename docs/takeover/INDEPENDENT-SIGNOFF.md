# 独立签收台账（非 Luna）

> 审查方：`independentReviewer: Grok Bot 测试项目练手`
> 日期：2026-10-11（Asia/Shanghai）
> 源码基线（审查开始）：`809dfcfe`（`dev-redesign`）
> **诚实规则**：本文件是独立审查签收。`lunaStamp` / Luna 名义 `accepted` / `*Outbound` **保持 false / 不改写**。历史 REJECT 原件只读。

## 1. 总览

| 站 | 独立结论 | 发现数 | 证据锚点 | 签收状态 |
|---|---|---|---|---|
| IT-1 | FINDINGS | 2（P2） | named-gates `c08e65d3`；R1-014；AUTH/CORS 源码已修 Luna P1 | 待 rv1 修复后复验签收 |
| IT-2 | PASS_PENDING_FIXES | 0 新开 | three-schema `2f1d24b6`；score-browser；full-chain | 随 rv1 回归后签收 |
| IT-3 | PASS_PENDING_FIXES | 0 新开 | browser `d2012bf6` | 随 rv1 回归后签收 |
| IT-4 | PASS_PENDING_FIXES | 0 新开 | browser `c460b646` | 随 rv1 回归后签收 |
| IT-5 | PASS_PENDING_FIXES | 0 新开（P3 残留） | browser `1f244c3b` | 随 rv1 回归后签收 |
| IT-6 | FINDINGS | 1（P1） | browser `ad30b8bc`；`ContentReleaseStudio` 内存 Map | 待 rv1 持久化后复验签收 |
| IT-7 | PASS_PENDING_FIXES | 0 新开 | browser `3ef210cd`；desk `627fa9bf`；full-chain | 随 rv1 回归后签收 |
| 全链 | PASS_PENDING_FIXES | — | `full-chain-r8-627fa9bf` 58/58 PASS | 随 rv1 回归后签收 |

残留不挡签收（记入但不开修）：

| ID | 级 | 说明 |
|---|---|---|
| RES-WALL-114 | P3 | 原 114 卡墙仍 OPEN；115 张为按站拆卡，不补空卡 |
| RES-ARTWORK | P3 | H5 390 装饰节点超出盒子 10–24px，文档横向滚动为 0 |
| RES-RATE-BUDGET | P3 | 证据栈曾抬高 Gateway 高风险限额；生产默认未改 |
| RES-H5-RELOAD | P3 | hash 不重载时内存门状态可能旧；产品路由在文档加载后会送回无权限页 |

## 2. 发现明细

### F-IT1-01 未成年年份无法经表单提交（P2）

- **准则**：acceptance-matrix R1-006 — 成人/未成年各有一条独立用例；合成年龄经 UI 提交后服务端判定。
- **事实**：`AdultGatePage.vue` 的 `canConfirm` 与 `max=getFullYear()-18`、mobile `adultBirthYearValid` 使未成年年份无法点继续；named-gates 用同会话另发 API 才得到 REJECTED。
- **要求**：UI 允许提交 1900…当年的整数年；服务端为唯一判定；未成年提交后页面进入 REJECTED/无权限态，无「改年份晋级」控件。

### F-IT1-02 学习同意撤回无页面入口（P2）

- **准则**：R1-009 — 已登录主体撤回 ADULT_LEARNING 后学习口 403。
- **事实**：证据靠直接 `PUT /iam/consents`；Web/H5 设置·隐私页无撤回按钮。
- **要求**：设置/隐私提供明确「撤回学习同意」；确认后写 WITHDRAWN；随后学习口 403；账号仍 ACTIVE。

### F-IT6-01 发布台仅进程内存（P1）

- **准则**：IT-6 出站与 IT-7 对等的持久化诚实性；r6 summary 自承 `studio: in-memory`。
- **事实**：`ContentReleaseStudio` 用 `LinkedHashMap` 保存 versions/pins/idempotency；重启丢失。IT-7 已落 `it7_closure_desk`，IT-6 未跟进。
- **要求**：发布台状态持久化（Flyway 表或等价）；重启后只读指纹不变；补浏览器/重启证据；旧内存行为单测可留作对照但不作为出站。

## 3. Luna P1 复核（本轮）

| 项 | 结果 | 依据 |
|---|---|---|
| AUTH_TRANSPORT | 源码 PASS | Web `iamAuthBaseUrl` + passwordClient；Mobile `mobileIamAuthClient` → `requireIamAuthBaseUrl(getIamAuthBaseUrl())`；默认 `https://127.0.0.1:18087/api/v1` |
| IAM_AUTH_CORS | 单测 PASS | `IamAuthCorsConfiguration` + `IamAuthCorsConfigurationTest`（本轮 `mvn -Dtest=IamAuthCorsConfigurationTest` exit 0） |
| 浏览器具名门 | 历史 PASS 未签 | `it1-named-gates` / R1-014；rv1 须对 F-IT1-01/02 重采证据 |

## 4. 签收栏（修复轮完成后填写）

| 站 | independentReviewer | 日期 | commit | evidence | verdict |
|---|---|---|---|---|---|
| IT-1 | Grok Bot 测试项目练手 | _pending rv1_ | | | |
| IT-2 | Grok Bot 测试项目练手 | _pending rv1_ | | | |
| IT-3 | Grok Bot 测试项目练手 | _pending rv1_ | | | |
| IT-4 | Grok Bot 测试项目练手 | _pending rv1_ | | | |
| IT-5 | Grok Bot 测试项目练手 | _pending rv1_ | | | |
| IT-6 | Grok Bot 测试项目练手 | _pending rv1_ | | | |
| IT-7 | Grok Bot 测试项目练手 | _pending rv1_ | | | |
| FULL-CHAIN | Grok Bot 测试项目练手 | _pending rv1_ | | | |

签收填写规则：`verdict=SIGNED_PASS` 仅当该站发现已关、关键证据 PASS、且未改任何 `lunaStamp`。可选附 `residual: RES-*`。

## 5. 调度

- 修复轮：`rv1`，screen `cs-rv1`，分支 `grok/cs-rv1-20261011`（自 `dev-redesign`）。
- 合并后由调度方按本文件第 4 节签字，必要时开 `rv2`。
- Luna 字段始终外部待办。
