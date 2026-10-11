# webDemo · 第二版三端静态前端枢纽

> **静态演示 / 假数据**。不连正式 API，不能当作业务验收。

| 路径 | 说明 |
|---|---|
| [`index.html`](index.html) | 枢纽：选择移动端 / 学员网页 / 管理端 |
| [`mobile/`](mobile/) | 第二版移动端整机原型（自 `mockups/mobile` 同步） |
| [`learner-web/`](learner-web/) | 学员网页端独立桌面静态 demo（新建） |
| [`admin/`](admin/) | 管理端独立桌面静态 demo（自 `mockups/admin` 扩展） |

## 公网预览

- https://learn.clyune.com/webDemo/
- https://learn.clyunedev.com/webDemo/

服务器目录：`/srv/cloudstudy/static/webDemo/`  
Nginx：`location ^~ /webDemo/`（见 `infra/docker/clyunedev/nginx-webdemo.snippet.conf`）

## 本地预览

在仓库根：

```bash
python3 -m http.server 18283 --directory docs/06-design/v2-980plus/redesign/mockups
```

打开 `http://127.0.0.1:18283/webDemo/`。
