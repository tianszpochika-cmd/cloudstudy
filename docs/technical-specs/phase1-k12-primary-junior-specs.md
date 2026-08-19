# Phase 1：K12 中小学启蒙与教材同步体系 —— 技术规格说明书 (Technical Specs)

> **对应 PRD 章节**：第 2 章 (Phase 1: Primary & Junior High)  
> **核心定位**：小学 1 年级至初中 3 年级学生，以及零基础英语启蒙群体。  
> **设计目标**：建立发音标准、教材强同步、高趣味沉浸与安全护航的学习闭环。

---

## 1. 基础音标与自然拼读体系 (Phonics & Phonetics)

### 1.1 48 个国际音标发音实验室 (Phonetics Lab)
#### 1.1.1 详细功能点
- **3D 口腔发音解剖可视化**：
  - 支持 **Three.js (Web/App)** 与 **Canvas 渲染**，精确展示舌位高低（High/Mid/Low）、舌位前后（Front/Central/Back）、唇形圆展（Rounded/Unrounded）及气流振动路径（声带振动动画）。
  - 支持 360° 旋转观察、剖面透明度滑动调节、慢速播放（0.5x / 0.75x）。
- **音素级（Phoneme-level）AI 录音评测**：
  - 采集 16kHz/16bit 单声道 PCM 音频，分片上传至语音评测服务。
  - 输出多维评测指标：音素发音准确度 (Accuracy 0-100)、流利度 (Fluency)、完整度 (Integrity)、重音与语调得分 (Pitch & Stress Contour)。
  - 对错音素标红高亮并给出中文口型纠正建议（例如：“/θ/ 音发成了 /s/，注意舌尖需轻触上下齿之间并轻轻吐气”）。

#### 1.1.2 技术实现与数据 Schema
```typescript
// 音素评测请求与响应契约
export interface PhonemeAssessmentRequest {
  targetPhoneme: string;          // 目标音标，如 "/i:/"
  targetWord?: string;            // 示例单词，如 "sheep"
  audioBase64: string;            // 用户录音音频 (PCM/WAV)
  audioFormat: ''wav'' | ''pcm'' | ''mp3'';
  sampleRate: number;             // 16000
}

export interface PhonemeAssessmentResponse {
  overallScore: number;           // 综合得分 (0-100)
  accuracyScore: number;          // 准确度
  fluencyScore: number;           // 流利度
  isCorrect: boolean;             // 是否达标 (默认 >= 75)
  details: {
    phoneme: string;
    score: number;
    issueType?: ''tongue_position'' | ''lip_shape'' | ''voicing'' | ''airflow'';
    diagnosisMessage: string;    // 诊断提示
  }[];
  mouthCorrectionGuide: {
    tongueHeight: string;         // "high"
    tongueBackness: string;       // "front"
    lipShape: string;             // "spread"
  };
}
```

---

### 1.2 Phonics 自然拼读法则树 (Phonics Rule Tree)
#### 1.2.1 详细功能点
- **拼读规则体系拆解**：
  - **Level 1**：26 个字母单个发音与元音短音 (Short Vowels: a, e, i, o, u)。
  - **Level 2**：辅音丛与双辅音 (Blends & Digraphs: bl, cl, sh, ch, th, ph, wh)。
  - **Level 3**：长元音与魔术 ''e'' (Silent e / Magic e: a_e, i_e, o_e, u_e)。
  - **Level 4**：元音字母组合与双元音 (Vowel Teams & Diphthongs: ai, ay, ee, ea, oa, ou, ow, oi, oy)。
  - **Level 5**：R 控制元音与音节切分 (R-controlled: ar, er, ir, or, ur; Syllabication)。
- **Sight Words 220 词高频词库**：
  - 提供闪卡模式、听音辨词、快速打地鼠识别游戏，强化不符合拼读规则的视觉词记忆。
- **“见词能读、听音能写”训练引擎**：
  - 动态拆词音节算法：输入单词自动切分为音素块（如 `c-a-t`, `sh-i-p`, `n-i-ght`），提供按音素拼接发音与拖拽拼装。

---

## 2. 主流教材逐课同步体系 (Textbook Sync Framework)

### 2.1 教材覆盖与结构化数据索引
- **覆盖版本**：人教版 PEP (Primary & Junior)、外研社版 (NSE)、牛津上海版、北京版、译林版、冀教版、鲁教版。
- **分层目录树**：`Edition (版本) -> Grade (年级 1-9) -> Semester (上/下册) -> Unit (单元) -> Lesson/Period (课时)`。

### 2.2 逐课四维学习闭环 (4-Step Learning Cycle)
1. **Step 1: 课前单词预习 (Pre-Lesson Vocabulary)**
   - 单词卡片（中英文、标准英/美音、高清配图、例句点读）。
   - 连线与拼写小测，生成预习掌握度。
2. **Step 2: 课文跟读与角色扮演 (Role-Playing & Dialogue Shadowing)**
   - 课文原版逐句高亮点读，多角色人声朗读。
   - 用户选择角色录音配音，AI 逐句打分，合成完整的趣味对话作品并支持分享。
3. **Step 3: 核心语法与重点句型 (Grammar & Sentence Breakdown)**
   - 针对本课核心句型（如 "What is your name?", "There is / There are"）进行组件式拆解。
   - 动态填空与造句互动。
4. **Step 4: 课后同步自测小考 (Unit Quiz & Mastery Audit)**
   - 听力选择、单词辨音、单项填空、句型转换。
   - 自动生成本单元掌握度报告，未达标知识点自动推入复习错题流。

---

## 3. 卡通 AI 数字人实时伴学系统 (Cartoon AI Companion)

### 3.1 角色与人设管理矩阵
| 形象名称 | 英文名 | 人设特点 | 适用场景与受众 |
| :--- | :--- | :--- | :--- |
| **魔法猫咪** | Mimi | 活泼热情、喜欢发问、语速较慢、充满夸奖鼓励 | 小学 1-3 年级启蒙、日常趣味口语互动 |
| **活力机器人** | Bolt | 逻辑清晰、喜欢科技游戏与挑战、发音标准精确 | 小学 4-6 年级、自然拼读与闯关游戏 |
| **智慧鹿老师** | Dr. Deer | 温柔儒雅、教研功底扎实、擅长语法引导与纠错 | 初中 1-3 年级、课文同步与知识点答疑 |

### 3.2 实时语音通话架构 (<800ms)
- **协议**：WebRTC DataChannel + AudioTrack。
- **打断机制 (Barge-in)**：客户端或服务端检测到用户说话能量阈值（VAD Triggered），立即通过 WebRTC 向媒体服务器发送 `STOP_SPEAKING` 指令，中断当前 TTS 流与动画播放，清空客户端音频播放缓冲。
- **少儿安全过滤 (Child Safety)**：
  - 注入前置 Guardrail 规则：仅允许探讨教材知识、少儿日常趣事、科学常识与文明用语。
  - 拦截并安全引导任何超纲、敏感或不良内容。

---

## 4. 趣味化学习游戏引擎 (Learning Games Engine)

采用轻量化跨端游戏引擎架构（Canvas 2D / Pixi.js / Lottie），支持小程序与 App 极速加载。

| 游戏模式 | 游戏机制 | 学习内核 | 结算与激励机制 |
| :--- | :--- | :--- | :--- |
| **单词保卫战 (Tower Defense)** | 怪兽沿路径进攻，玩家拼写正确单词激活不同属性的防御塔发射子弹防御。 | 快速单词拼写与词义反应能力。 | 奖励通关金币、战队能量点与新防御塔皮肤。 |
| **自然拼读消消乐 (Phonics Match)** | 屏幕上方掉落音素与词根方块（如 /æ/ 与 cat, bat），相邻配对即可消除。 | 音标与字母组合拼读规则辨别。 | 连消 Combo 加分，解锁高阶音标图鉴。 |
| **句子拼装小火车 (Sentence Train)** | 屏幕呈现混乱的单词车厢，学生按语法逻辑（主-谓-宾-状）拖拽组装成通顺句子。 | 语序结构与固定搭配掌握。 | 火车准点发车动画，获得“小小铁道工程师”成就。 |
| **冒险大富翁 (Monopoly English)** | 掷骰子在地图上前进，停留在地块触发“商店购物问答”、“问路指引”等情景口语关卡。 | 场景情境英语与即兴对话能力。 | 收集城市勋章与道具卡。 |

---

## 5. 班级与小组协同学习体系 (Class & Squad Collaboration)

### 5.1 学习战队机制 (Study Squads)
- **战队规模**：每队 3-6 名学员。
- **共享能量树 (Energy Tree)**：每个成员完成每日打卡或单元测验，为战队能量树注入养分，满级可兑换专属徽章与个性化装扮。
- **战队互助**：组内成员可一键“一键提醒队员打卡”、“赠送鼓励贴纸”。

### 5.2 战队周考与排位天梯 (Weekly Ladder Challenge)
- **周考匹配机制**：每周五至周日开放组间答题 PK（实时 WebSocket 匹配或异步擂台模式）。
- **题型与防作弊**：全真同步本周所学教材单元，随机打乱选项顺序与题目参数，倒计时抢答机制。

### 5.3 数据库模型设计 (Data Models)
```sql
-- 学习战队表
CREATE TABLE squads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL,
    avatar_url VARCHAR(255),
    grade_level INT NOT NULL, -- 目标年级 (1-9)
    leader_id UUID REFERENCES users(id),
    total_energy_points INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 战队成员关系表
CREATE TABLE squad_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    squad_id UUID REFERENCES squads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    weekly_contributed_points INT DEFAULT 0,
    role VARCHAR(16) DEFAULT ''member'', -- leader / member
    UNIQUE(squad_id, user_id)
);
```

