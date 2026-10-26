# R1 任务状态墙

> 记录版本 27；状态更新 2026/10/05 10:32:47 北京时间。这是114张拆解卡的交付与审批记录，P1R父任务状态仍以canonical台账为准。规划细化完成不表示开发完成。

**本卡范围通过 1/114；待测试审批 0；开发中 0；可认领 0；待准备 113；受阻 0；退回 0；待复审 0。** 共569个执行步骤、593个逐项测试条件。没有把子卡数量折算成产品完成比例。

[执行与审批手册](execution-handbook.md) · [可筛选状态墙](status-wall.html) · [状态原始记录](dev-plan-R1.status.json) · [总计划](dev-plan-R1.md)

开发者提交完整证据后进入“待我测试审批”；只有本聊天复测及审查后才能记录“本卡范围已通过”。新记录待准备表示尚未核准新版卡的输入/交付，已有代码仍可核对后复用。这里显示的记录不会自行触发测试或修改P1R父状态。

| 卡片 | 任务 / 主负责人 | 状态 | 开发步骤 | 审核测试 | 依赖 | 下一步 |
|---|---|---|---:|---:|---|---|
| [R1-001](tasks/R1-001.md) | 官网 11 页空目录诚实态（课程准备中+去注册 CTA） / official-site | 本卡范围已通过 | 5/5 | 3/3 | 无卡片依赖；仍需输入Gate | Independent current-snapshot real browser/upstream acceptance; root supplements storage and actual navigation evidence without another product rework cycle. |
| [R1-002](tasks/R1-002.md) | 注册接口联调（201+会话，无学习能力） / iam-service | 待准备 | 0/5 | 0/3 | R1-001 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-003](tasks/R1-003.md) | 注册幂等回放（同键同结果） / iam-service | 待准备 | 0/5 | 0/3 | R1-002 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-004](tasks/R1-004.md) | 登录/刷新/撤销全套 / iam-service | 待准备 | 0/5 | 0/3 | R1-002 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-005](tasks/R1-005.md) | 多设备列表+踢出（标当前设备） / iam-service | 待准备 | 0/5 | 0/3 | R1-004 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-006](tasks/R1-006.md) | 成人门提交（PASSED/REJECTED 落库审计） / iam-service | 待准备 | 0/5 | 0/3 | R1-004 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-007](tasks/R1-007.md) | 门未过等待态（进系统+能力置灰+人话） / learner-web/mobile | 待准备 | 0/5 | 0/3 | R1-006 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-008](tasks/R1-008.md) | 三同意动态版（先读已发布版本再签）`[DEC-02新增用途待签收]` / iam-service（协作 learner-web/mobile） | 待准备 | 0/5 | 0/3 | R1-006 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-009](tasks/R1-009.md) | 撤回回收（相关能力 403） / iam-service | 待准备 | 0/5 | 0/3 | R1-008 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-010](tasks/R1-010.md) | 画像保存+草稿续填 / learner-service | 待准备 | 0/5 | 0/3 | R1-008 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-011](tasks/R1-011.md) | 向导进度（按完成状态续步到定级） / learner-web/mobile | 待准备 | 0/5 | 0/3 | R1-010 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-012](tasks/R1-012.md) | 重置不枚举（恒 202） / iam-service | 待准备 | 0/5 | 0/3 | R1-002 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-013](tasks/R1-013.md) | 门被拒清理与重进 / iam-service | 待准备 | 0/5 | 0/3 | R1-006 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-014](tasks/R1-014.md) | L1 隔离空库重放（含全部受影响双端 IC） / QA | 待准备 | 0/5 | 0/12 | R1-001、R1-002、R1-003、R1-004、R1-005、R1-006、R1-007、R1-008、R1-009、R1-010、R1-011、R1-012、R1-013、R1-015、R1-016、R1-017 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-015](tasks/R1-015.md) | 注册/登录/重置三页细分验收 / learner-web | 待准备 | 0/5 | 0/3 | R1-002、R1-004、R1-012 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-016](tasks/R1-016.md) | 门说明+同意逐项验收 / learner-web | 待准备 | 0/5 | 0/3 | R1-007、R1-008、R1-009 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-017](tasks/R1-017.md) | 画像字段+引导条验收 / learner-web | 待准备 | 0/5 | 0/3 | R1-010、R1-011 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-018](tasks/R1-018.md) | 前端切 canonical placement 入口（具体 route 从当前生成契约获取，旧调用只作迁移来源） / learner-web/mobile | 待准备 | 0/5 | 0/3 | R1-014、R1-025 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-019](tasks/R1-019.md) | B25 写口下线（网关路由摘除，只读保留） / api-gateway | 待准备 | 0/5 | 0/3 | R1-018、R1-020、R1-023 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-020](tasks/R1-020.md) | 逐题作答 checkpoint（顺序+版本锁） / assessment-service | 待准备 | 0/5 | 0/3 | R1-018 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-021](tasks/R1-021.md) | 规则判分 FULL/ZERO（普通练习行内即时反馈；定级反馈时点待 DEC-04） / assessment-service | 待准备 | 0/5 | 0/3 | R1-020 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-022](tasks/R1-022.md) | 报告快照（reportId+digest 钉死） / assessment-service | 待准备 | 0/5 | 0/3 | R1-021 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-023](tasks/R1-023.md) | 合法 SKIPPED fast-track（已准保守基线） / assessment-service | 待准备 | 0/5 | 0/3 | R1-018 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-024](tasks/R1-024.md) | 重测（新 session，旧报告保留） / assessment-service | 待准备 | 0/5 | 0/3 | R1-022 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-025](tasks/R1-025.md) | 经 G-CONTENT 发布的合成定级题 manifest/种子（10题，四维） / content-service | 待准备 | 0/6 | 0/3 | 无卡片依赖；仍需输入Gate | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-026](tasks/R1-026.md) | 练习绑定合成内容/题目种子（5题） / content-service | 待准备 | 0/5 | 0/3 | R1-025 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-027](tasks/R1-027.md) | 断网续答（checkpoint 恢复）`[DEC-05新增本机暂存待签收]` / learner-web | 待准备 | 0/5 | 0/3 | R1-020 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-028](tasks/R1-028.md) | 定级交互验收（引导/答题/反馈/报告/重试） / learner-web（协作 mobile） | 待准备 | 0/5 | 0/3 | R1-018、R1-019、R1-020、R1-021、R1-022、R1-023、R1-024、R1-027 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-029](tasks/R1-029.md) | L2 干净库重放（10 道→报告） / QA | 待准备 | 0/5 | 0/12 | R1-018、R1-019、R1-020、R1-021、R1-022、R1-023、R1-024、R1-025、R1-026、R1-027、R1-028 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-030](tasks/R1-030.md) | 输入 BC-023…032/199＋IC-013…021/029；交付 OpenAPI（plans/today/planexp/calendar）＋AsyncAPI＋Flyway（plan 快照表）＋Gateway 路由，生成 DTO/TS / learning-service（协作 contracts/api-gateway） | 待准备 | 0/7 | 0/3 | R1-029、R1-025 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-031](tasks/R1-031.md) | ensure 建计划（ASSESSED/SKIPPED→保守基线→pin/来源快照） / learning-service | 待准备 | 0/6 | 0/3 | R1-030 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-032](tasks/R1-032.md) | ensure 幂等重放 / learning-service | 待准备 | 0/5 | 0/3 | R1-031 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-033](tasks/R1-033.md) | 横幅＋解释读口（planningInput＋plan 内嵌＋一句话来路） / learning-service | 待准备 | 0/5 | 0/3 | R1-031 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-034](tasks/R1-034.md) | 今日下发（practiceRef、同源去重、冻结预算/到期排序） / learning-service | 待准备 | 0/6 | 0/3 | R1-031 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-035](tasks/R1-035.md) | 空态分流（未建/完成/无内容/无到期/失败） / learning-service | 待准备 | 0/5 | 0/3 | R1-034 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-036](tasks/R1-036.md) | 目标变更重排（预览＋保留/顺延＋版本锁） / learning-service | 待准备 | 0/6 | 0/3 | R1-031 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-037](tasks/R1-037.md) | 跨端读回＋快照不可变 / learning-service | 待准备 | 0/5 | 0/3 | R1-031 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-038](tasks/R1-038.md) | 首次学习任务（按完成状态） / learning-service | 待准备 | 0/5 | 0/3 | R1-034 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-039](tasks/R1-039.md) | 书架搜索续学（归 L3）`[DEC-08新增供给/例外待签收]` / learner-web（协作 mobile/content-service/learning-service） | 待准备 | 0/5 | 0/3 | R1-025、R1-034 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-040](tasks/R1-040.md) | 前端验收（计划/今日/首页/书架＋双端验收） / learner-web（协作 mobile） | 待准备 | 0/6 | 0/3 | R1-031、R1-032、R1-033、R1-034、R1-035、R1-036、R1-037、R1-038、R1-039 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-041](tasks/R1-041.md) | L3 干净库重放 / QA | 待准备 | 0/6 | 0/12 | R1-030、R1-031、R1-032、R1-033、R1-034、R1-035、R1-036、R1-037、R1-038、R1-039、R1-040 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-042](tasks/R1-042.md) | OpenAPI（sessions/items/attempts/checkpoint）＋AsyncAPI（完成事件）＋Flyway，生成 DTO/TS / assessment-service（协作 contracts/api-gateway） | 待准备 | 0/5 | 0/6 | R1-041 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-043](tasks/R1-043.md) | 建单（内容码＋版本 pin，复用防双击） / assessment-service | 待准备 | 0/4 | 0/6 | R1-042 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-044](tasks/R1-044.md) | 语法 3 道＋阅读 2 道可练可判 / assessment-service | 待准备 | 0/4 | 0/6 | R1-043 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-045](tasks/R1-045.md) | 作答与行内反馈（普通练习即时；定级口径待 DEC-04）`[DEC-04阻塞]` / assessment-service | 待准备 | 0/4 | 0/6 | R1-043 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-046](tasks/R1-046.md) | 检查点与断点续练`[DEC-05新增本机暂存待签收]` / assessment-service | 待准备 | 0/5 | 0/6 | R1-043 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-047](tasks/R1-047.md) | 单元渲染＋完成幂等同步 / assessment-service | 待准备 | 0/4 | 0/6 | R1-043 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-048](tasks/R1-048.md) | 规则版本 pin / assessment-service | 待准备 | 0/4 | 0/6 | R1-043 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-049](tasks/R1-049.md) | attempt 不可变 / assessment-service | 待准备 | 0/4 | 0/6 | R1-043 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-050](tasks/R1-050.md) | 并发/重复提交幂等 / assessment-service | 待准备 | 0/4 | 0/6 | R1-043 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-051](tasks/R1-051.md) | 词汇详情（锁定＋去重＋测验/自评分开） / assessment-service（协作 content-service） | 待准备 | 0/4 | 0/6 | R1-042 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-052](tasks/R1-052.md) | 听说写边界（独立草稿/两题交卷/稳定轮次）`[DEC-05新增本机暂存待签收]` / assessment-service | 待准备 | 0/5 | 0/6 | R1-042 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-053](tasks/R1-053.md) | 完成事件出盒（Outbox→Kafka＋DLQ） / assessment-service（协作 workflow-service） | 待准备 | 0/5 | 0/6 | R1-045 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-054](tasks/R1-054.md) | 前端验收＋双端验收＋无障碍抽查 / learner-web（协作 mobile） | 待准备 | 0/5 | 0/7 | R1-043、R1-044、R1-045、R1-046、R1-047、R1-048、R1-049、R1-050、R1-051、R1-052、R1-053 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-055](tasks/R1-055.md) | L4 干净库重放 / QA | 待准备 | 0/5 | 0/7 | R1-042、R1-043、R1-044、R1-045、R1-046、R1-047、R1-048、R1-049、R1-050、R1-051、R1-052、R1-053、R1-054 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-056](tasks/R1-056.md) | OpenAPI（mistakes/remedies/mastery）＋AsyncAPI＋Flyway，生成 DTO/TS / learning-service（协作 contracts） | 待准备 | 0/5 | 0/6 | R1-055 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-057](tasks/R1-057.md) | 入本（ZERO 才入，来源可追） / learning-service | 待准备 | 0/4 | 0/6 | R1-056 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-058](tasks/R1-058.md) | 补救生成（来源 attempt 组去重） / learning-service | 待准备 | 0/4 | 0/6 | R1-056 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-059](tasks/R1-059.md) | 变式再练（skill 匹配；缺变式保留待补救） / learning-service（协作 content-service） | 待准备 | 0/4 | 0/6 | R1-056 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-060](tasks/R1-060.md) | 补救→D1→D7 分期（沿用冻结规则） / learning-service | 待准备 | 0/5 | 0/6 | R1-059 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-061](tasks/R1-061.md) | 投影更新＋弱点页 / learning-service | 待准备 | 0/5 | 0/6 | R1-056 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-062](tasks/R1-062.md) | D1/D7（可信服务时钟、IANA/DST、来源去重） / learning-service | 待准备 | 0/4 | 0/6 | R1-056 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-063](tasks/R1-063.md) | 空态（未练/全对分开） / learning-service | 待准备 | 0/4 | 0/6 | R1-056 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-064](tasks/R1-064.md) | 跨端一致（主体＋游标＋版本） / learning-service | 待准备 | 0/4 | 0/6 | R1-056 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-065](tasks/R1-065.md) | 中断恢复（同任务＋不重复销账） / learning-service | 待准备 | 0/4 | 0/6 | R1-056 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-066](tasks/R1-066.md) | 前端验收＋双端验收 / learner-web（协作 mobile） | 待准备 | 0/5 | 0/7 | R1-057、R1-058、R1-059、R1-060、R1-061、R1-062、R1-063、R1-064、R1-065 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-067](tasks/R1-067.md) | L5 干净库重放 / QA | 待准备 | 0/5 | 0/7 | R1-056、R1-057、R1-058、R1-059、R1-060、R1-061、R1-062、R1-063、R1-064、R1-065、R1-066 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-068](tasks/R1-068.md) | OpenAPI（review queue/history）＋AsyncAPI＋Flyway，生成 DTO/TS / learning-service（协作 contracts） | 待准备 | 0/5 | 0/6 | R1-067 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-069](tasks/R1-069.md) | SRS入库/评分（SM2_Q03_V1，测验/自评分开） / learning-service | 待准备 | 0/5 | 0/6 | R1-068 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-070](tasks/R1-070.md) | 到期队列/提醒（冻结学习日/IANA-DST） / learning-service | 待准备 | 0/6 | 0/6 | R1-068 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-071](tasks/R1-071.md) | 关闭自报直写（409） / learning-service | 待准备 | 0/4 | 0/6 | R1-068 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-072](tasks/R1-072.md) | 可信完成累计与窄补偿（新增撤销策略待DEC-07） / learning-service | 待准备 | 0/5 | 0/7 | R1-068 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-073](tasks/R1-073.md) | 历史＋回退（原因可查） / learning-service | 待准备 | 0/4 | 0/6 | R1-068 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-074](tasks/R1-074.md) | 空队列（暂无/无记录/失败分开） / learning-service | 待准备 | 0/4 | 0/6 | R1-068 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-075](tasks/R1-075.md) | 跨端一致（同 stage/版本＋去重） / learning-service | 待准备 | 0/4 | 0/6 | R1-068 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-076](tasks/R1-076.md) | 前端验收＋双端验收 / learner-web（协作 mobile） | 待准备 | 0/5 | 0/8 | R1-069、R1-070、R1-071、R1-072、R1-073、R1-074、R1-075 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-077](tasks/R1-077.md) | L6 干净库重放 / QA | 待准备 | 0/5 | 0/7 | R1-068、R1-069、R1-070、R1-071、R1-072、R1-073、R1-074、R1-075、R1-076 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-078](tasks/R1-078.md) | 作答/错题/SRS 联合对账实现（来源覆盖＋唯一性＋最终一致；规则口径见 BC-046/055） / learning-service（协作 assessment-service） | 待准备 | 0/5 | 0/6 | R1-055、R1-067、R1-077 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-079](tasks/R1-079.md) | IT-4 联合重放（L4＋L5＋L6＋203） / QA | 待准备 | 0/5 | 0/7 | R1-078 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-080](tasks/R1-080.md) | OpenAPI（reports/share，分汇总与单次owner）＋Flyway，生成 DTO/TS / learning-service（协作 assessment-service/contracts/api-gateway） | 待准备 | 0/5 | 0/6 | R1-079 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-081](tasks/R1-081.md) | 定级报告卡（双端同版本；SKIPPED 非正式分） / assessment-service | 待准备 | 0/4 | 0/6 | R1-080 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-082](tasks/R1-082.md) | 统计口径（范围/水位/学习日/owner accepted时长/轮次） / learning-service（协作 assessment-service） | 待准备 | 0/6 | 0/6 | R1-080 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-083](tasks/R1-083.md) | 教练建议（注明依据范围；依据不足给起步） / learning-service | 待准备 | 0/4 | 0/6 | R1-080 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-084](tasks/R1-084.md) | 分享深链（最小字段＋不可枚举＋撤销/有效期） / learning-service（协作 assessment-service） | 待准备 | 0/5 | 0/6 | R1-080 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-085](tasks/R1-085.md) | 无数据报告＋版本固定 / learning-service（协作 assessment-service） | 待准备 | 0/4 | 0/6 | R1-080 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-086](tasks/R1-086.md) | 前端验收＋双端验收 / learner-web（协作 mobile） | 待准备 | 0/5 | 0/7 | R1-081、R1-082、R1-083、R1-084、R1-085 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-087](tasks/R1-087.md) | L7 干净库重放 / QA | 待准备 | 0/5 | 0/7 | R1-080、R1-081、R1-082、R1-083、R1-084、R1-085、R1-086 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-088](tasks/R1-088.md) | OpenAPI（drafts/reviews/publishes/permissions）＋Flyway＋Gateway 鉴权，生成 DTO/TS / content-service（协作 contracts/api-gateway） | 待准备 | 0/6 | 0/5 | R1-087 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-089](tasks/R1-089.md) | 建稿＋编辑（版本锁）＋版权绑定（送审前绑定）`[DEC-08新增供给/例外待签收]` / content-service | 待准备 | 0/5 | 0/5 | R1-088 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-090](tasks/R1-090.md) | 无权边界（先鉴权＋403＋不泄漏存在性） / content-service | 待准备 | 0/5 | 0/5 | R1-088 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-091](tasks/R1-091.md) | 送审资格＋报告绑定（409 一次列齐）`[DEC-08新增供给/例外待签收]` / content-service | 待准备 | 0/5 | 0/5 | R1-089 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-092](tasks/R1-092.md) | L1/L2正负向审核（四主体，版本/hash/reviewVersion） / content-service | 待准备 | 0/6 | 0/6 | R1-091 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-093](tasks/R1-093.md) | 独立 PUBLISH 命令→PUBLISHED 事实与异步目录刷新 / content-service | 待准备 | 0/5 | 0/5 | R1-092 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-094](tasks/R1-094.md) | 发布投影（发布中/已发布/同步异常） / content-service | 待准备 | 0/5 | 0/5 | R1-093 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-095](tasks/R1-095.md) | 下架（普通/强制分开确认）`[DEC-08新增供给/例外待签收]` / content-service | 待准备 | 0/6 | 0/6 | R1-094 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-096](tasks/R1-096.md) | 回滚（先验旧版资格＋恢复点） / content-service | 待准备 | 0/5 | 0/5 | R1-094 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-097](tasks/R1-097.md) | 旧 B3 精确下线（113+2，一次性；单独授权＋先备份） / content-service | 待准备 | 0/6 | 0/4 | R1-088 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-098](tasks/R1-098.md) | 在学版本锁定（普通升级 pin 续读；强制下线停） / content-service | 待准备 | 0/5 | 0/5 | R1-094 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-099](tasks/R1-099.md) | 管理登录/回跳/续期 / admin-ops-service（协作 iam-service） | 待准备 | 0/5 | 0/5 | R1-088 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-100](tasks/R1-100.md) | 仪表盘（口径/时间/更新；三态分开） / admin-ops-service | 待准备 | 0/5 | 0/5 | R1-099 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-101](tasks/R1-101.md) | 权限只读（iam.policy.read；无匹配空态） / admin-ops-service（协作 iam-service） | 待准备 | 0/5 | 0/5 | R1-099 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-102](tasks/R1-102.md) | 前端验收（admin-web 建稿/审核/发布/仪表盘/权限） / admin-web | 待准备 | 0/5 | 0/8 | R1-089、R1-090、R1-091、R1-092、R1-093、R1-094、R1-095、R1-096、R1-097、R1-098、R1-099、R1-100、R1-101 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-103](tasks/R1-103.md) | L8隔离内容增量重放（IT-6） / QA | 待准备 | 0/6 | 0/6 | R1-088、R1-089、R1-090、R1-091、R1-092、R1-093、R1-094、R1-095、R1-096、R1-097、R1-098、R1-099、R1-100、R1-101、R1-102 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-104](tasks/R1-104.md) | 各owner契约读投影（治理/客服/隐私/audit/ops），Flyway/生成DTO/TS / admin-ops-service（协作 learner.privacy/IAM/audit/workflow/contracts） | 待准备 | 0/6 | 0/5 | R1-103 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-105](tasks/R1-105.md) | 治理读建档（有来源只读档案；085 锁定/088 隔离/089 升级/090 关闭均只读不执行）`[DEC-01写处置待签收]` / admin-ops-service | 待准备 | 0/5 | 0/6 | R1-104 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-106](tasks/R1-106.md) | 举报队列读（脱敏＋游标；匿名 401） / admin-ops-service | 待准备 | 0/5 | 0/6 | R1-104 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-107](tasks/R1-107.md) | 客服读（本人/授权客服、CLEAN safePreviewRef；hash-old标不足，写归R2） / admin-ops-service | 待准备 | 0/6 | 0/7 | R1-104 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-108](tasks/R1-108.md) | 隐私读（导出/删除生命周期、冷静期/撤回资格/receipt；worker写归R2） / learner-service.privacy（协作 IAM/workflow/admin授权读投影） | 待准备 | 0/6 | 0/7 | R1-104 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-109](tasks/R1-109.md) | 观测读（401 包络＋三 ID 关联；脱敏支持编号） / audit-service | 待准备 | 0/5 | 0/6 | R1-104 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-110](tasks/R1-110.md) | 可靠性读（Saga 记录＋Outbox/DLQ 可观察） / workflow-service | 待准备 | 0/5 | 0/6 | R1-104 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-111](tasks/R1-111.md) | 发布门读（探针/SBOM/回滚演练记录读） / workflow-service | 待准备 | 0/5 | 0/6 | R1-104 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-112](tasks/R1-112.md) | 审计列表读（分页/过滤/脱敏；导出 internal-only）`[DEC-09新增导出政策待签收]` / audit-service | 待准备 | 0/6 | 0/6 | R1-104 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-113](tasks/R1-113.md) | 管理治理/客服/举报/隐私/审计读与学习端支持/隐私读回验收 / admin-web（协作 learner-web/mobile/learner.privacy/IAM） | 待准备 | 0/6 | 0/8 | R1-105、R1-106、R1-107、R1-108、R1-109、R1-110、R1-111、R1-112 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
| [R1-114](tasks/R1-114.md) | R1全部适用切片隔离重放/独立Review/证据归档 / QA | 待准备 | 0/6 | 0/8 | R1-001、R1-002、R1-003、R1-004、R1-005、R1-006、R1-007、R1-008、R1-009、R1-010、R1-011、R1-012、R1-013、R1-014、R1-015、R1-016、R1-017、R1-018、R1-019、R1-020、R1-021、R1-022、R1-023、R1-024、R1-025、R1-026、R1-027、R1-028、R1-029、R1-030、R1-031、R1-032、R1-033、R1-034、R1-035、R1-036、R1-037、R1-038、R1-039、R1-040、R1-041、R1-042、R1-043、R1-044、R1-045、R1-046、R1-047、R1-048、R1-049、R1-050、R1-051、R1-052、R1-053、R1-054、R1-055、R1-056、R1-057、R1-058、R1-059、R1-060、R1-061、R1-062、R1-063、R1-064、R1-065、R1-066、R1-067、R1-068、R1-069、R1-070、R1-071、R1-072、R1-073、R1-074、R1-075、R1-076、R1-077、R1-078、R1-079、R1-080、R1-081、R1-082、R1-083、R1-084、R1-085、R1-086、R1-087、R1-088、R1-089、R1-090、R1-091、R1-092、R1-093、R1-094、R1-095、R1-096、R1-097、R1-098、R1-099、R1-100、R1-101、R1-102、R1-103、R1-104、R1-105、R1-106、R1-107、R1-108、R1-109、R1-110、R1-111、R1-112、R1-113 | 核对父任务认领、依赖和适用输入 Gate，再由审核者记录 READY |
