#!/usr/bin/env python3
"""把 data/clean/*.json 转成可直接导入 MySQL 的 SQL 文件。

用途：服务器上没有 data/raw、也不想为了一次导入装 Python 依赖时，
在本机生成一份 SQL，传上去用 `mysql < seed.sql` 导入即可。

用法：
  python json2sql.py                                  # data/clean/poems.json + authors.json -> poetverse-seed.sql
  python json2sql.py --limit 5000                     # 只导前 5000 首（先验证链路）
  python json2sql.py --out poetverse-seed.sql.gz      # 按后缀自动 gzip
  python json2sql.py --poems ../../data/clean/sample.poems.json --no-authors --out sample.sql

生成的 SQL 可重复执行：作者按 (name, dynasty)、标签按 name、诗词按 dedup_hash 去重，
主键用 UUIDv5 从这些天然键推导，因此每次生成结果稳定，重复导入不会产生重复行。
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
import uuid
from datetime import datetime

REPO = 'chinese-poetry/chinese-poetry'
# 固定命名空间，保证同一份数据每次生成的 UUID 一致
NS = uuid.UUID('5f2b8c4e-1d3a-4b6f-9e07-2c1a3d4e5f60')

CHUNK = 500


def uuid5(kind: str, key: str) -> str:
    return str(uuid.uuid5(NS, f'{kind}:{key}'))


def sql_str(value) -> str:
    if value is None:
        return 'NULL'
    text = str(value)
    text = (
        text.replace('\\', '\\\\')
        .replace("'", "\\'")
        .replace('\n', '\\n')
        .replace('\r', '\\r')
        .replace('\x1a', '\\Z')
    )
    return "'" + text + "'"


def chunks(seq, size=CHUNK):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def values_sql(rows: list[tuple]) -> str:
    return ','.join('(' + ','.join(sql_str(v) for v in row) + ')' for row in rows)


def open_out(path: str):
    if path.endswith('.gz'):
        return gzip.open(path, 'wt', encoding='utf-8', compresslevel=6, newline='\n')
    return open(path, 'w', encoding='utf-8', newline='\n')


def main() -> int:
    ap = argparse.ArgumentParser(description='clean JSON -> MySQL INSERT 脚本')
    here = os.path.dirname(os.path.abspath(__file__))
    base = os.path.abspath(os.path.join(here, '..', '..'))
    ap.add_argument('--poems', default=os.path.join(base, 'data', 'clean', 'poems.json'))
    ap.add_argument('--authors', default=os.path.join(base, 'data', 'clean', 'authors.json'))
    ap.add_argument('--no-authors', action='store_true', help='不读 authors.json，poem.author_id 全部为 NULL')
    ap.add_argument('--out', default=os.path.join(base, 'poetverse-seed.sql'))
    ap.add_argument('--limit', type=int, default=0, help='只导前 N 首（调试用）')
    args = ap.parse_args()

    print(f'读取 {args.poems}', flush=True)
    with open(args.poems, encoding='utf-8') as fh:
        poems = json.load(fh)
    if args.limit:
        poems = poems[:args.limit]

    authors = {}
    if not args.no_authors and os.path.exists(args.authors):
        print(f'读取 {args.authors}', flush=True)
        with open(args.authors, encoding='utf-8') as fh:
            for a in json.load(fh):
                authors[(a['name'], a['dynasty'])] = a

    # 诗词里出现、但 authors.json 没收录的作者：保持 author_id 为 NULL，只留冗余作者名
    author_ids = {key: uuid5('author', f'{key[0]}\x00{key[1]}') for key in authors}

    tag_names = sorted({t for p in poems for t in (p.get('tags') or [])})
    tag_ids = {t: uuid5('tag', t) for t in tag_names}

    out_path = args.out
    print(f'写出 {out_path}（诗词 {len(poems)}、作者 {len(authors)}、标签 {len(tag_names)}）', flush=True)

    matched = 0
    with open_out(out_path) as out:
        out.write('-- PoetVerse 数据导入脚本\n')
        out.write(f'-- 生成时间：{datetime.now().isoformat(timespec="seconds")}\n')
        out.write(f'-- 作者 {len(authors)} 条、诗词 {len(poems)} 条、标签 {len(tag_names)} 个\n')
        out.write('-- 用法：docker exec -i mysql mysql -uroot -p poetverse < 本文件\n\n')
        out.write("SET NAMES utf8mb4;\n")
        out.write("SET sql_mode = 'NO_ENGINE_SUBSTITUTION';\n\n")

        # 作者
        if authors:
            rows = [
                (uuid5('author', f'{n}\x00{d}'), a['name'], a['dynasty'], a.get('bio'),
                 a.get('source') or REPO, a.get('source_url'))
                for (n, d), a in authors.items()
            ]
            for part in chunks(rows):
                out.write(
                    'INSERT INTO authors (id, name, dynasty, bio, source, source_url) VALUES\n'
                    + values_sql(part) + '\nON DUPLICATE KEY UPDATE id = id;\n'
                )
            out.write('\n')

        # 标签
        if tag_names:
            for part in chunks([(tag_ids[t], t, 'auto') for t in tag_names]):
                out.write(
                    'INSERT INTO tags (id, name, source) VALUES\n'
                    + values_sql(part) + '\nON DUPLICATE KEY UPDATE id = id;\n'
                )
            out.write('\n')

        # 诗词：author_id 一律写 NULL，导入后用 UPDATE 按 (name, dynasty) 回填。
        # 原因：作者表的 id 在 MySQL 侧可能因 (name, dynasty) 唯一键的存在而被 ON DUPLICATE
        # 保留旧值，Python 侧预算的 uuid 就会悬空，撞外键约束。回填走数据库自己的比较规则，最稳。
        poem_rows = []
        for p in poems:
            poem_rows.append((
                uuid5('poem', p['dedup_hash']), p['title'], None,
                p['author_name'], p['dynasty'], p['form'], p['content'],
                p['normalized_content'], p['dedup_hash'], p.get('source') or REPO,
                p.get('source_url'), p.get('license') or 'PD', p.get('edition') or '',
                'published', p.get('imported_at'),
            ))
        for part in chunks(poem_rows):
            out.write(
                'INSERT INTO poems (id, title, author_id, author_name, dynasty, form, content,'
                ' normalized_content, dedup_hash, source, source_url, license, edition,'
                ' status, imported_at) VALUES\n'
                + values_sql(part) + '\nON DUPLICATE KEY UPDATE id = id;\n'
            )
        out.write('\n')

        out.write(
            '-- 按 (name, dynasty) 用数据库自身的比较规则回填 author_id，'
            '避免 Python 侧预算的 uuid 与库里已有作者 id 不一致\n'
            'UPDATE poems p JOIN authors a\n'
            '   ON a.name = p.author_name AND a.dynasty = p.dynasty\n'
            '   SET p.author_id = a.id\n'
            ' WHERE p.author_id IS NULL;\n\n'
        )

        # 诗词-标签关联
        links = []
        for p in poems:
            pid = uuid5('poem', p['dedup_hash'])
            for t in (p.get('tags') or []):
                links.append((pid, tag_ids[t], 'auto'))
        for part in chunks(links):
            out.write(
                'INSERT IGNORE INTO poem_tags (poem_id, tag_id, source) VALUES\n'
                + values_sql(part) + ';\n'
            )
        out.write('\n')

        # 导入批次记录
        out.write(
            'INSERT INTO import_batches (id, source, file_name, total, succeeded,'
            ' started_at, finished_at, operator) VALUES\n'
            + values_sql([(
                str(uuid.uuid4()), REPO, os.path.basename(out_path),
                len(poems), len(poems), datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'), 'json2sql',
            )]) + ';\n'
        )

    size = os.path.getsize(out_path)
    matched = sum(1 for p in poems if (p['author_name'], p['dynasty']) in author_ids)
    print(f'完成：{out_path}（{size / 1024 / 1024:.1f} MB），可回填作者 {matched}/{len(poems)} 首', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
