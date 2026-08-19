# Phase 2：高中与大学学术/升学突破体系 —— 技术规格说明书 (Technical Specs)

> **对应 PRD 章节**：第 3 章 (Phase 2: High School & College)  
> **核心定位**：高中生、高考冲刺生、非英语专业与英语专业大学生、考研党及学术研究者。  
> **设计目标**：精准突破长难句障碍、提分读后续写、攻克听说机考全真模考、手译研读真题与多场景思辨面试。

---

## 1. 减压与抗焦虑学习体验 (Anti-Anxiety Experience)

### 1.1 番茄微课架构 (Pomodoro Micro-Lessons)
- **切片规则**：将高考/考研庞杂考点（如虚拟语气、独立主格、倒装句、从句套从句）切分为 5-8 分钟高能微课。
- **阶段结构**：`1 min 考点痛点痛击 -> 3 min 图解核心机理 -> 2 min 极速真题实战 -> 1 min 考点秒杀口诀`。

### 1.2 极简暗黑与无干扰专注模式 (Dark Minimalist Mode)
- **视觉规格**：遵循 WCAG AAA 护眼对比度规范（背景色 `#0F172A`，前景色 `#F8FAFC`，主强调色 `#38BDF8`），彻底关闭非必要弹窗与社交红点。
- **剧情式逆袭挑战 (Story-driven Quest)**：将高考历年单选与阅读真题编排为“侦探破解谜案”、“密室逃脱密码线索”等主线剧情关卡。

### 1.3 AI 考前心理疏导伴练 (AI Emotional Support Companion)
- 基于认知行为疗法 (CBT) 原则设计温和鼓励提示词，提供双语自适应语音安慰，疏导考前焦虑情绪。

---

## 2. 动态语法图谱与长难句 X 光机 (Syntax X-Ray & Graph)

### 2.1 长难句即时结构拆解引擎
- **句法分析算法**：集成基于 SpaCy / Berkeley Neural Parser 的句法依存分析模型，结合大语言模型进行高精度树形结构生成与中文语序重构。
- **可视化分层高亮**：
  - **主干层**：[主语 Subject] - [谓语 Verb] - [宾语/表语 Object/Predicative]（黄色粗体）。
  - **修饰层**：定语从句 (绿色线框)、状语从句 (蓝色线框)、同位语从句 (紫色线框)。
  - **特殊结构**：插入语 (灰色斜体)、非谓语动词短语 (粉色高亮)、倒装标记 (箭头指示)。

```json
// 长难句拆解数据 Schema
{
  "rawSentence": "The fact that people who have not mastered the essential skills of modern technology are often left behind in the job market demonstrates the vital importance of continuous lifelong learning.",
  "coreTrunk": {
    "subject": "The fact",
    "verb": "demonstrates",
    "object": "the vital importance of continuous lifelong learning"
  },
  "clauses": [
    {
      "type": "Appositive_Clause",
      "text": "that people who have not mastered the essential skills of modern technology are often left behind in the job market",
      "modifies": "The fact",
      "subClauses": [
        {
          "type": "Relative_Clause",
          "text": "who have not mastered the essential skills of modern technology",
          "modifies": "people"
        }
      ]
    }
  ],
  "chineseTranslationStepByStep": [
    "1. 核心主干：事实表明了持续终身学习的极端重要性。",
    "2. 补充事实内容：那些未能掌握现代技术基本技能的人往往会在就业市场中被淘汰。",
    "3. 完整通顺译文：那些未能掌握现代科技必备技能的人往往会在就业市场中被淘汰，这一事实充分表明了持续进行终身学习的至关重要性。"
  ]
}
```

---

## 3. 高考提分与真题模考引擎 (Gaokao Booster & Mock Exam)

### 3.1 读后续写 AI 升格导师 (Continuation Writing Coach)
#### 3.1.1 核心批改维度
1. **情节连贯性与逻辑契合度 (Plot Coherence & Consistency)**：分析两段续写与前文线索（Clues）的呼应情况，标出逻辑断层。
2. **三阶词句升格体系 (3-Tier Elevation)**：
   - *Level 1 (基础达意)*：`He was very afraid and started to cry.`
   - *Level 2 (进阶生动)*：`Fear overwhelmed him, and tears streamed down his cheeks.`
   - *Level 3 (高考满分地道)*：`Seized by a paralyzing surge of panic, he found himself teetering on the verge of tears, his knuckles turning white.`
3. **高级句式智能注入建议**：智能推荐何处适合替换为“独立主格结构”、“with复合结构”、“分词作伴随状语”或“倒装句”。

---

### 3.2 高考听说各省机考全真模考系统 (Speaking & Listening Computer-based Test)
- **多省份题型与评分规则引擎**：
  - **广东高考英语听说**：Part A 模仿朗读 (Reading Aloud)、Part B 三问五答 (Role-play Q&A)、Part C 故事复述 (Story Retelling)。
  - **北京/上海机考听说**：听后选择、听后回答、短文朗读与话题表达。
- **毫秒级全真倒计时与录音上传控制**：
  - 严格限制准备时间（如 40 秒准备，90 秒录音），倒计时结束自动切断麦克风并上传音频。
  - 评测引擎执行全真标准机评算法，输出精准模考总分与各小题细分诊断。

---

## 4. 大学学术与考研突破体系 (College & Postgraduate)

### 4.1 四六级真题倍速听力精听手账 (CET-4/6 Precision Listening)
- **音频变速引擎**：基于 Web Audio API 实现 0.5x 至 2.0x 无损音频变速（保调不变音，Pitch Preservation）。
- **挖空精听与波形定位**：
  - 针对连读（Linking）、弱读（Weak forms）、失去爆破（Incomplete plosive）处自动挖空。
  - 呈现交互式音频波形图，支持单句循环、A-B 选段复读。

### 4.2 考研英语真题手译本 (Kaoyan Translation Notebook)
- **逐句英汉手译对比**：
  - 用户在输入框手写翻译，系统自动与考研命题组官方采分点（Scoring Points）进行语义比对。
  - 标出漏译、错译、死译与语序混乱点，并给出专有名词及长难句精准得分。

### 4.3 考研复试英语面试与学术前沿模拟 (Postgrad Interview Simulator)
- **专业方向题库覆盖**：计算机科学、经管金融、生化医药、人文社科、工科工程等 12 大门类。
- **面试流程闭环**：
  - `1. 自我介绍诊断 (Personal Statement Pitch)`
  - `2. 报考动机与学术规划追问 (Motivation & Future Plans)`
  - `3. 核心专业英语问题即兴问答 (Professional Domain Q&A)`
  - `4. 综合语言逻辑与学术素养打分报告`

### 4.4 学术论文 / SCI 英文润色助手 (Academic Writing Polisher)
- **学术风格修正引擎**：
  - 检测并消除非正式用语（如 replace `a lot of` with `a substantial number of`）。
  - 强化客观语态（Passive Voice 优化）与逻辑连接词（Furthermore, In contrast, Consequently）。
  - 支持 **Overleaf / LaTeX / Markdown** 格式即时一键导出与差异 Diff 呈现。

### 4.5 外企 STAR 法则面试官 (STAR Behavioral Interviewer)
- 遵循 **S**ituation (情境) -> **T**ask (任务) -> **A**ction (行动) -> **R**esult (结果) 四步追问法：
  - 针对候选人回答中的模糊表述（如 "I helped the team a lot"），AI 考官实时追问："What specific metric did you improve, and what role did you play in that action?"。

### 4.6 AI 英语辩论竞技场 (AI Debate Arena)
- **回合制攻防规则 (Turn-based Debate Engine)**：
  - 支持“自由选择持方（Affirmative / Negative）”。
  - 辩论流程：立论 (Opening Statement 2 min) -> 质询反驳 (Cross-examination & Rebuttal 3 min) -> 总结陈词 (Closing Statement 2 min)。
  - 裁判系统从“论证逻辑深度 (Logic)"、“语言说服力 (Rhetorical Force)"、“反驳针对性 (Responsiveness)" 三个维度实时判定胜负。

