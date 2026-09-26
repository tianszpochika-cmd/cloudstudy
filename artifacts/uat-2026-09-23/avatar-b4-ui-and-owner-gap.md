# 移动端角色页展示与 B4 装扮事实门禁

核查日期：2026-09-23。`PAGE-P1-AVATAR-REWARD` 仍为 **PARTIAL**：移动 H5 与学习 Web 的角色展示已收束，未验证真实学习事件、奖励 grant、领取到装扮权益的正向链。本文件的页面修复不修改数据库或 Docker；owner 后续门禁见[B4 专项](b4-avatar-entitlement-gate.md)。

## 页面修复

- 旧 `/b4-avatar` 直接显示 `2D_FALLBACK`、`resourceVersion`、`avatarId`、`loadoutId`、`itemCode`、`slot`、`quality` 原码；固定默认素材也会像用户藏品一样出现。[移动角色页](../../apps/mobile/src/pages/b4-avatar/b4-avatar.vue) 已改为展示预览、套装素材和装扮素材；星形画面明确标为“形象示意”，不声称已渲染 3D 资产。素材明确不等于已获得奖励。
- 因缺少可信装扮权益，默认衣柜仅作“预览”，不显示“当前使用”，也不提供装备按钮。上方画质是**本机设置**；旧“保存展示偏好”按钮只会重复提交 `2D_FALLBACK`，现已移除，页面不再把本机画质切换说成服务端偏好保存。奖励按钮转到已有世界页的奖励区，不在角色页伪造领取结果。[角色页文案](../../packages/i18n/src/mobile-experience.ts) 已改成对应的画质和素材说明。[B4 状态面板](../../apps/mobile/src/components/b4/B4StatusPanel.vue) 的画质文案缺词时不再回退为 `Performance` 等内部级别。
- 页面改用 `ensureMobilePageAccess`，未登录时保留原目标 `returnTo`，成人学习 Gate 由共用守卫判定。每次进入重新读 owner，加载期间不露上个会话的角色信息；全部失败后隐藏旧卡片，重试成功可恢复展示。401/403 继续走原有权限处理。

## 可复核证据与边界

- [局部 H5 夹具](../../apps/mobile/tests/b4-avatar-display.e2e.mjs) **8/8**：320/390px 的空态、旧固定素材及 owner 仅回 `renderMode` 的无资产响应，390px 全失败后重试，匿名登录保留目标路径；均无 pageerror 或横向溢出。旧 `owned=true` 的 `ITEM_STARTER` 也不显示“已拥有/当前使用/领取”或保存按钮。[结果](screenshots/mobile/avatar-fixture/results.json)与[owner 无资产 390px 截图](screenshots/mobile/avatar-fixture/owner-empty-390.png)是**浏览器拦截 API 的合成夹具**，不是授权用户运行验收。
- 学习 Web 角色分栏已移除原始 ID/版本、装备与保存按钮，旧素材只作预览；两端类型检查、学习 Web 构建及移动 H5 构建通过。批 13 私有 Docker 只包含其构建前的角色页版本，本次新文案和学习 Web 页面尚未换入镜像；学习 Web 已登录角色页尚无浏览器视觉证据。移动夹具开发服务的共享 i18n 标题缓存仍可能显示旧文案，正式镜像需单独目视复核。

## Gamification owner 整改前的数据真实性缺口与后续方案

1. [GamificationLocalFeatureController](../../services/gamification-service/src/main/java/com/englishflow/gamification/adapter/http/GamificationLocalFeatureController.java) 的 `state()` 在读不到 JSON 行时会把默认值写入 `gamification_feature_state`。默认 `avatar-items` 和 `collection` 把 `ITEM_STARTER` 标为 `owned=true`，默认衣柜也直接装备它；未找到经正式设计确定的免费初始授予规则或与真实 grant 的绑定。这些默认 JSON 不能当作获得证明。
2. 当前 `saveLoadout` 接受客户端任意 `itemCodes`，`equipLoadout` 仅检查套装 ID 是否存在，`saveAvatarProfile` 可接收客户端 `resourceVersion`，`catalog/redeem` 直接把条目写入 collection。JWT subject/平台租户门禁仍在，但不能证明装扮权益。[reward_grant](../../services/gamification-service/src/main/resources/db/migration/V1__create_gamification_service_schema.sql) 的领取结果只到 `COMMON_COSMETIC` 等档位；缺少档位到具体 `itemCode` 的版本化目录映射、授权快照及 owner entitlement 表。没有可信 positive path 能安全地放开装备。
3. 批 14 owner 源码已让上述无可信权益的读取为空、写入失败关闭，保留旧 JSON/历史，不批量改库，详情与测试见[B4 专项](b4-avatar-entitlement-gate.md)。正式恢复仍需 owner-owned `tenant/subject/itemCode/source grant 或明确的免费初始授予/resourceVersion` 绑定、版本化 outcome→item 目录及同事务写入；验证无 grant、借用别人的 grant、异 item grant、旧 `owned=true` 均被拒，真实领取或明确的初始授予才可装备。不要仅靠旧 `owned` 字段或奖励档位推断具体素材。

另一个独立内容风险见 [B3 已发布内容门禁](b3-published-content-gate.md)：当前 `AND 1 = 0` 是**临时全拒绝读取门禁**，防止无受审版本绑定的旧 113 行被当作正式内容；正向恢复必须先建立可验证的发布/版权/资源摘要绑定。它不构成 B3 功能通过或正式发布可用。
