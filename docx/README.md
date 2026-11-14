# PoetVerse 文档

## 阅读顺序

1. [古诗词数据收集指南](古诗词数据收集指南.md)：数据来源、授权与清洗规则。
2. [后端实现建议](后端实现建议.md)：当前后端结构、公开接口与后续开发范围。
3. [数据库说明](../db/README.md)：空库初始化和数据导入。

## 已定事项

- 数据库：MySQL 8，沿用 `db/schema.sql` 和已导入数据。
- 后端：`server/` 内独立的 ESM 项目，使用 NestJS 11 + Prisma 7。
- 前端：通过类型化服务调用 `/api`，开发时由 Vite 代理至 `localhost:8080`。
- 认证规划：JWT + HttpOnly Cookie；不在 `localStorage` 保存长期令牌。当前公开接口不包含后台登录和写入能力。
- 数据授权红线：只收录 PD 与兼容授权（CC BY / CC BY-SA / Apache-2.0）；排除 `non-commercial`、`in-copyright`、授权不明
- 去重键：作者 + 标题 + 规范化正文（不只用标题）

## 进行状态

- [x] 从 `chinese-poetry/chinese-poetry` 清洗数据并导入 MySQL。
- [x] 初始化 NestJS + Prisma + MySQL 公开只读 API。
- [x] 前端数据访问层和页面接入公开 API；运行时需配置数据库连接。
- [ ] 后台管理（登录、诗词 CRUD、导入预览）
- [ ] 收藏、阅读记录、推荐
