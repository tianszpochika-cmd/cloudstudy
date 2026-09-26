# 媒体上传地址契约边界（2026-09-23）

## Owner 事实

- `POST /api/v1/media/assets/{assetId}/upload-url` 经 `MediaController.uploadUrl` 调用 `MediaReadService.issueUploadUrl`；不接收 `Idempotency-Key`，不写上传回执。
- 当前注入的 `SignedUrlPort` 在对象库未启用时返回 503 `MEDIA_OBJECT_STORE_NOT_CONFIGURED`。对象库启用时，`VerifiedObjectSignedUrlPort` 对 RECORDING 通道仍返回 503 `MEDIA_UPLOAD_NOT_CONFIGURED`，因为没有经过验证的 PUT 授权流程。鉴权、资源和权限检查可先返回 401/403/404；合格请求没有成功路径。
- 不存在可重放的成功响应，不能宣称持久化幂等或上传成功。

## 契约与门禁

- 媒体 fragment 将该路由标成 `x-fail-closed`、无副作用，删除原有 200/202 成功响应，保留准确的 503 失败响应。
- `validate-contracts.mjs` 仅对这条精确方法和路径允许该例外，并校验 `NO_SUCCESS_PATH`、无副作用、503、运行状态和没有任何 2xx 响应；其他写操作继续要求 `x-idempotency`。
- `pnpm contracts:merge`、`pnpm contracts:merge:check` 均通过：28 个 OpenAPI fragment、424 条路由。
- `pnpm contracts:validate` 通过：455 个操作、796 个 OpenAPI schema。当前没有下一个首个缺口。
- `node --test scripts/contracts/validate-fail-closed-write.test.mjs` 通过：构造假的 200、假的幂等、缺失失败关闭标记和把例外扩大到另一写路由，验证器均拒绝。

## 未验证与后续

- 本次只核对源码与契约，未重启服务、未执行真实 Gateway 请求。未来若实现 PUT grant，必须先建立 owner 权限、持久化请求幂等、同键重放/异体冲突和对象版本验证，再移除失败关闭例外并补成功响应。
- 媒体服务另有仅内部使用的 metadata 写路由（例如转码、rendition、撤销、波形）；本次门禁结果不证明这些路由的运行幂等或端到端可用。
