# MB006 正式 H5 改前基线（2026-10-16）

状态：`BEFORE_CAPTURED / SYNTHETIC_UI_ONLY`。仅采集原正式 uni-app 组件，未改正式源码、共享文件、Git、主进度或 CHANGELOG。不是后端业务链、R1、native 或发布签收。

环境：`http://127.0.0.1:18183/#/pages/assessment/assessment`，Playwright Chromium 1.63.0，390×844，reduced motion。Browser plugin 及 browser 技能未提供，因此按 frontend-testing-debugging 技能采用已有 Playwright fallback。Root 原服务已结束；Root 重新启动固定 strictPort 服务 session94632，监听 127.0.0.1:18183 / PID32992，进程只读快照见 `service-owner.json`；本子任务没有启动、停止或重启服务。

本组前官方额度实读 64% / 周 41%，ordinaryUsageAllowed=true，未触发 90% 停止线，未使用重置券。开始前另有 57% / 周 40% 的官方实读。

## 路径与 fixture 来源

流程：真实登录页填写专用合成账号 → 正常 returnTo/页面 guard → 正式 assessment 引导 → 点击开始 → 真实选项按钮选择 → 真实提交按钮连走 10 次 → 正式 ASSESSED 报告分支。另用独立 context 走英文暗色引导、开始请求 503 错误。

- `capture.cjs` 使用现有 `mobile-forbidden/20261016-independent/final-0342/candidate4/fixture.cjs` 的隔离 context 与传输拦截模式，以及 `apps/mobile/tests/ui-onboarding.e2e.cjs` 的正常登录 UI、IAM adult/consent/target fixture shape。页面题目/检查点/报告 shape 按当前 `api/learner-content.ts` 的解析器构造，纯合成、非真实题库。
- `context.route('**/*')` 拦截每个 `/api/v1/` 请求并 fulfil（包括 IAM 直连 origin 的 API），仅固定 18183 的非 API 资源允许继续，其他外部资源 abort。未知 API 返回 501 并单列 `unexpected`，没有放行至真实后端。结果中的请求日志只含 method/origin/path，不含 body/header/token/cookie。
- 合成 IAM 事实为 PASSED、ELIGIBLE、已同意，target 已保存；保持真实 guard 和权限流程。没有读取真实账号、浏览器 Cookie/storage、请求 body/header；没有替换组件/DOM/store 方法、注入登录状态或写服务端数据。
- 题序及 stateVersion 随 10 次实际按钮提交依次递增。最终 A2/70 分/7 正确来自合成 finalResult；不是客户端判分，也不是业务 PASS。正式报告后现有 store 发出一次合成拦截的 plans:ensure，并读 learning/today。
- 未做 SKIPPED：当前正式页无正常 skip 写入口，且读取解析受 reportId 约束；没有编造 reportId 来获得 SKIPPED 报告。

## 实际截图与观察

| 图 | 已发生的真实页面动作/状态 | 观察 |
|---|---|---|
| `01-guide-zh-light-390.png` | 正常登录返回 assessment，引导已显示，start=0 | 页头“从了解自己开始。”与卡内“开始定级”占据两层大标题；主按钮只写“开始”。 |
| `02-answer-selected-zh-light-390.png` | 点击开始 POST=1，点击 A，正式 option.selected=1 | 题干明显但文字较多时首屏较长；选项为 14px。主提交按钮位于 390×844 首屏底缘，底部被视口裁到，须滚动完整看到。四选项都有可点击语义，但选中项无 aria-pressed（实际 DOM 为 null）及可读“已选”文本，仅色/边框区别。 |
| `03-assessed-report-zh-light-390.png` | 1 次开始、10 次 responses、1 次 plans:ensure | 正式报告分支显示 A2·70分及 7/10；“报告和快照同一版本”技术措辞直接展示。计数、上一题反馈和重测说明各自变为描边块，视觉权重近似操作区。 |
| `04-guide-en-dark-390.png` | 新 context 正常登录，实际 en-US/dark | 页头、返回已变英文；引导正文、卡标题、按钮仍为中文，混排已实际复现。 |
| `05-start-error-503-zh-light-390.png` | 新 context 正常点击开始，合成 503 | 正式错误分支显示“测评暂时不可用，请稍后重试。”并给“重新读取”和回首页；标题仍为“开始定级”。 |

五图均经 view_image 实际查看。以上为当前视口实际观察；快速开始缺口、重测确认/失败显示、请求迟到、忙碌换选项、进度表达等仍仅是预审中的源码关切，本轮未实测，不列为浏览器 FAIL。

## 验证与证据边界

| 检查 | 实际结果 |
|---|---|
| 页面身份 / 非空 | 五态均为正式 `#/pages/assessment/assessment`，document title“规则化测评”，具有真实卡片内容 |
| 错误遮罩 / 水平溢出 | 五态均无 vite-error-overlay、无水平溢出 |
| 页面异常 | pageerror=0；503 场景的 HTTP console error 属于本次明确注入的失败，其他 app error 见 results 原件 |
| 交互 | 真实开始/选 A/逐题提交 10 次抵达报告；未跳过至终态、未注入 store |
| 源稳定 | `results.json` 保存六个相关源的 before/after SHA256，sourceStable=true；页原始 SHA256=`30cfa42c97c3fcd3923ac1309f3786fd2a1cf57c9e0d996bd897073429a86598`；原始字节另存 `assessment.before.vue.txt` |
| 未测 | SKIPPED、其他错误/race、宽度/主题矩阵、键盘/200%文本、真实 IAM/Gateway/owner DB、native/实体设备 |

产物：`capture.cjs`、`results.json`、`service-owner.json`、原页字节副本、五张 PNG。所有 browser/context 已关闭，无 inflight；本子任务没有改主文档或正式源码。此材料供后续 MB006 重设计对比，不是 UI 通过签收。
