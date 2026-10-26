# R1-001 首次交付独立审批（2026-10-03）

## 结论

**不批准ACCEPTED，退回R1-001整改；R1-002及下一组不放行。** 已核对delivery-1当前23文件与证据摘要、dirtyDiff一致。当前17个实现/测试文件有差量，6个为零diff复用；正常composable直接保存完整response，facets不会丢失，不能错误报告为全链未透传。独立Agent只读复核与本聊天重放一致。

## 已完成的复测

- 当前四文件单元/静态/VM：29/29，失败0，未将其视为产品TC通过。
- 当前构建产物本地18182：11页HTTP200；浏览器375×812与1440×900各11页，共22次读取，无横向溢出；记录中Console error/warn为空。仅上游不可用分支，未覆盖空/成功/恢复态。
- 实际课程错误态重试按钮可点击，仍为诚实error；价格/下载独立页存在。移动所有注册CTA仍指18180，见browser-error-sweep.json。
- VM重放正常空目录：courses=empty、定制title条件ready-only，文案分支不触发。维护响应+commerce200：global=maintenance、pricing=ready。恢复缓存：download=recovery、stale=true、有旧数据，但页面无恢复提示/重试。见verification.json/semantic-probe.log。
- 定向TypeScript语义检查：当前真实composable在显式Nuxt API声明shim下23/43行均TS2739，缺facets/commerceState/commerceErrorCode。此检查不是全Nuxt typecheck。
- 无真实Gateway/content/commerce上游，本次未创造服务端发布/授权事实，也未运行真实503→恢复。必测TC仍不可完整PASS。

## 需修复的发现

### F01 P2：正常空目录courses.state=empty，但定制“内容准备中”仅ready时传入，首页同类条件也永不触发。

- 文件：apps/official-site/pages/courses/index.vue:142
- 修复：按empty状态显示共享课程空文案，覆盖全空及其它facet有数据的空课程；不要改变公示空态。
- 复测：R1-001-TC01

### F02 P2：内容HTTP200业务maintenance/permission/error时commerce成功强设pricing=ready，价格页误显示为空价成功。

- 文件：apps/official-site/utils/public-projection.ts:391
- 修复：全局不可读/拒绝/维护优先，独立commerce状态只在内容投影可读时参与；补三种业务状态和commerce成功的组合负例。
- 复测：R1-001-TC02

### F03 P2：价格、下载和公告recovery带旧数据时进入列表分支，PublicStatus在v-else，无恢复说明和重试入口。

- 文件：apps/official-site/pages/pricing.vue:35
- 修复：旧数据保留时仍明确stale/recovery、最后成功时间和重试按钮；三页均验证故障后主动重载。
- 复测：R1-001-TC02

### F04 P2：默认web，课程和价格亦硬指定web，实际11页375px所有CTA均18180，移动注册helper没有页面入口。

- 文件：apps/official-site/components/SiteStartButton.vue:4
- 修复：落实设备对应Web/mobile默认路由或清晰可选移动入口；SSR与hydration一致，保留locale/theme与固定returnTo；补真实移动点击。
- 复测：R1-001-TC01、R1-001-TC03

### F05 P2：新增必填响应字段未同步初始与catch对象，定向TS检查23/43行TS2739；现有网络失败测试实际返回error对象而非抛异常。

- 文件：apps/official-site/composables/usePublicProjection.ts:23
- 修复：补齐加载/真实throw异常的完整响应形状与facet状态，保留正常响应；增加真实reject用例，不以可选字段绕过类型一致性。需主审补此文件编辑范围。
- 复测：R1-001-TC02

### F06 P2：必测双视口空/成功态、真实上游503恢复、浏览器点击/返回证据缺失被标成P3非阻塞。summary同时声称composable已改和未改，回退删除证据/checkout会丢审计及共享修改。

- 文件：evidence/p1r/m3/P1R-M3-008/redesign/R1-001/delivery-1.json:1
- 修复：如实声明必测未验证为阻塞；修正实际文件17个及复用说明，保留历史证据，回退仅撤销自身差量。完成真实TC或明确BLOCKED，禁止用VM/HTTP代替产品PASS。
- 复测：R1-001-TC01、R1-001-TC02、R1-001-TC03

## 逐步结论

步骤1认领和摘要核对有效；步骤2因F02/F05不通过；步骤3因F01/F03不通过；步骤4因F04不通过；步骤5因F06及必测缺口未完成。现有独立页、单commerce失败显式error和固定returnTo能力保留，按缺陷小步修复。构建成功不证明TypeScript语义检查或业务验收成功。

## 下一步

继续原R1-001，不重做整个项目。主审将usePublicProjection.ts加入允许范围并签发当前整改准备收据；新收据仅授权整改开工，不推翻本拒绝结论，不提升父任务或其它卡。修复后提交delivery-2，保留delivery-1及本次证据。新增用例覆盖empty、maintenance/permission/error优先级、三个旧数据recovery页面、真实网络throw与移动入口。真实上游及双视口正向/故障恢复缺失仍应阻塞验收，不能自标P3关闭。

本轮只启动并停止了本聊天自己的18182构建产物检查进程，结束后端口FREE。未写数据库、改业务实现、重启共享服务或输出凭据。所有UI检查使用CUA；未运行旧website-runtime全套，其余范围依然未验证。
