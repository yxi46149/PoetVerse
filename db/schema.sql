-- ============================================================
-- PoetVerse 数据库结构（MySQL 8.0+，字符集 utf8mb4）
-- 数据来源：chinese-poetry/chinese-poetry（古典公版诗词，license 记 PD）
-- 配套导入脚本：scripts/import-poems/clean.py
-- ============================================================

-- 作者
CREATE TABLE IF NOT EXISTS authors (
    id          CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()) COMMENT '作者记录唯一标识（UUID）',
    name        VARCHAR(64) NOT NULL COMMENT '作者姓名（简体）',
    dynasty     VARCHAR(16) NOT NULL COMMENT '作者所属朝代，如唐、宋',
    bio         MEDIUMTEXT COMMENT '作者简介（简体）；缺失时为 NULL',
    source      VARCHAR(128) NOT NULL DEFAULT 'chinese-poetry/chinese-poetry' COMMENT '作者数据来源标识',
    source_url  VARCHAR(512) COMMENT '作者数据来源地址',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
    UNIQUE KEY uniq_authors_name_dynasty (name, dynasty),
    KEY idx_authors_dynasty (dynasty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 诗词
CREATE TABLE IF NOT EXISTS poems (
    id                 CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()) COMMENT '诗词记录唯一标识（UUID）',
    title              VARCHAR(512) NOT NULL COMMENT '诗词标题或词牌名（简体）',
    author_id          CHAR(36) NULL COMMENT '关联作者 ID；未匹配作者时为 NULL',
    author_name        VARCHAR(64) NOT NULL COMMENT '作者姓名冗余字段，便于展示及保留原始署名',
    dynasty            VARCHAR(16) NOT NULL COMMENT '作品所属朝代，如唐、宋',
    form               VARCHAR(16) NOT NULL COMMENT '诗词体裁，如五言绝句、七言律诗、古体诗、宋词',
    content            MEDIUMTEXT NOT NULL COMMENT '诗词正文（简体），以换行符分隔诗句',
    normalized_content MEDIUMTEXT NOT NULL COMMENT '去除空白和标点后的正文，用于查重',
    dedup_hash         CHAR(64) NOT NULL COMMENT '基于作者、标题和规范化正文计算的 SHA-256 去重值',
    source             VARCHAR(128) NOT NULL DEFAULT 'chinese-poetry/chinese-poetry' COMMENT '诗词数据来源标识',
    source_url         VARCHAR(512) COMMENT '诗词数据来源地址',
    license            VARCHAR(32) NOT NULL DEFAULT 'PD' COMMENT '作品授权标识，PD 表示公有领域',
    edition            VARCHAR(128) NOT NULL DEFAULT '' COMMENT '作品所据版本或数据集标识',
    status             VARCHAR(16) NOT NULL DEFAULT 'published' COMMENT '发布状态：draft 草稿、published 已发布、archived 已归档',
    imported_at        DATE COMMENT '导入日期',
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后更新时间',
    UNIQUE KEY uniq_poems_dedup (dedup_hash),
    KEY idx_poems_dynasty (dynasty),
    KEY idx_poems_author_name (author_name),
    KEY idx_poems_form (form),
    KEY idx_poems_status (status),
    KEY idx_poems_dynasty_public (dynasty, status),
    KEY idx_poems_form_public (form, status),
    KEY idx_poems_author_public (author_name, status),
    KEY idx_poems_public_overview (status, author_id, imported_at),
    KEY idx_poems_public_latest (status, created_at DESC, id),
    CONSTRAINT fk_poems_author FOREIGN KEY (author_id)
        REFERENCES authors (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 标签（受控词表；自动标签 source='auto'，人工维护的记 'manual'）
CREATE TABLE IF NOT EXISTS tags (
    id          CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()) COMMENT '标签记录唯一标识（UUID）',
    name        VARCHAR(32) NOT NULL COMMENT '标签名称',
    source      VARCHAR(16) NOT NULL DEFAULT 'auto' COMMENT '标签来源：auto 自动生成、manual 人工维护',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    UNIQUE KEY uniq_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 诗词-标签关联
CREATE TABLE IF NOT EXISTS poem_tags (
    poem_id     CHAR(36) NOT NULL COMMENT '关联的诗词 ID',
    tag_id      CHAR(36) NOT NULL COMMENT '关联的标签 ID',
    source      VARCHAR(16) NOT NULL DEFAULT 'auto' COMMENT '关联来源：auto 自动打标、manual 人工维护',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '关联创建时间',
    PRIMARY KEY (poem_id, tag_id),
    KEY idx_poem_tags_tag (tag_id),
    CONSTRAINT fk_poem_tags_poem FOREIGN KEY (poem_id)
        REFERENCES poems (id) ON DELETE CASCADE,
    CONSTRAINT fk_poem_tags_tag FOREIGN KEY (tag_id)
        REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 导入批次（数据争议可追溯）
CREATE TABLE IF NOT EXISTS import_batches (
    id          CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()) COMMENT '导入批次唯一标识（UUID）',
    source      VARCHAR(128) NOT NULL COMMENT '本批次导入数据来源标识',
    file_name   VARCHAR(256) COMMENT '本批次导入的文件名',
    total       INT NOT NULL DEFAULT 0 COMMENT '本批次待处理记录总数',
    succeeded   INT NOT NULL DEFAULT 0 COMMENT '本批次成功处理记录数',
    failed      INT NOT NULL DEFAULT 0 COMMENT '本批次处理失败记录数',
    started_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '批次开始时间',
    finished_at DATETIME NULL COMMENT '批次结束时间；未完成时为 NULL',
    operator    VARCHAR(32) NOT NULL DEFAULT 'script' COMMENT '发起导入的操作者或程序标识'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
