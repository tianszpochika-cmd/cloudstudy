# 跨阶段通用底层核心模块与技术规范 (Core Underlying Engines & Infrastructure)

> **对应 PRD 章节**：第 5 章 (Core Underlying Engines) 与 第 6 章 (Multi-Platform & API Contracts)  
> **面向对象**：全栈开发人员、算法工程师、数据中台工程师、运维与测试团队  
> **设计目标**：构建贯穿 Phase 1 至 Phase 3 的高可用、可复用、高精度的通用基础设施与算法底座。

---

## 1. 自适应记忆复习调度引擎 (Adaptive Memory & Spaced Repetition)

### 1.1 改进版 SuperMemo-2 / FSRS (Free Spaced Repetition Scheduler) 算法
结合学习者的**答题质量 (Quality 0-5)**、**反应耗时 (Response Time in ms)** 与 **历史失误率** 动态计算下次复习时间：

```typescript
/**
 * 记忆调度算法核心参数
 */
export interface MemoryItemState {
  itemId: string;              // 词汇、句型或语法点 ID
  repetitionCount: number;     // 连续正确重复次数
  easeFactor: number;          // 难度系数 EF (初始 2.5，最小 1.3)
  intervalDays: number;        // 当前复习间隔 (天)
  lastReviewedAt: Date;        // 上次复习时间
  nextReviewDue: Date;         // 下次预计复习时间
  stability: number;           // 记忆稳定性评分
}

export function calculateNextReview(
  currentState: MemoryItemState,
  quality: number, // 0: 彻底遗忘, 1: 错误, 2: 严重犹豫, 3: 勉强正确, 4: 熟练, 5: 瞬间秒答
  responseTimeMs: number
): MemoryItemState {
  let { repetitionCount, easeFactor, intervalDays } = currentState;
  
  // 结合响应时间修正质量评分 (若超时超过基准则惩罚质量等级)
  if (responseTimeMs > 8000 && quality >= 3) {
    quality = quality - 1;
  }

  // 1. 更新难度因子 EF
  // EF'' = EF + (0.1 - (5 - Q) * (0.08 + (5 - Q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  // 2. 更新复习间隔与重复计数
  if (quality < 3) {
    // 回答错误或遗忘，重置周期
    repetitionCount = 0;
    intervalDays = 1; // 次日立即复习
  } else {
    // 回答正确
    if (repetitionCount === 0) {
      intervalDays = 1;
    } else if (repetitionCount === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitionCount += 1;
  }

  const nextReviewDue = new Date();
  nextReviewDue.setDate(nextReviewDue.getDate() + intervalDays);

  return {
    ...currentState,
    repetitionCount,
    easeFactor: Number(easeFactor.toFixed(2)),
    intervalDays,
    lastReviewedAt: new Date(),
    nextReviewDue
  };
}
```

---

## 2. 英语知识图谱与错题追踪网络 (Knowledge Graph & Error Tracking)

### 2.1 拓扑结构设计
- **12,000+ 词汇节点 (Lexical Nodes)**：包含 CEFR 等级 (A1-C2)、词根词缀 (Etymology)、同义词簇 (Synonym Clusters)、中高考/四六级/雅思核心标签。
- **800+ 语法与考点节点 (Grammar & Skill Nodes)**：以树状与有向无环图 (DAG) 组织。
  - 示例：`非谓语动词 (Non-finite Verbs)` -> `现在分词 (Present Participle)` -> `分词作伴随状语 (Participle as Adverbial of Accompanying)`。
- **错题因果溯源 (Root-cause Tracing)**：
  - 用户在做高考读后续写或单选错题时，系统不止记录题目本身，而是向上反查其前置依赖的知识节点，形成个性化“红色薄弱知识孤岛”并在复习时定向轰炸。

---

## 3. 全链路多维能力雷达图体系 (Competency Radar System)

### 3.1 核心评估维度
1. **听力理解 (Listening Comprehension)**：辨音敏锐度、连读捕捉、长难篇章主旨概括。
2. **口语表达 (Spoken Fluency & Pronunciation)**：发音标准度 (PR)、语流连贯 (FC)、语调与抑扬顿挫。
3. **词汇掌控 (Vocabulary Mastery)**：词汇广度 (Volume)、深度 (Collocation/Idioms)、产出型词汇比率。
4. **语法架构 (Grammatical Accuracy & Range)**：时态语态正确率、复杂复合句使用率 (GRA)。
5. **阅读提炼 (Reading & Analytical Skills)**：短文阅读速度 (WPM)、推理判断、细节定位。
6. **地道书面写作 (Writing & Pragmatics)**：篇章连贯性 (Cohesion)、学术/商务地道性、中式英语规避率。

---

## 4. AI 智能安全风控与内容合规网关 (AI Safety & Compliance)

### 4.1 中国大陆合规双审机制
```
+-----------------------+     +------------------------+     +------------------------+
| 1. 前置输入敏感词过滤  | --> | 2. LLM 推理与提示词锚定 | --> | 3. 后置敏感与生成物核验 |
| (网络安全法/少儿保护)  |     | (严格限制于教研知识库) |     | (网信办深度合成标识)   |
+-----------------------+     +------------------------+     +------------------------+
```
- **提示词防注入 (Prompt Injection Defense)**：在 System Prompt 头部注入不可违抗的隔离指令。
- **可回放与确定性追溯 (Explainable & Auditable AI)**：
  - 任何涉及语法诊断、判分依据的 AI 输出，均在数据库保存完整的 `prompt_version`, `model_name`, `input_hash`, `structured_output_json`，支持一键调取回放与专家复审。

---

## 5. 多端落地与 API 契约设计 (Multi-Platform Specs & API Contracts)

### 5.1 多端架构定位矩阵
| 终端类型 | 框架技术 | 核心承载功能与交互 |
| :--- | :--- | :--- |
| **微信小程序** | uni-app (Vue3) 条件编译 | 碎片化刷词、每日打卡、音标实验室、战队排行榜、轻量跟读。 |
| **移动端 App (iOS/Android/iPad)** | uni-app 原生渲染编译（见 ADR-0004） | WebRTC 实时卡通/外教数字人 1v1 通话、机考听说高保真录音、离线课件包。 |
| **PC Learner Web** | uni-app H5 编译（SEO 需求高时用 Nuxt 3） | 沉浸式长难句 X 光机交互、高考/考研/雅思全真模考大屏、学术论文与手译本。 |
| **Admin Web 中台** | Vue 3 + Vite + Element Plus | 教研题库录入与教材版本分发、AI Prompt 版本热更新、风控日志监控。 |

### 5.2 核心 RESTful / WebSocket API 契约示例
```yaml
openapi: 3.0.3
info:
  title: EnglishFlow Core Services API
  version: 2.0.0
paths:
  /api/v1/learning/today-tasks:
    get:
      summary: 获取今日自适应学习任务链
      security:
        - BearerAuth: []
      responses:
        ''200'':
          content:
            application/json:
              schema:
                type: object
                properties:
                  userId: { type: string }
                  phase: { type: string, enum: [phase1, phase2, phase3] }
                  tasks:
                    type: array
                    items:
                      type: object
                      properties:
                        taskId: { type: string }
                        type: { type: string, enum: [vocab_review, textbook_lesson, syntax_xray, ai_dialogue, exam_mock] }
                        title: { type: string }
                        estimatedMinutes: { type: integer }
                        isCompleted: { type: boolean }

  /api/v1/ai/syntax-xray:
    post:
      summary: 长难句 X 光机智能分析
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [sentence]
              properties:
                sentence: { type: string }
                level: { type: string, enum: [junior, highschool, college, advanced] }
      responses:
        ''200'':
          description: 成功返回结构化句法树与图谱拆解

  /api/v1/ai/writing-elevate:
    post:
      summary: 读后续写 / 大小作文三阶升格批改
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [essayType, text]
              properties:
                essayType: { type: string, enum: [gaokao_continuation, cet6, kaoyan, ielts_task2] }
                promptContext: { type: string }
                text: { type: string }
      responses:
        ''200'':
          description: 成功返回三阶词句升格、逻辑断层诊断与评分报告
```

