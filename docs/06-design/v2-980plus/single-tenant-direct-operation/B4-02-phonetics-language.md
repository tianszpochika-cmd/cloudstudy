# B4-02 音标库分语言交付（TENANT-B4-02）

> 日期：2026-09-21。系列规划文档 `B4-multilingual-plan.md` 未随提交入库（缺失）；系列入口见 [README](README.md) §7/§10（原引用 TENANT-B4-02）。
> 状态：实现 + 单测 + 管理前端完成；运行（真实 DB/网关/浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **content-service**（owner 不变，无契约变更——`b9-learner` 无音标路径，`p1r-gateway-boundary` 的 `phonetics-domain` 规则冻结不动）：
  - `V20__french_phonetics.sql`：`b3_content_experience` 以 `domain_code='PHONETICS-FR'` 插入 37 个法语音素行（口元音 12 / **鼻化元音 4（ɑ̃ ɛ̃ ɔ̃ œ̃）全覆盖** / **半元音 3（j ɥ w）全覆盖** / 辅音 17 + 借词 `ŋ` 教学变体）+ 4 组最小对立对（é/è、o/ɔ、鼻化对、y/u）。英语 48 行（`PHONETICS` 域）零触碰；`INSERT IGNORE` 幂等可重跑。`mouthProfile` 沿用 `mouth-v1` 结构（投影直通 payload，不解引用，JSON null 亦可——本批种子统一给对象）。
  - `B3ContentJdbcController.phonetics()/minimalPairs()` 新增可选 `language` 参数：空/英语 → 沿用 `PHONETICS`（`setCode` 参数保留，学员端 `?setCode=EN_48_PHASE1` 行为字节不变）；`fr-FR/fr` → `PHONETICS-FR`；其他 BCP-47 → `PHONETICS-{主码}`；非法值 400。纯静态 `phoneticsDomain()` 可单测。
- **管理前端**：新建只读 `AdminPhoneticsView.vue`（`/phonetics`，`admin.content.read` 门）：英语/法语切换器、音素表（音素/分组/例词/说明/口型）、最小对立对标签；`api/phonetics.ts` 走**既有** learner `/phonetics/*` 网关通道（零新增网关路径）；单词页首部加“音标库浏览”入口。
- **验证**：content-service `180/0/0`（新增 `B3PhoneticsDomainTest 12/12`：默认 EN×3、英语标签×4、法语×1、德语×1、非法×5）；learner/learning/assessment 全绿；admin-web `vue-tsc` + `vite build` 通过；`merge --write` 零漂移（424 路由不变）；`validate-contracts` 仍唯一旧失败（IAM）；`p1r-api-contract` 7/2（明细 21 条不变）；网关 63/393/202（B3 值）；`diff --check` + `stale-claims` PASS。

## 2. 设计取舍（诚实记录）

1. **管理端走 learner 投影通道而非新建 admin 读口**：音素是已发布公开参考数据（无 PII），复用既有 `/phonetics/*` 只读通道满足“网关零新增”铁律；owner 侧语言过滤是本任务交付物。若远期需要审计/版本墙，再立项走 B9 admin 通道。
2. **德语 `PHONETICS-DE` 域本批未播种**：控制器已支持 `de-DE → PHONETICS-DE` 映射（单测覆盖），种子留给德语管线（B4-07）；空域读出为空列表而非法语串味（fail-closed 方向正确）。
3. **`setCode` 保留未用**：学员端现状传 `setCode=EN_48_PHASE1`，改动它会碰冻结的 learner 契约；语言维度走新 `language` 参数，老链路零影响。
4. **V20 真实迁移演练未做**：与 V19 同因（集成门控），SQL 为同库既有 `INSERT IGNORE` 模式复刻，resource_key/id 段（3650+/3970+）与英语（3601+/3960+）无交集。

## 3. 未做（后续 B4 任务）

- 法语种子词与德语 5 词（B4-07）；判分本地化（B4-08）；网关重冻（B3 包待独立复核）；P1R 状态变更。
