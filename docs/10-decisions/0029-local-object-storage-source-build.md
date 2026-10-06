# ADR-0029：本地对象存储从固定官方源码构建

- 日期：2026-10-06
- 范围：本地开发和空卷 CI 验证；不改变生产部署或 v2 数据 owner。
- 状态：本轮本地维护采用；不代表供应链风险、正式发布或业务任务被验收。

## 背景与决策

本机拉取原配置的 MinIO/mc latest 镜像失败（Quay 401、Docker Hub access denied），导致四项必需基础设施缺一。采用既有 MinIO 的官方源仓库构建，不引入其他对象存储实现。

`infra/docker/Minio.Dockerfile` 固定 Go 1.24.9 和 Alpine 3.22.2 的多架构镜像 digest；下载固定 commit 归档，必须通过 SHA-256 后才解包编译。Compose 固定本地镜像标签与 mc 构建参数；`config/local-services.json` 对齐 MinIO 标签。端口、S3 接口、持久卷和私有桶策略不变。

| 组件 | 官方源码提交 | 归档 SHA-256 |
|---|---|---|
| MinIO | `7aac2a2c5b7c882e68c1ce017d8256be2feea27f` | `71794c2df26aad0cc99e8421c58b7aa2dd55969f979b0e7d1e931042e9fabcd6` |
| mc | `77f82e18b5401a65958f1619df6ebb994634bd88` | `167415edd21bc29f5360943dac64272aa5cda0a39f3070b15cfeca671c43d975` |

来源：[MinIO 固定提交](https://github.com/minio/minio/tree/7aac2a2c5b7c882e68c1ce017d8256be2feea27f)、[mc 固定提交](https://github.com/minio/mc/tree/77f82e18b5401a65958f1619df6ebb994634bd88)。源码与许可保留在容器构建阶段；没有把源码归档或二进制提交进业务仓库。

## 验证、代价与后续

本机 arm64 构建两镜像成功；四项基础设施均 healthy，初始化桶为 private，S3 合成对象写入、读取校验、删除通过。CI 增加 Linux 空卷启动检查，远程执行结果需另行确认。

首次构建需要网络下载 Go 依赖，固定源码不等于已完成漏洞审计或永久安全；APK/Go 依赖仍需独立供应链扫描，不能据源码固定声称字节级可复现。基础镜像与源码升级须一起复核兼容和安全。官方仓库维护状态、许可证和生产使用方案仍需在发布前审查，本 ADR 只解决本地可获取性。
