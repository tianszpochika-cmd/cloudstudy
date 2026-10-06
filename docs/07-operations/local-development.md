# 本地开发

> **dev-redesign 接手提示（2026-10-06）：本机启动与测试操作指南，非业务开发顺序。** 本分支当前任务与进度只看[迭代 2 当前进度](../06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)；本文不提供独立的开工队列，不迁移旧验收状态。

目标是用合成数据启动 Phase 1 的四个前端、15 个 v2 服务及其基础设施。运行就绪不代表业务功能全部验收；当前实测与剩余门禁见 [2026-10-06 验证记录](local-environment-verification-2026-10-06.md)。

## 工具与环境

版本以 `config/toolchain-baseline.json` 为准：Node 20.19.5、pnpm 10.19.0、Java 25、Maven ≥3.9.9、Docker ≥28、Compose ≥2.40、Chromium ≥151。支持 Windows x64、Linux x64、macOS arm64/x64；本轮实际验证 macOS arm64。`CHROME_PATH` 可以指定浏览器可执行文件，macOS 也会检测 `/Applications` 和用户 Applications 中的 Chrome。

```sh
pnpm install --frozen-lockfile
pnpm p1r:toolchain:check
pnpm p1r:ci:check
```

Docker Desktop 必须已启动。移动 H5 和 `build:app` 的 uni-app 资源构建可以先做；原生安装包、系统安全存储和设备验收另需 HBuilderX/原生打包基座、签名与对应设备工具，不能据 JS 资源构建称原生验收通过。

macOS 的 iOS 测试需要完整 Xcode，打开 Xcode 完成许可及首次组件安装并安装 iOS Simulator runtime；Command Line Tools 不足。Android 需要 command-line tools、platform-tools、SDK platform、build-tools、emulator 和 arm64（Apple Silicon）系统镜像。本轮安装 Android API 36 / build-tools 36.0.0。将 command-line tools 放在同一 SDK 的 `cmdline-tools/latest` 下，避免 avdmanager 在另一个 SDK 根目录查找镜像。

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
pnpm native:check -- --android
pnpm native:check -- --ios
```

原生检查是独立、失败即退出非零的工具检查，不替代设备测试，也不降低 Web/v2 工具链门禁。跨平台开发时只选择所在平台的原生检查。如果安装 Xcode 后系统 Git 也报许可错误，应先完成 Xcode 首次设置；不能把已有 CLT 当成 iOS 环境完成。

## 首次启动

1. 检查 `.env.example`。可复制为不提交的 `.env`，所有数据与凭证仅用于本地合成测试。Compose 会加载根目录 `.env`，Node/Maven 脚本不会自动加载；自定义变量须在终端导出。默认 Phase 1 不启动 AI、K12 或商业支付回调。
2. 在整个栈尚未启动时执行 `pnpm ports:check`。端口冲突先停止并报告占用进程，不增号、不换端口；已运行的依赖会被正常报告 BUSY。只重启单项时用 `pnpm ports:check -- --service <注册键>`。
3. 启动基础设施并等待健康：

```sh
pnpm infra:check
pnpm infra:up
docker compose -f infra/docker/docker-compose.dev.yml up -d --wait --wait-timeout 180 mysql redis minio kafka
node scripts/check-local-infra.mjs --require-healthy
# 等待/复核私有桶初始化，命令可重复运行。
docker compose -f infra/docker/docker-compose.dev.yml run --rm --no-deps minio-init
```

首次会从固定官方提交构建 MinIO 和 mc；Go 编译器在容器中，不要求本机安装 Go。下载必须通过 SHA-256 校验，基础镜像固定 digest，来源及维护约束见 [ADR-0029](../10-decisions/0029-local-object-storage-source-build.md)。Redis 的一次性初始化只在 ACL 文件不存在时创建文件，保留已有 ACL；随后必须配置服务隔离 ACL。

4. **在所有服务写入进程关闭时**准备 owner schema、Redis ACL 与 Kafka topics：

```sh
pnpm b28:owner-schemas
pnpm db:prepare:iam
pnpm redis:acl
pnpm p1r:kafka:topics -- --apply
```

`b28:owner-schemas` 是现有本地管理脚本，会重新配置 owner 用户/权限并应用声明的迁移；不要在运行中的栈上执行。它不是生产迁移流程。新 `db:prepare:iam` 只建立 IAM schema、账号及 schema 内迁移权限，不重置已有密码、不预执行迁移、不 repair、不删除数据。不要用历史 `b29:iam-schema` 作为新数据库的完整迁移入口；IAM 由 Flyway 在启动时维护完整迁移历史。

5. 构建服务。后端运行中不要覆盖其正在加载的 JAR，先停服务再构建：

```sh
pnpm services:build -- --all
```

6. 启动服务。全新的 IAM 数据库首次迁移，以及尚未执行 V13 的旧库，需要先关闭写入口、确认所有旧 IAM writer 和在途请求已排空，再显式确认：

```sh
IAM_IDEMPOTENCY_V13_WRITERS_DRAINED=true pnpm services:run -- --all --timeout-ms 120000
```

Windows PowerShell 使用 `$env:IAM_IDEMPOTENCY_V13_WRITERS_DRAINED='true'` 后启动。V13 成功记录后，正常启动无需该变量：

```sh
pnpm services:run -- --all --timeout-ms 120000
```

`--all` 默认运行 15 个 v2 服务，含 workflow/audit。Core API 为 v1 兼容边界，仅在显式 `--include-legacy` 或 `--service core-api` 时启动；使用它须另起 RabbitMQ，不能据兼容进程声称 v2 功能完成。IAM 迁移失败时保留数据库，检查失败版本与 schema；禁止自动清库、baseline 或未经核对的 repair。V5 删除旧 provider 表需要 IAM schema 内 DROP 权限，新准备脚本已包含此权限。

7. 分别打开四个终端启动前端：

```sh
pnpm --filter @englishflow/learner-web dev
pnpm --filter @englishflow/admin-web dev
pnpm --filter @englishflow/official-site dev
pnpm --filter @englishflow/mobile dev:h5
```

Web 学习端 `http://127.0.0.1:18180/login`，后台 `http://127.0.0.1:18181/login`，官网 `http://127.0.0.1:18182`，移动 H5 `http://127.0.0.1:18183`。固定端口 runner 同时设置 HOST/NITRO_HOST/NUXT_HOST，避免 Nuxt 再开 IPv6 通配监听。端口唯一事实源仍为 `config/local-ports.json`。

## 开发与测试门禁

```sh
pnpm local:smoke                 # 15 服务、四前端、JWKS、基础设施运行可达性
pnpm test                       # 共享包单元测试；Node 20 使用测试专用 TS loader
pnpm typecheck
pnpm build
pnpm --filter @englishflow/mobile build:h5
pnpm --filter @englishflow/mobile build:app
mvn -B -ntp -f pom.xml test
pnpm contracts:merge:check
pnpm contracts:generate:check
pnpm contracts:validate
pnpm test:p1r
pnpm dod:check
```

`local:smoke` 是运行就绪烟测，不覆盖学习闭环、权限正向、媒体业务、原生 secure storage 或业务 UAT。P1R、契约兼容、Evidence 等仍是独立强制门禁；2026-10-06 的 P1R 完整回归仍有 26 项失败，详见验证记录。不得用版本放宽、跳过测试、重写冻结 hash 或自比较基线掩盖失败。修改共享包导出后，如 Vite 仍引用旧优化产物，停止对应前端、清除该 app 的 `node_modules/.vite` 生成缓存并重启；不要改业务存储。契约生成漂移应从契约源运行 `pnpm contracts:generate`，然后复核类型和构建。

## 认证与数据边界

外部客户端统一经 `http://127.0.0.1:18070/api/v1`。IAM 是唯一 Token 签发方，Gateway 和各 owner 独立验证 JWT/PEP，401/403 不转成空列表。未完成成人 Gate 和必要同意的合成注册账号仍会被拒绝学习访问，不能为了烟测直接授权。

Web Access Token 只在内存，Refresh Token 使用 HttpOnly/Secure/SameSite Cookie（本地 HTTP profile 的明确例外不是生产配置）；原生端只允许 Keychain/Keystore，无普通 storage fallback。官网不保存业务 Token。生产私钥只能由 KMS/secret manager 注入；本地 IAM 可用进程内临时 RSA，重启会换 key。

日志和证据只记录脱敏状态、requestId/traceId、JWKS kid 与数据库摘要，不提交密码、Token、Cookie、重置凭证、私钥、真实用户信息或原始音频。
