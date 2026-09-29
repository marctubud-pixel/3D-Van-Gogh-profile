# MY WORLD

Three.js (React Three Fiber) 可探索个人主页 + 内容后台，基于《MY WORLD Development Document v1.4》。

## 运行

```bash
npm install
npm run dev          # 前端 http://localhost:5173 ，API http://localhost:3001
```

生产：

```bash
npm run build
ADMIN_PASSWORD=你的密码 npm start   # 同时提供 API 与 dist 静态文件，默认端口 3001（PORT 可覆盖）
```

## 路由

| 路径 | 说明 |
| --- | --- |
| `/` | Welcome |
| `/explore` | 3D Mini-Planet（W/S/A/D 骑行，E 停车/互动，M 地图，ESC 关闭） |
| `/index` | INDEX 快速浏览作品（移动端 / WebGL 失败回退） |
| `/info` | INFO / CV |
| `/map` | 地图 |
| `/project/:id` | 作品深链接 |
| `/admin` | 后台（默认密码 `admin`，请通过 `ADMIN_PASSWORD` 修改） |

## 后台

- 个人资料 / INFO：名字、标语、简介、技能、经历、链接、头像、CV 文件
- 功能区块 / LANDMARKS：7 个地标的名称、问题、描述、区域、颜色、球面坐标
- 作品 / PROJECTS：所属地标、分类、Case Study、封面、视频（上传或 YouTube/Vimeo/Bilibili 链接）、图集、文档（PDF 内嵌预览）、发布/精选
- 媒体库 / MEDIA：拖拽上传图片、视频、文档、音频、GLB

数据保存在 `storage/content.json`、`storage/assets.json`，上传文件在 `storage/uploads/`（可用 `STORAGE_DIR` 修改，`MAX_UPLOAD_MB` 限制大小，默认 500）。
