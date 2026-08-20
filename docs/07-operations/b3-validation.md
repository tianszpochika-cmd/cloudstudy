# B3 独立验证说明

本文档对应 `DEV-06-001~009`、`DEV-07-001~012`、`DEV-09-009` 和 `DEV-12-007`。B3 已完成规则/API、跨端练习交互、离线队列、Core API memory/JDBC 持久化边界和口语角色扮演入口的可运行基线；仍登记为“待验收”，因为真实 MySQL/Redis/S3、授权媒体和设备弱网证据尚未具备。

## 已交付边界

- 契约与事件：B3 详细 OpenAPI 已合并为 172 operations、184 schemas；事件目录为 43 个版本化事件及 payload schema。写入操作声明 `Idempotency-Key`，原始答案、音频字节和 AI 分数不进入事件。
- 数据与服务：V0012 补齐语法陷阱/练习/掌握、句子 token/slice/audio track、写作模板/材料/改错、Language Clips/离线包、阅读词典/题目、音标最小对、跟读/角色扮演和录音分段表。`B3RuleEngine` 固定 `B3-RULE-1` 与 `SOUND-CHANGE-RULES-1`；服务端具备内容版本闸门、请求体指纹幂等、服务端权威答题、录音哈希边界和 `MEDIA_NOT_READY` 安全失败。
- 持久化边界：Core API 已补齐 JDBC、MySQL、Redis 运行依赖和 `B3DurableRepository`；默认 `B3_PERSISTENCE_MODE=memory` 关闭外部自动配置，便于本地规则回放；`B3_PERSISTENCE_MODE=jdbc` 使用 V0012 表保存练习、阅读进度、录音、自评、离线变更和 cursor。跨实例幂等锁、内容查询和 outbox 消费仍需真实基础设施回放。
- Web：语法 DAG/SVG 降级图、可拖拽/箭头排序积木、仿写槽位、写作改错/历史、听力倍速/循环/A-B/盲听/位置保存、阅读词典/表达挖掘/理解题、48 音标口型参数、MediaRecorder AES-GCM-256/SHA-256、自评、500ms 影子跟读和服务端脚本角色扮演均接入服务端 API。
- Mobile：uni-app 页面已补齐语法积木/仿写、听力原生音频适配入口、阅读理解/表达挖掘、真实录音文件 SHA-256 登记/回放/自评和角色扮演入口；设备无能力或媒体无授权时明确显示未确认状态，原生 Keychain/Keystore 仍通过适配器边界接入。
- 离线：Web localStorage 与 Mobile storage adapter 均为 schema v2，支持 v1 迁移、cursor、PENDING/SYNCING/FAILED 状态和安全文本哈希；Web 新增 IndexedDB/内存媒体下载器，支持 Range 断点、长度、SHA-256、过期和失败清理。

## 已执行验证

```text
node --test tests/b3/*.test.mjs
```

结果：17 tests、17 pass、0 fail。

```text
node node_modules/.pnpm/vue-tsc@2.2.12_typescript@5.9.3/node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p apps/learner-web/tsconfig.json
node node_modules/.pnpm/vue-tsc@2.2.12_typescript@5.9.3/node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p apps/mobile/tsconfig.json
node node_modules/vite/bin/vite.js build                 # apps/learner-web
node node_modules/vite/bin/vite.js build                 # apps/mobile，uni-app H5
node scripts/database/validate-migrations.mjs
node scripts/database/validate-fixtures.mjs
node scripts/contracts/validate-contracts.mjs
```

以上 Web/mobile TypeScript、Web 生产构建、uni-app H5 构建、契约/fixture/迁移校验均通过。Core API Maven `test` 通过：11 tests、0 failures，包含 10 项 B3 service 单测和 1 项 Spring Boot memory 上下文测试。

本地运行态 smoke：Learner Web preview 在 `127.0.0.1:18190` 欢迎页可加载；直接访问 `/listening` 显示身份契约未接入的登录保护页，未伪造登录或媒体授权。停止预览进程后，固定端口检查全绿。全仓 Node 静态回归为 77 tests、74 pass、0 fail、3 TODO；TODO 均为真实基础设施、浏览器和运行态集成。

## 待外部环境验收

- MySQL/Redis：执行 V0012，验证 JDBC 适配器真实写入、V0002 幂等锁、离线 cursor/版本向量、受保护答案策略和多实例一致性；当前仍未连接真实服务。
- MinIO/S3：装载授权音频、波形与 2D 口型资源，验证签名 URL、Range、撤权、manifest checksum、过期和空间不足恢复；媒体未挂载时 Core API 必须继续返回 `MEDIA_NOT_READY`，不返回伪造 206。
- 端到端：浏览器、H5、iOS、Android、iPad、微信小程序弱网/断网、刷新恢复、录音权限、真实播放和四档性能降级仍需设备证据。
- 隐私媒体：Web 已使用 Web Crypto AES-GCM-256 与不落盘密钥的内存仓，只登记真实哈希和生命周期元数据；Mobile 已定义 Keychain/Keystore 原生加密适配器边界，但仍需真机接入、分段上传和生命周期清理验收。
- 组件标准：当前句法图采用轻量 SVG、听力波形采用无依赖降级轨道；`Vue Flow`/`Wavesurfer.js` 依赖安装受当前 npm registry 超时影响，后续联网后可替换渲染壳，但不改变接口和安全边界。

完成以上外部项后，重新运行本文件命令并补充 HTTP 回放、媒体清单和设备截图，才能把对应任务从“待验收”改为“已完成”。
