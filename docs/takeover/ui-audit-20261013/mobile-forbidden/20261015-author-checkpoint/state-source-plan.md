# MB005 只读状态来源与最小实现断点

已读 preaudit-20261015/implementation-plan.md、现有 forbidden.vue、Root概念图、session/navigation/uni-runtime、共享i18n及adult-consent-copy断言。未修改正式页面、i18n、共享实现、测试或Git；未启停服务、未新跑测试。当前只读开始用量85%，最后继续前实读89%/周14%，ordinaryUsageAllowed=true，未使用券。

保存后实际额度已到90%/周14%，立即停止新的设计、修复与测试；本次没有页面候选或已跑检查。只保留本文件和raw-hashes.json（含raw/LF规范化源码hash、停止额度）。Root记录下次复查在22:37之后，reset为今天22:35:56。

## 可靠事实与边界

- forbidden本身是公开路由。settings/profile/support属于现有AUTH_ONLY出口，仍须当前已认证；不能推断其每项写能力获准。
- 当前会话restore（已等待已有refresh）后，捕获getMobileApiIdentity的subject/revision，按当前owner调用现有refreshGateFromServer。明确REJECTED才显示成人原因；UNKNOWN/读取失败/未登录用无法确认状态，RESTRICTED不能冒充REJECTED。
- learningConsentWithdrawn是内存boolean加无owner的sessionStorage sticky marker；clear/logout会保留，login/register才清。settings撤回await后的mark尚无owner/hide guard。因此它只能驱动安全暂停，不能证明“当前owner亲自撤回”。Root已认可文案“学习访问已暂停 / 当前无法继续打开学习内容。你仍可管理账号或查看帮助。”。未登录/unknown不套用marker。current principal accepted=false及GET历史records均不能补成明确撤回事实；typed owner authority缺口保留，当前不改共享层。
- reason优先级：当前读取失败/未认证/尚未确认→unknown；可信当前owner REJECTED→adult；当前已认证安全暂停marker→paused（中性文案）；其余已认证→generic。query/returnTo不作权限或具体拒绝理由来源。
- openUniPage返回void，丢失异步导航结果。页面直接await getUniRuntime导航固定settings/support，账号主动作优先settings以避开profile的tabbar切换差异；不做history/home返回。URL只经既有安全返回函数，不执行外部地址。
- logout先同步invalidates identity/revision，再请求服务端；成功/失败都会本地clear，boolean false表示服务端未确认。页内不能用“原revision必须不变”阻止正常安全退出；也不能把false显示为服务端注销成功。建议false停在公开页显示本机已退出/服务端未确认和明确返回登录动作。logout晚回调若已有新owner或新登录进行中，必须不导航/不覆盖其状态。

## 最小候选文件（尚未写入）

1. apps/mobile/src/pages/forbidden/forbidden.vue：轻品牌、单H1、短说明、小锁，管理账号主按钮/帮助次按钮/独立退出；unknown和未登录有真实登录入口。页内pending action、请求代次、active/hide与owner guard；统一busy/ARIA/Enter-Space释放激活、导航失败邻近alert。无固定大留白、无重复Header/原因卡、无nowrap。
2. packages/i18n/src/mobile-experience.ts：只新增mobile.forbidden专属zh/en键，复用mobileT/mobileI18n注册链；不改已签auth/onboarding键，不再复制b10/auth/mobile三套原因文案。
3. 后续必要测试及新证据：升级adult-consent-copy中文源码匹配为共享文案/行为边界，保留不改年/不重试Gate/安全出口断言；新增本页严格fixture H5测试。共享session/gateway/navigation/helper不动。

## 后续验证顺序

先检查额度与冻结hash、实现完整私有候选；随后类型/模板与最小行为检查；新鲜fixture验证adult/paused/generic/unknown/匿名、marker不跨匿名造原因、固定出口导航失败、退出true/false、pending防重、切号/hide/晚回调。再核中英/四主题/320-390-768-1280、200%整词与短屏、44px、焦点/键盘/真实指针。作者与独审分离，真实IAM/native/读屏继续各列GAP。当前无新PASS或签收。
