# Phase 3｜K12 未成年人、家长、教师与机构 UI/UX 详细设计（v1 历史草案）

> **状态：历史/迁移参考。** v2 Phase 3 的页面宿主、交互、Gate 和验收以 [`../v2-980plus/06-Phase3-K12合规与教师机构功能设计.md`](../v2-980plus/06-Phase3-K12合规与教师机构功能设计.md) 为准；本文件不能单独生成新任务或放行受监管页面。  
>
> 历史设计状态：Phase 3 受监管扩展草案；默认关闭。只有资质/地区/版权/年龄/监护/隐私/防沉迷/AI 安全 Gate 同时通过后，才允许注册路由、导航、预取和数据下发。  
> 关联主设计：[K12 未成年人教师机构与合规详细设计](K12未成年人教师机构与合规详细设计.md)、[全局横向设计基线](../shared/全局横向设计基线.md)。
> v2 服务边界：页面只能通过 Gateway 访问 Phase 3 受控服务；前端 flag、年龄、监护关系、地区或角色字段不能自行放行，必须由 IAM/领域服务返回可审计的 Gate 决策。

## 1. 项目边界与角色宿主

| 角色 | 主要项目 | 可见范围 | 禁止事项 |
|---|---|---|---|
| 未成年学习者 | `apps/mobile`；小程序由同一项目条件编译 | 本人被授权的年级、地区、教材版本和任务 | 不展示成人社交/商业诱导；不绕过防沉迷和监护门 |
| 监护人 | `apps/mobile`；具体 Web 入口待合规确认 | 已绑定子女的策略、授权、使用摘要和隐私请求 | 不默认查看无授权原始作文/录音；不可代替平台审计 |
| 教师/机构 | `apps/admin-web` | 授权班级/租户的聚合学情和内容工作流 | 不跨组织查询、不导出超范围个人数据、不自行发布未审内容 |
| 平台合规/审核 | `apps/admin-web` | 门控、版权、投诉、应急、审计和匿名化数据 | 不以 UI flag 代替资质/法律证据 |
| 公开访客 | `apps/official-site` | 已批准的公开说明和下载/申请入口 | 不进入学生、家长、教师业务页面 |

Phase 3 页面统一使用 `/k12/*`、`/parent/*`、`/teacher/*`、`/org/*`、`/admin/k12/*` 命名空间。所有链接先经服务端 `K12_GATE`、主体资格、账号类型、监护授权和资源权限校验；失败显示解释页，不静默跳回 Phase 1 首页。

## 2. Gate 与统一状态

### 2.1 页面开放顺序

```text
REGULATORY_NOT_READY
  → QUALIFICATION_APPROVED
  → CONTENT_RIGHTS_APPROVED
  → AGE_ACCOUNT_READY
  → GUARDIAN_CONSENT_ACTIVE（适用时）
  → PRIVACY_NOTICE_ACCEPTED
  → PRODUCT_FLAG_ENABLED
  → READY
```

任何中间状态都不注册 K12 默认入口。已进入的会话若 Gate 撤回，立即转 `SUSPENDED`，保留可解释的学习记录和申诉入口；不得继续下发新教材或新 AI 结果。

### 2.2 K12 页面状态

| 状态 | 页面表现 |
|---|---|
| `GATE_BLOCKED` | 显示关闭原因、适用范围和官网/客服说明；不暴露内部资质凭证 |
| `CONSENT_PENDING` | 只显示隐私说明、监护授权步骤和撤回入口；不加载学习内容 |
| `AGE_REVIEW` | 显示年龄/主体校验进度，失败可重试或转人工，不以客户端字段决定年龄 |
| `CONTENT_PENDING` | 教材、地区、版权或版本未就绪，显示可用替代内容（若有） |
| `READY` | 仅展示授权版本、年级、地区和任务；所有 CTA 受服务端返回控制 |
| `LIMITED` | 防沉迷、额度、时段、设备或权限限制；显示剩余时间/恢复条件，不羞辱用户 |
| `OFFLINE_READONLY` | 只读已下载且仍有效的内容；不能提交新成绩或绕过撤回 |
| `SUSPENDED/REVOKED` | 停止新内容和新任务，保留历史解释、申诉和数据权利入口 |

## 3. Canonical 路由地图

| 页面组 | Canonical route | 责任 | 状态 |
|---|---|---|---|
| Gate/年龄 | `k12/gate`、`k12/age`、`k12/consent` | 开放条件、年龄、监护授权和隐私说明 | `GATE_BLOCKED/AGE_REVIEW/CONSENT_PENDING/READY` |
| K12 首页 | `k12/home` | 适龄首页、今日任务、剩余时长、家长/教师通知 | `LIMITED/READY`；不出现 Phase 1 成人默认模块 |
| 教材库 | `k12/textbooks`、`k12/textbooks/:id` | 年级、地区、出版社、学期、版权和版本选择 | `CONTENT_PENDING/READY/OFFLINE_READONLY` |
| 单元学习 | `k12/unit/:id`、`k12/unit/:id/lesson/:lessonId` | 生词、课文、点读、逐句朗读、复习和完成条件 | `ST-D/ST-E/ST-G`；教材版本失效可迁移/退出 |
| 适龄界面 | `k12/mode` | 小学/初中/高中模式的字号、视觉、内容和时长策略 | `READY/LIMITED`；模式切换需服务端授权 |
| 家长模式 | `parent/home`、`parent/controls`、`parent/consent`、`parent/privacy` | 绑定、时段、密码锁、摘要、撤回、数据请求 | `ST-J/K`；不直接暴露教师/机构范围 |
| 高中升学 | `k12/high-school`、`k12/gaokao` | 微课、读后续写 AI 辅助、机考规则包、剧情挑战 | `K12_GATE + AI_GATE + RIGHTS_GATE`；失败不伪造分数 |
| 教材 RAG | `k12/rag`、`k12/rag/result/:id` | 授权教材问答、引用、版本和撤回 | `ST-D/F`；无引用/无授权不回答 |
| 教师工作台 | `teacher/dashboard`、`teacher/classes/:id`、`teacher/assignments` | 班级、作业、内容分发、学情聚合 | `ST-M`；仅已分配班级/组织 scope |
| 机构工作台 | `org/dashboard`、`org/reports`、`org/content`、`org/api` | 组织报告、授权内容分发、开放 API 管理 | `ST-M/N`；聚合、字段策略和水印可见 |
| 隐私与投诉 | `k12/privacy`、`k12/complaints` | 访问/更正/删除/导出、内容/版权/安全投诉 | `ST-J/K`；请求主体和监护关系必须复核 |
| 后台合规 | `admin/k12/gates`、`admin/k12/rights`、`admin/k12/audit`、`admin/k12/incidents` | Gate、资质、版权、应急、审计和投诉 | `ST-M/N`；双审、最小权限和全量审计 |

## 4. FEAT 与页面/状态追溯

| 主功能 | PRD | 页面 | 事实边界 | 最小验收 |
|---|---|---|---|---|
| `FEAT-K12-001` | §37.1 教材版本库 | `k12/textbooks`、`admin/k12/rights` | `content_version`、`content_rights`、地区/年级/版权状态 | 只显示 `PUBLISHED + AVAILABLE` 版本；来源、授权期限、地区和撤回可见 |
| `FEAT-K12-002` | §37.1 课内生词/课文/朗读 | `k12/unit/:id` | `k12_lesson`、`learning_session`、`reading_attempt`、`pronunciation_attempt` | Unit 进度、点读、逐句朗读、断点恢复、无媒体降级和版权版本一致 |
| `FEAT-K12-003` | §38.1 适龄界面 | `k12/home`、`k12/mode` | `ageBand`、`uiPolicyVersion`、`featurePolicy` | 字体/触控/动效适龄；隐藏成人社交与商业诱导；策略变更可审计 |
| `FEAT-K12-004` | §16.15、§38.1 防沉迷 | `k12/home`、`k12/lock` | `usage_policy`、时区、设备会话、锁定事件 | 锁定状态服务端计算；显示原因、恢复时间、申诉，不靠前端绕过 |
| `FEAT-K12-005` | §38.1 家长锁/远程监督 | `parent/home`、`parent/controls` | `guardian_link`、`guardian_policy`、`consent_record` | 绑定、密码/二次认证、时段、摘要、撤回和删除请求可回放 |
| `FEAT-K12-006` | §40.3 中高考听说机考 | `k12/gaokao`、`k12/exam/:id` | `exam_rule_pack`、`exam_session`、题目/音频/评分版本 | 地区规则包和版权有效；断点、设备权限、结果文案和非官方性质可见 |

派生 `SUBFEAT-K12-001`～`022` 的页面归属以主设计第 4 节为准；家长、教师、机构、RAG、隐私、版权和应急能力不得因共用 `k12/home` 而合并权限或数据范围。

## 5. 关键交互规则

### 5.1 未成年人学习者

- 首页先显示年龄段/地区/教材版本和今日剩余可用时间，再显示学习任务；不显示成人 VIP、随机奖励、陌生人互动和自由社交。
- 学习完成、锁定、弱网、教材撤回、权限不足和内容空缺均有解释性卡片；失败不使用“你落后了”等羞辱性文案。
- 朗读/录音权限拒绝时提供点读、字幕、静音复习等替代路径；原始录音默认最小化保存并可删除。
- 低配设备和小程序不初始化高成本 3D/AI/复杂图表；Performance 档使用静态卡片、列表和系统播放器。

### 5.2 家长

- 绑定与撤回是明确的双向状态，不因打开家长页就默认同意；每次查看/修改策略记录主体、原因、时间和版本。
- 家长看到使用时长、任务完成、内容范围和风险提示的最小摘要；原始作文/录音/聊天等敏感材料需要独立授权，不进入默认看板。
- 删除、导出、停止处理和投诉有进度查询；撤回后停止不必要的新处理，历史保留以当期合法依据为准。

### 5.3 教师/机构

- 所有列表先显示 `orgId/classId/reportScope/lastUpdatedAt/completeness`；数据延迟不得展示为 0 或“未完成”。
- 班级作业、内容分发、报告导出和 API token 都是后台操作；学生端只消费服务端授权任务，不接收教师密钥。
- 越权、跨组织、已撤回内容、字段策略不允许时，页面保持当前上下文并显示稳定错误码，不跳转到其他组织。

## 6. 跨端验收矩阵

| 能力 | mobile App/H5/iPad | 微信小程序（同一项目） | learner Web | admin Web | official site |
|---|---|---|---|---|---|
| K12 学习/教材 | ✅ 按设备能力 | ✅ 按能力降级 | ✅ 仅在 Gate 后 | 内容/版权审核 | ❌ |
| 家长 | ✅ | ✅ | 待合规确认，不默认开放 | 工单/审计只读 | ❌ |
| 教师/机构 | 学生任务消费 | 轻量任务消费 | 学生报告消费 | ✅ 主工作台 | ❌ |
| AI/RAG | ✅ 在独立 Gate 后 | 默认静态/关闭降级 | ✅ | 抽检/投诉/成本 | 公开说明 |
| 防沉迷/锁定 | ✅ 服务端状态 | ✅ 服务端状态 | 只读状态 | 策略/审计 | ❌ |

所有路线至少覆盖成功、空、加载、错误、离线、权限、恢复、Gate 关闭、撤回、年龄/监护未完成、时间锁定、低配和无障碍等效操作。实现前还必须完成 K12 主设计第 6 节的 contracts、migration、事件 catalog、专业合规复核和 E2E 验收。
