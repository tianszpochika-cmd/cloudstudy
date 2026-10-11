# 独立审查清单（按 Luna 口径）

> 建立：2026-10-11（Asia/Shanghai）。审查方：Grok Bot 测试项目练手（独立审查，**不是** Luna）。
> Luna 历史原件与 `lunaStamp` **一律不改写**。本清单从 `evidence/redesign/2026-10-10/station-acceptance/`、acceptance-matrix、各站 outbound-review 提炼。

## 0. Luna 历史结论（只读）

| 时间 | 基线 | 结论 | 出处 |
|---|---|---|---|
| 2026-10-10 | `69bea68b` | **IT-1 REJECT / FAIL**；IT-2 BLOCKED | `evidence/redesign/2026-10-10/station-acceptance/it1/report.md` |
| 2026-10-10 | 同基线 | 硬阻塞：AUTH_TRANSPORT（密码经 HTTP Gateway）、IAM_AUTH_CORS（无 ACAO/ACAC） | 同上 + acceptance-matrix |
| 其后 r1…r8 | `809dfcfe` | 执行代理自审 PASS / PASS_WITH_GAPS；`lunaStamp=false` | 各站 outbound-review / CARD-LEDGER |

Luna REJECT 的两处 P1 在当前 HEAD 已有修复候选：两端 `getIamAuthBaseUrl()` + `passwordClient`/`mobileIamAuthClient` 直打 `https://…:18087`；`IamAuthCorsConfiguration` 已装入安全链（`IamAuthCorsConfigurationTest` 本轮绿）。独立审查须对证据与源码再核，不得自动把自审 PASS 升级为签收。

## 1. 通用出站准则（每站）

1. **真实链**：UI →（认证直 IAM TLS；领域经 Gateway）→ owner API → owner DB；必要负向同轮可追溯。
2. **隔离**：各服务独立 MySQL schema/user；禁止三服务共库改 Flyway 表名冒充隔离；禁止临时 JWKS / loop stub / 手工 token 代替 IAM RS256。
3. **浏览器**：Web + H5，至少 1280 与 390；真实 Chrome；密码/refresh 不得进 Gateway；证据无 Bearer、无答案密钥、无私钥。
4. **不改钥匙串**：测试 CA 只用临时 profile SPKI / Java truststore。
5. **不碰 qida**：不 stop/start/prune 非本轮容器。
6. **诚实缺口**：缺实现判 FAIL，不得标 NOT_RUN；历史 FAIL 目录不回写；`lunaStamp` / `accepted` / `*Outbound` 原件字段不由本审查方改成 Luna 名义。
7. **独立签收**：本方签收写入 `INDEPENDENT-SIGNOFF.md`（`independentReviewer`），与 Luna 字段分离。

## 2. 分站检查项

### IT-1（R1-001…017）

- [ ] AUTH_TRANSPORT：注册/登录/重置 DOM 目标为 IAM HTTPS，不是 Gateway HTTP。
- [ ] IAM_AUTH_CORS：学习端 origin 的 auth preflight 带回 ACAO/ACAC/ACAM；攻击 origin 关闭。
- [ ] 官网 11 页 ×2 视口 200；注册 CTA 到学习端注册页。
- [ ] 注册 201 + 幂等；登录/踢出；成人门 PASSED/REJECTED（**表单可提交未成年年份并由服务端拒绝**）；门未过等待态可退出。
- [ ] 三同意动态版；撤回后学习口 403（**设置/隐私页须有撤回入口**）。
- [ ] 画像读回；3 击到定级；重置不枚举；拒后重进。
- [ ] L1 干净库重放有明细。

### IT-2（R1-018…029）

- [ ] 三独立 owner schema + IAM 真签；公开重测 201；旧 POST start 404。
- [ ] 10 题 FULL/ZERO；报告快照；跳过/重测；断网恢复或等价证据。
- [ ] 不把 R1-029 历史 3×NOT_RUN 回写成 PASS。

### IT-3（R1-030…042）

- [ ] 正式报告 → 横幅 → 今日任务 → replan；Web/H5 两视口；干净库重放。

### IT-4（R1-043…059）

- [ ] 建单→作答→回执→错题→补救→今日复习全链；补救投影可读；干净库事实一致。

### IT-5（R1-060…069）

- [ ] 定级卡、日/周状态、有效时长、规则建议、分享/撤销；空态无能力零分；摘要指纹一致。

### IT-6（R1-070…090）

- [ ] 建稿→冲突→双签/简审→发布→投影→下架/强制停止→回滚边界。
- [ ] **发布台状态须可持久化**（重启后指纹不变）；不得仅进程内存。

### IT-7（R1-091…115）

- [ ] 收口链 fail-closed；处置写关闭时无假按钮；`it7_closure_desk` 落库；重启只读指纹不变。
- [ ] 全链 IT-1…IT-7 冒烟 PASS。

## 3. 严重度

| 级 | 含义 |
|---|---|
| P1 | 出站阻塞（认证边界、隔离、数据丢失、假闭环） |
| P2 | 站级 AC 未用真实 UI 证成，或关键负向缺入口 |
| P3 | 装饰/文档溢出、测试额度、历史 OPEN 项；可记残留不挡签收 |

## 4. 本轮独立审查动作

1. 只读核对源码与最新 PASS 证据后缀。
2. 跑关键单测（如 IAM CORS）。
3. 发现记入 `INDEPENDENT-SIGNOFF.md`；有 P1/P2 则开 `rv*` 修复轮，复验后再签。
4. 永不写 `lunaStamp=true`。
