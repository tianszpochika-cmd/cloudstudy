# Phase 3：职场商务、出海实战与留学考培 —— 技术规格说明书 (Technical Specs)

> **对应 PRD 章节**：第 4 章 (Phase 3: Career & Study Abroad)  
> **核心定位**：外企白领、跨境出海业务拓展人员、涉外商务谈判人员、雅思 (IELTS) / 托福 (TOEFL) 考生。  
> **设计目标**：打破职场“哑巴英语”、掌握跨境商务谈判博弈技巧、沉浸式通关海外生存考验并实现留学机考高分突破。

---

## 1. 职场与跨国商务实战体系 (Business English & Global Ops)

### 1.1 全场景跨国商务会议模拟系统 (Global Meeting Simulator)
#### 1.1.1 详细功能点
- **多口音多角色实时混流**：
  - 模拟 4-6 人跨国视频/电话会议房间。
  - 支持多国口音 TTS 实时合成：美式英语 (US Accent)、英式英语 (UK Accent)、印度口音 (Indian English)、新加坡口音 (Singlish)、澳洲口音 (Australian)。
- **会议核心环节实战**：
  - **开场破冰 (Ice-breaking & Agenda Setting)**
  - **项目进度汇报 (Sprint & KPI Presentation)**
  - **异议答辩与即兴提问 (Q&A Handling & Pushback)**
  - **会议纪要与行动项收尾 (Action Items & Wrap-up)**
- **实时会议助理 (Live Meeting Copilot)**：
  - 在用户发言卡壳时，屏幕右侧即时弹出 3 条不同语气的推荐提点短语（Bulleted Talking Points）。

---

### 1.2 跨境商务谈判沙盒 (Cross-Border Negotiation Sandbox)
#### 1.2.1 谈判博弈状态机 (Negotiation State Machine)
- **核心场景覆盖**：
  - **价格与阶梯折扣博弈 (Price & Tiered Discount)**
  - **交期延误与违约赔偿 (Lead Time & Penalty Clause)**
  - **账期与信用证结算 (Payment Terms: Net 30/60, L/C at sight)**
  - **独家代理权与经销范围争夺 (Exclusive Distribution Rights)**
- **动态说服力与情绪反馈引擎 (Persuasion & Emotion Engine)**：
  - 实时评估用户的“谈判策略用词”、“底线守护程度”、“商业礼仪与坚定度”。
  - 模拟买家/卖家角色的动态满意度条（Satisfaction Index 0-100%）与接受概率。

```typescript
// 谈判沙盒状态与评分接口
export interface NegotiationTurnState {
  currentRound: number;
  userStatement: string;
  opponentRole: ''Foreign_Buyer'' | ''OEM_Supplier'' | ''Distributor'';
  persuasionScore: number;           // 本轮说服力 (0-100)
  opponentSatisfactionChange: number;// 对手满意度变化值 (-20 ~ +20)
  opponentTensionLevel: ''Low'' | ''Medium'' | ''High'' | ''Hostile'';
  tacticalAnalysis: {
    strengths: string[];             // 亮点：如使用了 Anchor Pricing 锚定法
    weaknesses: string[];            // 漏洞：如轻易承诺了免费打样
    suggestedRephrasing: string;     // 推荐更具说服力的表达
  };
  opponentCounterOffer: string;      // 对手下一轮还盘或回应
}
```

---

### 1.3 商务邮件与即时通讯润色插件 (Business Email & IM Polisher)
- **四维语气一键重写**：
  - **Formal (严谨正式)**：适用于董事会报告、法律声明、正式商业报价。
  - **Diplomatic / Polite (委婉委婉)**：适用于婉拒需求、催促款项、指出对方差错。
  - **Firm / Assertive (坚定有力)**：适用于底线坚持、违约索赔、明确截止期限。
  - **Concise / Punchy (简明扼要)**：适用于 Slack/Teams 即时消息、移动端快速回复。

---

### 1.4 行业垂直术语与专业知识库 (Vertical Industry Lexicon)
- **涵盖领域**：
  1. **跨境电商与独立站** (Amazon/Shopify, CPC, ROAS, FBA, Chargeback)
  2. **传统外贸与供应链** (Incoterms 2020: FOB, CIF, DDP; Bill of Lading, Customs Clearance)
  3. **科技金融与投融资** (Fintech, Due Diligence, Term Sheet, Cap Table, Seed Round)
  4. **跨国物流与航运** (TEU, Demurrage, Air Waybill, Port of Discharge)

---

## 2. 海外生存与文化沉浸沙盒 (Abroad Survival & Culture Sandbox)

### 2.1 全真海外生存场景模拟 (Survival Simulation)
- **8 大高频突发场景**：
  1. **海关盘问与入境审查 (Immigration & Customs Check)**
  2. **租房签约与押金纠纷 (Leasing Agreement & Deposit Disputes)**
  3. **就医急诊与医保理赔 (Emergency Room & Health Insurance)**
  4. **银行开户与税务申报 (Bank Account Opening & SSN/Tax)**
  5. **警察盘查与突发报案 (Police Encounter & 911 Reporting)**
  6. **租车事故与保险申报 (Car Rental & Roadside Assistance)**
  7. **餐厅就餐与小费文化 (Dining, Dietary Restrictions & Tipping)**
  8. **社交派对破冰 (Small Talk & House Party Networking)**

### 2.2 跨文化交际避坑指南 (Cross-Cultural Communication)
- **禁忌与潜规则预警**：实时诊断中国大陆学习者易犯的跨文化误区（如过度追问隐私年龄/薪资、误解西方 "How are you" 的礼貌边界等）。

---

## 3. 雅思/托福留学高分冲刺引擎 (IELTS & TOEFL Prep Suite)

### 3.1 当季口语换题库实时更新 (Live Speaking Question Bank)
- **换题季同步更新机制**：每年 1月、5月、9月 雅思换题季以及托福月度机经高频更新。
- **Part 1 / Part 2 / Part 3 全流程模考**：
  - Part 2 严格 1 分钟草稿准备倒计时 + 2 分钟不间断陈述录音。
  - Part 3 深度追问：AI 考官根据 Part 2 陈述内容发起多轮高阶抽象思辨探讨。

### 3.2 官方评分标准四维深度诊断 (Official Rubrics Diagnosis)
| 诊断维度 | 核心检测指标 | AI 评分算法依据 |
| :--- | :--- | :--- |
| **流利性与连贯性 (FC)** | 语速 (Words per min)、停顿频率、无意义重复 (Uh/Um)、逻辑连接词多样性。 | 语音波形与停顿静音检测算法 + 语法树关联分析。 |
| **词汇多样性 (LR)** | 雅思 C1/C2 级高级词汇占比、地道搭配 (Collocations)、同义替换灵活性。 | 词频矩阵比对与 CEFR 词库映射 (B2/C1/C2)。 |
| **语法多样性与准确性 (GRA)** | 复合从句比例、虚拟语气/倒装句使用、时态一致性、三单与单复数错误率。 | 依存句法树分析与神经句法纠错引擎。 |
| **发音与语调 (PR)** | 音素发音准确度、重音节奏 (Stress-timing)、连读弱读、语调起伏 (Intonation)。 | 音素级 ASR 对齐与基频 (F0 Contour) 声调分析。 |

### 3.3 大小作文智能批改与地道重写 (Task 1 & Task 2 Essay Grader)
- **Task 1 (图表/综合写作)**：数据趋势总结是否精准、极值与对比是否遗漏、结构是否严密。
- **Task 2 (大作文议论文)**：
  - **论点明确性与审题契合度 (Task Response)**
  - **段落逻辑链条与论据深度 (Coherence & Cohesion)**
  - **中式英语 (Chinglish) 重写对照**：逐句保留原文论点，给出母语级地道表达替换方案。

