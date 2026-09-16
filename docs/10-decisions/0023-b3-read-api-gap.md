# P1-LIVE-013：B3 六技能读接口整面缺失（未建 scope，非缺陷）

- 状态：OPEN（产品构建工作，非深夜缺陷修复；未动手）
- 日期：2026-09-16
- 发现：登录态 18 页扫描 `scripts/runtime/p1r-live-pages.mjs`（18/18 渲染零 pageerror）

## 活实测矩阵

前端 `apps/learner-web/src/api/b3.ts` 调用的读路径在网关与后端均无实现（浏览器报 CORS 实为无路由 404 无 ACAO 头）：

| 前端读路径 | 网关执行 | 后端实现 |
|---|---|---|
| `/api/v1/grammar/points|exercises|mastery` | 无 | 无（仅有 `/grammar/attempts` 等写口） |
| `/api/v1/writing/templates|materials|prompts|history|proofreading/exercises` | 无 | 无（仅有 submissions/corrections） |
| `/api/v1/listening/materials` | 无 | 无（仅有 sessions/dictation） |
| `/api/v1/reading/articles` | 无 | 无（仅有 attempts/mining） |
| `/api/v1/phonetics/catalog|minimal-pairs` | 无 | 无 |
| `/api/v1/sync/offline-packages` | 无 | 待查（B4 离线包读） |

后端 B3 共 19 个写/提交类映射（`B3LearningJdbcController`），读类 0 个。

## 好的部分（已活验证）

- 缺读数据的四页（语法/写作/听力/阅读）正确落入 `state-panel--offline`（八态设计按预期工作）。
- 其余 12 页全洁；speak/world 渲染仅后台取数失败。

## 需要的产品构建（M5-003 范围）

后端读端点 + 内容种子（语法点/文章/听力材料/音标集均无种子）+ 网关接线 + 契约。另：读接口的题 ID 应直接用字符串，避免 P1-LIVE-010 的 FNV-64 精度坑重演。
