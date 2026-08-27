export const DOD_CONFIG = Object.freeze({
  requiredDocuments: Object.freeze([
    { path: 'AGENTS.md', label: 'Agent 工作与架构规则' },
    { path: 'requirements/product-requirements.md', label: 'PRD' },
    { path: 'requirements/feature-matrix.md', label: '功能矩阵' },
    { path: 'requirements/mvp-scope.md', label: 'MVP 范围' },
    { path: 'requirements/acceptance-criteria.md', label: '验收标准' },
    { path: 'requirements/backlog/开发实施总纲与功能链条任务分解.md', label: '开发任务基线' },
    { path: 'requirements/backlog/Agent开发状态总报表.md', label: 'Agent 状态总报表' },
    { path: 'docs/00-vision/document-governance.md', label: '文档治理' },
    { path: 'docs/09-roadmap/roadmap.md', label: '产品路线图' },
    { path: 'docs/10-decisions/README.md', label: 'ADR 索引' },
    { path: 'docs/10-decisions/0001-modular-monolith-first.md', label: 'ADR-0001' },
    { path: 'docs/10-decisions/0004-stack-switch-uniapp-springboot.md', label: 'ADR-0004' },
    { path: 'docs/10-decisions/0005-python-ai-orchestrator-retained.md', label: 'ADR-0005' },
    { path: 'docs/10-decisions/0006-database-switch-mysql.md', label: 'ADR-0006' },
    { path: 'docs/10-decisions/0007-phase1-scope-and-development-governance.md', label: 'ADR-0007' },
    { path: 'docs/06-design/detailed-specs/README.md', label: '详细设计索引' },
    { path: 'docs/06-design/detailed-specs/01_Onboarding与自适应首屏详细设计.md', label: '详细设计 01' },
    { path: 'docs/06-design/detailed-specs/02_词汇短语与SRS记忆闭环详细设计.md', label: '详细设计 02' },
    { path: 'docs/06-design/detailed-specs/03_语法树长难句与写作训练详细设计.md', label: '详细设计 03' },
    { path: 'docs/06-design/detailed-specs/04_听说读全模态精练系统详细设计.md', label: '详细设计 04' },
    { path: 'docs/06-design/detailed-specs/05_做题中心模考与掌握闭环详细设计.md', label: '详细设计 05' },
    { path: 'docs/06-design/detailed-specs/06_游戏化星系与3D成长系统详细设计.md', label: '详细设计 06' },
    { path: 'docs/06-design/detailed-specs/07_自习室社群与用户基础服务详细设计.md', label: '详细设计 07' },
    { path: 'docs/06-design/detailed-specs/08_商业化收单教研CMS与运营中台详细设计.md', label: '详细设计 08' },
    { path: 'docs/06-design/detailed-specs/09_全站详细设计一致性审计白皮书.md', label: '详细设计一致性审计' },
    { path: 'requirements/backlog/Phase-1范围冻结与跨文档基线.md', label: 'Phase 1 范围冻结' },
    { path: 'requirements/backlog/Agent开发SOP与状态流转模板.md', label: 'Agent SOP' },
    { path: 'requirements/backlog/DoD-Gate与证据包规范.md', label: 'DoD Gate 与证据' }
  ]),
  requiredDirectories: Object.freeze([
    {
      path: 'packages/contracts',
      label: '契约目录',
      expectedExtensions: Object.freeze(['.yaml', '.yml', '.json']),
      warning: '目录存在，但尚未发现 OpenAPI/事件 YAML、YML 或 JSON 源文件'
    },
    {
      path: 'database/mysql/migrations',
      label: 'MySQL 迁移目录',
      expectedExtensions: Object.freeze(['.sql']),
      warning: '目录存在，但尚未发现 SQL migration 文件'
    },
    {
      path: 'tests',
      label: '测试根目录',
      expectedExtensions: Object.freeze(['.ts', '.tsx', '.js', '.mjs', '.java', '.py', '.sql']),
      warning: '目录存在，但尚未发现可执行测试源文件'
    },
    {
      path: 'tests/integration',
      label: '集成测试目录',
      expectedExtensions: Object.freeze(['.ts', '.tsx', '.js', '.mjs', '.java', '.py']),
      warning: '目录存在，但尚未发现集成测试源文件'
    },
    {
      path: 'tests/e2e',
      label: '端到端测试目录',
      expectedExtensions: Object.freeze(['.ts', '.tsx', '.js', '.mjs', '.java', '.py']),
      warning: '目录存在，但尚未发现端到端测试源文件'
    }
  ]),
  governanceMarkers: Object.freeze([
    'P1-BASELINE-20260820',
    '5 / 15 / 30 / 45',
    'EN_48_PHASE1',
    '0.5x~2.0x',
    'lrn_srs_state',
    'DELAY_VERIFY_D1',
    'VOC',
    'ASM',
    'Phase 2',
    'Phase 3',
    'CHANGELOG',
    'check-dod.mjs'
  ]),
  portRegistry: Object.freeze({
    path: 'config/local-ports.json',
    requiredServices: Object.freeze({
      'core-api': 18080,
      'learner-web-dev': 18180,
      'admin-web-dev': 18181,
      'official-site-dev': 18182,
      'mobile-h5-dev': 18183,
      mysql: 13306,
      redis: 16379,
      kafka: 19092,
      'rabbitmq-amqp': 15689,
      'rabbitmq-management': 15690,
      'minio-api': 19000,
      'minio-console': 19001
    })
  })
});
