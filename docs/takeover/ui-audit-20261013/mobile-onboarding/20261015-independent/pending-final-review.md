# MB-004 独审待接续差量

**FINAL_INDEPENDENT_UI_NOT_RUN / 不签新页面**。Root报告当前窗口83%/周93%，预计把最终独审留给北京时间12:34后的窗口；本阶段只归档既有证据，不开新组，不为抢推省略独审。当前源摘要见 [pending-final-review-snapshot.json](pending-final-review-snapshot.json)，该快照仅标识当时未签组合，后续修改不能继承已验状态。

已完成的具名范围：自有固定服务刷新及两次fresh中英copy smoke。aa20/5de只验证gate显示；3199/5e0只验证“查看同意事项”/“Review consent status”和短blocked正文。两次均无覆盖层/pageerror，全部API拦截，使用明确合成session/resume provider，不能证明真实认证、后台、保存或最新组合UI。旧fresh文件、缓存/业务/对比/指针FAIL均未覆盖。

当前自有服务session87595 / PID24472，127.0.0.1:18183、strictPort+force。作者确认无inflight后才启动；旧7489/PID27892已退出，没有停止未知/shared进程。服务保持供下一组复用，首次接续须重新核监听与归属。

Root的新共享逻辑31项PASS以及两份24项回归属于模块证据，不代替最终页面浏览器验收。当前target403方案保留真实current IAM成人/同意事实，同时标记sessionRefreshRequired=true、target.readable=false；作者正在补一次owner-scoped refresh后再读取。该新交互未在本agent独立浏览器组验收，不能据旧copy或旧静态审查签收。

下一次独立复签需最终page/API/session/i18n/domain/store/helper哈希组合，优先验证：

- 明示PASSED+ELIGIBLE、缺/RESTRICTED/UNKNOWN/503的fail-closed，以及当前事实读取失败不能沿用旧ready；真实拒绝与未知/网络失败分开。
- 已签当前IAM与target403保持区别，显式一次owner-scoped refresh→新claims→再读目标；重复、失败、切号/onHide/晚回调不越步、不写错owner、不无穷重试、0自动consent PUT。
- 最终四态与真实选择/年份/checkbox/primary键盘/保存读回/出口busy和race；真实pointer0/160ms、拖离/nativecancel、多行200%稳定和ARIA恢复。
- 实际对照concept与正式页面；必须测具体输入/checkbox/goal/quota等正常可交互控件边界 **>=3:1**，不能用文本/主按钮对比代替。作者原暗色1.67 FAIL保留，新v2-mut修稿只有最终实际度量通过才能关闭。

作者常规矩阵、独立风险审查、构建/类型、fixture、真实IAM/learner后台事实及真机分列；检查数量不折算产品完成率。真实业务、审计和原生平台/物理输入/存储继续NOT_RUN。不改正式源码、Git或主文档，不开启auth三页额外检查；token同族后续关切由root另列。

最新停止通知：Root实读91%/周95%，作者首读90%已停止；本agent此后只保存上述既有记录，不运行新浏览器或检查。作者报告最新f56/5e0/test8cdc候选的有限刷新恢复7项、race4项fixture通过，最新九源及断点见其 `20261015-resume-author/checkpoint-0810.md/json`；这些不替代本agent尚未跑的最终视觉/指针独审。停止归档见 [quota-stop-notice.json](quota-stop-notice.json)。自有87595/PID24472保持，下窗先核归属再接续。
