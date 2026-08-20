# @englishflow/learner-web (语学星学员端 Web/H5 响应式)

## 项目定位
- 采用 **Vue 3 + Vite + Pinia + TypeScript** 构建。
- **响应式跨屏设计**：自适应 PC 桌面大屏（双栏/三栏工作台模式）与移动端 H5（单栏沉浸流式布局）。
- 学习者免安装即可在浏览器中完成今日学习流、单词记忆、句子听力、语法解析、复习刷题与自测。

## 目录结构
- `src/api/`: 封装后端 Core API 请求客户端
- `src/components/`:
  - `player/`: 沉浸式音频播放与波形控制器
  - `learning/`: 学习流控制器、打卡组件
  - `cards/`: 单词卡片、长难句拆解卡片
  - `quiz/`: 题型交互组件（拼写、连线、选择、填空）
- `src/layouts/`: 响应式多栏布局（PC 宽屏适配 vs 手机端底部 Tab 栏）
- `src/pages/`: 学习看板、核心学习室、艾宾浩斯复习流、错题集、个人中心
- `src/stores/`: 状态管理（当前学习进度、播放器状态、会话 Token）
