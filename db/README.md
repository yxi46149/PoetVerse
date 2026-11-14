# PoetVerse 数据库

## 初始化空库

仅在数据库尚未初始化时执行。已有导入数据的数据库可直接供后端读取，无需重新建表或导入。

```bash
mysql -u root -p -e "CREATE DATABASE poetverse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p poetverse < db/schema.sql
```

## 导入数据

```bash
cd scripts/import-poems
pip install -r requirements.txt
pip install pymysql   # 直连入库需要

# 方式一：执行 schema.sql、直连写入并记录导入批次
python clean.py --to-mysql "mysql://user:pass@localhost:3306/poetverse"

# 方式二：先清洗出 JSON，再用其他工具入库
python clean.py   # 产出 data/clean/authors.json、data/clean/poems.json
```

连接信息中的用户名、密码、地址和库名需替换为实际值。清洗脚本默认处理全部已配置来源，使用 `--dirs tang` 等参数可限定来源。

后端连接在 `server/.env` 的 `DATABASE_URL` 配置，字段映射见 `server/prisma/schema.prisma`。`npm run db:generate` 只生成客户端，不修改表或数据；后端启动不执行迁移或重置数据库。

## 查询索引

`schema.sql` 包含 `idx_poems_public_overview (status, author_id, imported_at)`，用于公开诗词数、作者数和最近导入日期的统计。此前创建的数据库可一次性执行 [补充索引脚本](migrations/20261021_public_query_index.sql)；已有同名索引时无需重复执行。脚本仅新增索引。

`idx_poems_public_latest (status, created_at DESC, id)` 用于最新排序和稳定分页。旧库可一次性执行 [最新排序索引脚本](migrations/20261021_public_latest_index.sql)，已有同名索引时无需重复执行。

`idx_poems_dynasty_public (dynasty, status)`、`idx_poems_form_public (form, status)` 和 `idx_poems_author_public (author_name, status)` 覆盖朝代、体裁或作者与发布状态的筛选统计，避免为计数回表读取正文。旧库可一次性执行 [筛选索引脚本](migrations/20261021_public_filter_indexes.sql)；执行前确认三个索引均不存在，已有索引时只补缺少的部分。脚本不删除现有索引。

## 表说明

| 表 | 内容 |
| --- | --- |
| `authors` | 作者（`name, dynasty` 唯一），`bio` 为简介（简体） |
| `poems` | 诗词正文，`dedup_hash` 唯一；由作者名、标题和规范化正文计算 SHA-256 |
| `tags` / `poem_tags` | 标签与关联，自动标签 `source='auto'` |
| `import_batches` | 每次导入的统计与追溯 |

公开 API 只查询 `status='published'` 的诗词。现有表不包含用户、管理员账号、收藏或阅读记录。

导入脚本遇到已有诗词时保留原记录，补充缺少的标签关联。批次 `succeeded` 包括已存在的匹配记录，不等于本次新增条数；当前脚本不单独记录逐条失败原因。

字段定义与采集 JSON 的对应关系见 [古诗词数据收集指南](../docx/古诗词数据收集指南.md)第三节，字段类型与约束以 `db/schema.sql` 为准。
