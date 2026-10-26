# R1-001 delivery-4 定向复核与下一组任务（2026-10-04）

## 结论

REWORK；不放行R1-002。本轮是为下一步提示词进行的源码、摘要、单元与VM定向复核，未重跑构建或浏览器全套，不声称全面终验。delivery-4的24 artifacts/10 evidence与限定Git快照一致，复核开始revision13 REVIEW。原四套件实际38/38，原F10三种连续情形不再复活旧SKU；原F11硬写HTTP200已修。剩余如下两项，原真实公开上游输入缺口继续保持。

## F12 P2

位置：apps/official-site/server/api/public-projection.get.ts:262

F10旧套餐已不复活，但恢复缓存回填把已知pricing error/PUBLIC_COMMERCE_DEGRADED无条件改为recovery/PUBLIC_PROJECTION_STALE，并把commerceState/Error同步覆盖。既有价格读取失败原因和独立facet语义丢失；新连续测试只检查SKU与课程，没断言第三步的状态/原因。

整改：在缓存回填中保留已知不可读facet的状态及原因；对此前成功取得的可读缓存才标stale/recovery。同步commerceState/commerceErrorCode与pricing facet，保持无旧SKU、TTL、权限及并发作废规则。给failed连续序列补第三步状态/错误码断言。

## F11 P2

位置：evidence/p1r/m3/P1R-M3-008/redesign/R1-001/work/negative-control-4.cjs:1

HTTP真实状态与基础assert已补，但negative-control是另一个独立assert脚本，未调用r1-001-sweep-4，无法证明实际采集器在缺CTA时非零。实际采集器仍只接受href含/register和web|mobile，错误域名/端口或双视口都走Web也会通过；h1 attached+固定2秒不证明hydration；website mapping把未点击的retry列PASS。

整改：新建版本采集器，精确断言设备对应origin/port/path与安全returnTo及locale/theme；等待可见页面和预期设备CTA。用相同采集器入口在隔离受控样本注入非200/缺CTA/错误目标等，保存子进程退出码与失败项。真实未执行的重试/主题维度只标PARTIAL/未跑，不擅自把必测项判不适用；固定脚本、输入、日志与输出哈希。


证据：[38项输出](unit.log)、[摘要/源码与旧套餐复验](precheck.json)、[facet状态与错误码连续复现](facet.json)。已知failed序列第二步pricing=error/PUBLIC_COMMERCE_DEGRADED，第三步pricing=recovery/PUBLIC_PROJECTION_STALE；数据没有复活，不能重报旧F10数据问题。

## 下一组仅三项

1. 校准F12缓存facet状态并增加第三步断言；不重新改造已通过页面。
2. 补齐F11实际采集器同入口负例与精确目标断言、真实适用映射。新输出与报告用版本5文件，保留所有旧收据和主审证据。
3. 进行真实公开上游环境准备与验收：只读确认Java25/Maven、既有运行脚本、隔离profile及Gateway18070→content18089/commerce18096依赖，尝试在固定空闲端口启动自己的既有隔离实例。只做现有能力的准备，不写后台业务、不改认证/路由安全或清共享库。合法成功、空目录和503→恢复的事实须由owner/隔离实例提供。若依赖缺失，输出实际失败命令/日志/缺项与最小接线范围，不只重复“端口关闭”；需要新增migration/seed/后台代码时交主审限定范围。

交delivery-5 REVIEW，真实TC01-03未完成继续P1 blocking，不自批或开002。状态变更通过正式reject登记，后续以实际revision为准。注册入口与回退可引用reviewer-3证据，注明适用源码，不能要求本卡先完成R1-002注册写入造成循环依赖。
