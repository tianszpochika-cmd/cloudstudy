# B4 Avatar 与收藏道具权属门禁（源码验证）

日期：2026-09-23。范围：`gamification-service` 的 `local-real` B4 Avatar、collection/catalog、兑换和学习空间道具端点；不包含正式登录后的浏览器验收或 Docker 运行回归。

## 发现

- 原 `GET /collection`、`/avatar/items`、`/avatar/loadouts` 等使用固定回退值，并在缺行时写入 `gamification_feature_state`。回退值把 `ITEM_STARTER` 标为 `owned=true`、把 `starter-loadout` 标为 `equipped=true`；旧 JSON 也可原样回显。
- 原 `redeem` 只把 URL 中的 `catalogItemId` 追加到 collection JSON，没有版本化价格、星币扣账、道具发放或幂等权属流水。`saveLoadout` 接受请求中的道具列表，`equipLoadout` 再将该 JSON 标为已装备。
- 本服务当前 `reward_grant` 持久化的是 `reward_key` 和 `outcome_code`（概率 tier）；没有主体绑定的具体 `itemCode` 发放事实。已领取宝箱也不足以证明拥有某道具。历史 JSON 和账本均未改写或删除。

## 本次边界

- B4 OpenAPI 明确具体道具权属必须有服务端 itemCode 证明；兑换、保存/装备套装、保存空间道具在证明和事务链缺失时声明 503。
- collection、catalog、Avatar items/loadouts 和空间道具读取返回空态；Avatar resources 不再回显虚构 manifestHash。读取不为这些资产创建默认行，也不把旧 JSON 当成权益。
- Avatar profile GET 只返回 `2D_FALLBACK` 展示建议，不读取旧 `avatar-profile` JSON，也不宣称 `avatarId`、`resourceVersion` 或 `loadoutId`。Profile PUT 因没有事务性 `Idempotency-Key` 回放/异载荷冲突与资源权属链，也返回 503；画质偏好仅由客户端本机管理。旧 JSON 保留原状。
- 兑换、profile、套装和空间资产写入返回 `ENTITLEMENT_UNAVAILABLE` / HTTP 503，且不写数据库。同键重复和异载荷都不形成成功状态。匿名、缺权限和错误 tenant 继续由现有 JWT/PEP 拒绝。

## 验证

- `mvn -q -Dtest=AvatarEntitlementFailClosedTest test`：5/5 通过，覆盖匿名/错误 tenant、旧 JSON 非授权和不回显、已领取 tier 非 itemCode 权属、无数据库写入、跨主体读取同一安全空态、profile PUT 同键重复/异载荷拒绝。
- `mvn -q test`：62 tests，0 failure、1 error、2 skipped；唯一错误 `GamificationJwtDecoderNegativeTest` 在此 Windows JDK 创建本机 HTTP 测试端点时触发 `Unable to establish loopback connection`。排除此环境错误后 `mvn -q "-Dtest=*,!GamificationJwtDecoderNegativeTest" test` 退出 0：61 tests，0 failure、0 error、2 skipped。
- `pnpm contracts:validate`：455 operations、796 OpenAPI schemas、192 events 等校验通过。`git diff --check` 通过。

## 仍未完成

- 尚无服务端发放 `itemCode` 的不可变权属流水、撤销规则、版本化商品价格、星币扣账与发放原子事务、幂等重放及对应事件。不能仅凭宝箱 tier、旧 `owned` 布尔值或固定 starter 配置恢复装备/兑换。
- 没有正式法律文书的认证测试账号，故本次没有声明实际 JWT 用户的 HTTP 端到端 PASS；更没有声明 Avatar/衣柜/兑换功能可用。需在真实 owner 链建立后补契约、迁移、运行与视觉验收。
- 同一 local-real 控制器仍有静态 quest/achievement/season 奖励展示与领取真实性风险，另行审计，不作为 Avatar 权属依据。
