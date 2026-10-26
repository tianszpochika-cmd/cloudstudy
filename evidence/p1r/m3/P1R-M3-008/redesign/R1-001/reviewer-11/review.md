# R1-001 delivery-8 独立审批（2026-10-05）

## 结论

**ACCEPTED。** 本次签收仅适用于 R1-001 当前 24 产品文件与 4 准备文件快照、五个步骤和三个 TC。审批前为 REVIEW revision26；正式登记收据后应为 ACCEPTED revision27。R1-002…005仍为 PLANNED，需分别签收输入与依赖；不自动晋升 P1R 父任务、完整 Phase1 或上线 Gate。

## 快照与独立检查

- delivery-8 收据、28 artifacts、53 evidence 全部重算匹配。HEAD 3d11be3337accd32afbdbe13a218bca38c786043；限定 dirty 71ecf647807de2bfae02c193222891d6935eb68c74539fe4d0540f8b8a1ed8a6。与 delivery-7 相比只有 website-runtime.cjs 的移动定位调整，23 个其他产品文件与 4 个准备输入不变。见 current-snapshot.json。
- 主审独立执行四套件 38/38；同一采集器负例13/13（MOCKED，仅证明采集器）。无新产品代码修改；本轮未重新构建，不能将历史构建日志称为本轮构建。
- Browser plugin 不可用，使用仓库已有 Playwright。空 content 使用专用空 schema r1_001_empty_20261005_t9b 和 SELECT-only reader；正常 content 仅读取既有公开事实。正常实例不是隔离数据库凭据，不能声称共享库身份为只读。启动包装器关闭六项后台/迁移开关；只调用公开 GET，未提交注册或操作共享事实。

## 三项产品验收

| TC | 结论 | 当前独立证据 |
|---|---|---|
| TC01 | PASS | reviewer-11/empty-chain 14项：合法空输入、实际页面 BFF 与 DOM、0课程及“内容准备中”、价格权威空；sweep 46项覆盖375×812/1440×900各11页，可操作菜单入口与真实HTTP。reviewer-11b/normal-chain 14项核对7课程。reviewer-11c/all-entry 实际逐页点击22次、显示对应注册表单并返回官网；未提交注册。 |
| TC02 | PASS | reviewer-11b/retry：移动无缓存真实503/error及桌面 memory-cache/recovery，同一页面/上下文恢复自有 content 后实际点击“重新加载”，实际BFF响应ready、7课程标题逐项对应、更新日期可见、旧横幅和全部重试按钮消失、Console零错误。不以reload/goto替代点击。 |
| TC03 | PASS | reviewer-11/security：8次恶意returnTo输入、两端实际落地/返回及快速双击；精确origin/path/hash/returnTo/locale/theme；外跳前及两次返回后共6次官网origin存储读取成功，local/sessionStorage均0键，Cookie仅yx.public.locale/theme。只记录键名，不输出值；不继承未经固定的device源码历史哈希。 |

官网完整套件主审重跑 **11 checks / 152 layouts / 0 errors / exit0**，包括独立pricing/download、移动菜单、主题与布局。演示练习检查不等于学习业务验收。完整原始输出在 reviewer-11b/website.log 与 website/browser-checks.json。

## F15–F18 与证据口径

- F15关闭：入口可操作门已恢复；移动常驻CTA隐藏时确实打开菜单，再验证可见/可操作项。独立区域截图已目检，手机/桌面空态及手机菜单可读，无横向溢出。采集器注释的“实际点击”原来仅核href，主审22次真实点击另行补齐。
- F16关闭：执行人真实同页点击成立，主审额外验证恢复横幅与重试入口移除，并目检两视口失败/恢复区域截图。
- F17关闭：完整官网原始套件本轮真正跑到底，定位调整保留原有断言。
- F18由主审独立补证关闭：work/tc03-11.cjs:57吞掉双击失败；65–70在可能外跳后的页面读storage并吞掉读取异常，不能据该报告认定官网“0键”。此项原输出保留且不作为审批依据；主审browser-security.cjs先硬断言官网origin，读取失败直接失败，完成真实落地/返回和当前源码安全复验。无需因此再次改动产品或提交delivery-9。

## 保留失败与边界

第一次主审运行 runtime-result.json 为FAIL：独立重试探针在桌面recovery找到两个同名按钮发生strict locator异常，手机步骤已通过；不是被掩盖的产品失败。原脚本/失败日志/截图完整保留。新增browser-retry-v2精确选首个实际按钮，恢复后检查所有可见重试按钮为0；独立续验全部PASS。审批runs只列真实退出0且晚于本次提交的运行，失败尝试仍在固定证据中。

所有当轮自有进程已停止，三次运行末尾六固定端口均FREE。没有停止他组服务、改端口、共享DB写入/清库、既有账号权限变更。测试空schema/reader保留，未擅自清理。仅补父manifest的R1-001局部证据引用，保留原父判定和历史字段。

## 下一步

下一组为 R1-002注册 / R1-003注册幂等 / R1-004登录刷新撤销 / R1-005设备踢出。先交R1-002限定准备包：主owner认领、独立IAM验收schema/最小权限、固定端口与当前Java/Node、契约/生成类型、安全密钥注入与合成fixture、四项Gate逐项scope。主审签READY后才实施002并提交REVIEW；002 ACCEPTED之后才解锁003/004，004 ACCEPTED之后才解锁005。不能把001公开只读环境直接当作IAM写链环境。
