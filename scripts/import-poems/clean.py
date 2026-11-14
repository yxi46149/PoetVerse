#!/usr/bin/env python3
"""
PoetVerse 诗词数据清洗导入脚本

数据源：chinese-poetry/chinese-poetry（古典公版诗词，license 记 PD）
流程：下载原始 JSON → 字段映射 → 繁转简 → 体裁推导 → 自动标签 → 去重
     → 输出清洗后 JSON（可选：直接写入 PostgreSQL）

用法：
    python clean.py                          # 清洗唐诗+宋词，输出到 data/clean/
    python clean.py --dirs tang              # 只清洗唐诗
    python clean.py --limit 2000             # 每个来源最多处理 N 条（调试用）
    python clean.py --to-postgres "$DATABASE_URL"   # 同时写入 PostgreSQL
    python clean.py --no-download            # 只用本地 data/raw/ 缓存

产出：
    data/raw/      原始 JSON 缓存（git 忽略）
    data/clean/authors.json
    data/clean/poems.json   # 每条含 tags: [...]
    data/sample.poems.json  # 30 条样例（可提交到仓库）
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import uuid

try:
    from opencc import OpenCC
except ImportError:
    sys.exit('缺少依赖：pip install -r requirements.txt')

CC = OpenCC('t2s')
TODAY = datetime.date.today().isoformat()
REPO = 'chinese-poetry/chinese-poetry'
RAW_BASE = f'https://raw.githubusercontent.com/{REPO}/master'
API_BASE = f'https://api.github.com/repos/{REPO}/contents'

SOURCES = {
    'tang': {
        'dir': '全唐诗', 'file_prefix': 'poet.tang.', 'dynasty': '唐',
        'authors_file': '全唐诗/authors.tang.json', 'kind': 'shi',
    },
    'song': {
        'dir': '全唐诗', 'file_prefix': 'poet.song.', 'dynasty': '宋',
        'authors_file': '全唐诗/authors.song.json', 'kind': 'shi',
    },
    'songci': {
        'dir': '宋词', 'file_prefix': 'ci.song.', 'dynasty': '宋',
        'authors_file': '宋词/author.song.json', 'kind': 'ci',
    },
    'yuanqu': {
        'files': ['元曲/yuanqu.json'], 'dynasty': '元', 'kind': 'qu',
    },
    'huajianji': {
        'files': [f'五代诗词/huajianji/huajianji-{n}-juan.json'
                  for n in (1, 2, 3, 4, 5, 6, 7, 8, 9, 'x')],
        'dynasty': '五代', 'kind': 'ci5',
    },
    'nantang': {
        'files': ['五代诗词/nantang/poetrys.json'], 'dynasty': '五代',
        'authors_file': '五代诗词/nantang/authors.json', 'kind': 'ci5',
    },
    'shijing': {
        'files': ['诗经/shijing.json'], 'dynasty': '先秦', 'kind': 'shijing',
    },
    'chuci': {
        'files': ['楚辞/chuci.json'], 'dynasty': '先秦', 'kind': 'chuci',
    },
    'caocao': {
        'files': ['曹操诗集/caocao.json'], 'dynasty': '汉末', 'kind': 'caocao',
    },
    'nalan': {
        'files': ['纳兰性德/纳兰性德诗集.json'], 'dynasty': '清', 'kind': 'nalan',
    },
}

ALL_SOURCES = list(SOURCES)

PUNCT = '，。、；：？！…—·「」『』（）()《》〈〉.,!?;:"\'、 \u3000\t\r\n'


# ---------------------------------------------------------------- 标签规则
# 关键词命中的自动标签（保守规则，source 记 auto，人工可复核修改）
TAG_RULES: list[tuple[str, list[str]]] = [
    ('山水', ['青山', '绿水', '山水', '江山', '湖光', '山色', '溪流']),
    ('田园', ['田园', '农家', '茅屋', '桑麻', '鸡豚', '村庄', '耕田']),
    ('思乡', ['故乡', '乡愁', '思乡', '家书', '望乡', '故园', '归乡']),
    ('离别', ['送别', '离别', '饯别', '告别', '惜别', '赠别']),
    ('怀人', ['怀人', '怀念', '思念', '寄友', '怀旧', '忆旧']),
    ('孤寂', ['孤舟', '孤独', '寂寞', '寂寥', '孤身', '空山', '独钓']),
    ('壮阔', ['壮阔', '豪迈', '边塞', '沙场', '万里', '气吞', '建功立业']),
    ('伤怀', ['伤怀', '悲秋', '哀伤', '叹息', '悼亡', '流泪', '哭']),
    ('闲适', ['闲适', '悠然', '隐居', '垂钓', '闲居', '醉卧']),
    ('怀古', ['怀古', '古迹', '兴亡', '千古', '遗迹']),
    ('咏物', ['咏梅', '咏竹', '咏菊', '咏柳', '梅花', '幽兰', '翠竹', '秋菊']),
    ('月夜', ['明月', '月夜', '嫦娥', '婵娟', '中秋', '月色', '望月', '月下', '月']),
    ('春景', ['春风', '桃花', '杨柳', '春雨', '春色', '踏青']),
    ('秋意', ['秋风', '落叶', '秋霜', '鸿雁', '秋月', '秋色', '霜']),
    ('冬景', ['冬雪', '冰雪', '寒冬', '腊月', '雪夜', '雪']),
    ('登高', ['登高', '登楼', '登山', '凭栏', '望远']),
    ('新岁', ['新年', '元日', '除夕', '春节', '爆竹', '贺岁']),
    ('爱情', ['相思', '闺怨', '红豆', '结发']),
    ('哲理', ['禅意', '悟道', '玄理', '理趣', '禅心']),
]

# 单字关键词的否定词：仅以这些复合词形式出现时不算命中
NEGATIVE = {
    '月': ['岁月', '日月'],
    '雪': [],
    '霜': [],
}


def auto_tags(title: str, content: str, limit: int = 4) -> list[str]:
    text = title + content
    scored: list[tuple[int, str]] = []
    for tag, keywords in TAG_RULES:
        best = 0
        for kw in keywords:
            hit = kw in text
            if hit and len(kw) == 1:
                # 单字关键词：排除否定复合词后仍命中才算
                stripped = text
                for neg in NEGATIVE.get(kw, []):
                    stripped = stripped.replace(neg, '')
                hit = kw in stripped
            if hit:
                best = max(best, len(kw))
        if best:
            scored.append((best, tag))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [t for _, t in scored[:limit]]


# ---------------------------------------------------------------- 工具
def build_url(url: str, proxy_prefix: str = '') -> str:
    """把 upstream URL（含中文路径）转成最终下载地址。"""
    parts = urllib.parse.urlsplit(url)
    final = urllib.parse.urlunsplit(
        (parts.scheme, parts.netloc, urllib.parse.quote(parts.path),
         parts.query, parts.fragment))
    if proxy_prefix:
        final = proxy_prefix.rstrip('/') + '/' + final
    return final


def download(url: str, dest: str, proxy_prefix: str = '') -> None:
    if os.path.exists(dest):
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(build_url(url, proxy_prefix),
                                 headers={'User-Agent': 'PoetVerse-import/1.0'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r, open(dest, 'wb') as f:
                f.write(r.read())
            return
        except Exception as e:
            if attempt == 2:
                raise RuntimeError(f'下载失败 {url}: {e}')


def url_exists(url: str, proxy_prefix: str) -> bool:
    req = urllib.request.Request(build_url(url, proxy_prefix), method='HEAD',
                                 headers={'User-Agent': 'PoetVerse-import/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200
    except Exception:
        return False


def list_source_files(source: dict, proxy_prefix: str = '') -> list[dict]:
    """列出某来源的数据文件。
    files 型来源直接用配置里写死的路径；prefix 型优先 GitHub API，
    失败时按序号探测。返回 [{name, download_url, rel_path}]。"""
    if 'files' in source:
        return [{'name': os.path.basename(p),
                 'download_url': f"{RAW_BASE}/{p}", 'rel_path': p}
                for p in source['files']]
    try:
        url = f"{API_BASE}/{urllib.parse.quote(source['dir'])}"
        req = urllib.request.Request(url, headers={'User-Agent': 'PoetVerse-import/1.0'})
        with urllib.request.urlopen(req, timeout=60) as r:
            items = json.load(r)
        return [{'name': i['name'], 'download_url': i['download_url'],
                 'rel_path': f"{source['dir']}/{i['name']}"}
                for i in items
                if i['type'] == 'file' and i['name'].startswith(source['file_prefix'])
                and i['name'].endswith('.json')]
    except Exception as e:
        print(f'  GitHub API 不可用（{e}），改用序号探测', flush=True)
    # 序号探测：prefix + N.json，N 按 1000 递增，连续 3 个 404 即停
    files, n, misses = [], 0, 0
    while misses < 3:
        fname = f"{source['file_prefix']}{n}.json"
        dl = f"{RAW_BASE}/{source['dir']}/{fname}"
        if url_exists(dl, proxy_prefix):
            files.append({'name': fname, 'download_url': dl,
                          'rel_path': f"{source['dir']}/{fname}"})
            misses = 0
        else:
            misses += 1
        n += 1000
    return files


def normalize(text: str) -> str:
    return re.sub(f'[{re.escape(PUNCT)}]', '', text)


def derive_form(paragraphs: list[str]) -> str:
    # 先把每段按标点拆成单句（全唐诗中一段常含两句，如"秦川雄帝宅，函谷壮皇居。"）
    sentences: list[str] = []
    for p in paragraphs:
        for part in re.split(r'[，。；？！、]', p):
            s = part.strip()
            if s:
                sentences.append(s)
    lens = [sum(1 for ch in s if '一' <= ch <= '鿿') for s in sentences]  # CJK: U+4E00–U+9FFF
    if not lens or any(l == 0 for l in lens):
        return '古体诗'
    n = len(lens)
    if all(l == 5 for l in lens):
        return '五言绝句' if n == 4 else '五言律诗' if n == 8 else '五言古诗'
    if all(l == 7 for l in lens):
        return '七言绝句' if n == 4 else '七言律诗' if n == 8 else '七言古诗'
    return '古体诗'


# ---------------------------------------------------------------- 清洗
def extract(raw: dict, meta: dict) -> tuple[str, str, list[str], str] | None:
    """把各来源的原始记录统一成 (author, title, paragraphs, form)。
    form 为 '' 表示走通用推导。"""
    kind = meta['kind']
    if kind == 'shi':  # 唐诗 / 宋诗：{author, title, paragraphs}
        return ((raw.get('author') or '').strip(),
                (raw.get('title') or '').strip(),
                raw.get('paragraphs') or [], '')
    if kind == 'ci':  # 宋词：{author, paragraphs, rhythmic}
        return ((raw.get('author') or '').strip(),
                (raw.get('rhythmic') or '').strip(),
                raw.get('paragraphs') or [], '宋词')
    if kind == 'ci5':  # 五代词：{author, title, paragraphs, rhythmic, notes}
        title = (raw.get('title') or '').strip()
        if not title:
            title = (raw.get('rhythmic') or '').strip()
        return ((raw.get('author') or '').strip(), title,
                raw.get('paragraphs') or [], '词')
    if kind == 'qu':  # 元曲：{dynasty, author, title, paragraphs}
        title = (raw.get('title') or '').strip()
        paras = raw.get('paragraphs') or []
        # 约 1.3% 的记录正文被并进 title（如 "尾・对着盏半明不灭…"），拆出来
        if not paras and '・' in title:
            head, _, tail = title.partition('・')
            if any(p in tail for p in '，。？！'):
                title, paras = head, [tail]
        return ((raw.get('author') or '').strip(), title, paras, '元曲')
    if kind == 'shijing':  # 诗经：{title, chapter, section, content}，无作者
        return ('佚名', (raw.get('title') or '').strip(),
                raw.get('content') or [], '诗经')
    if kind == 'chuci':  # 楚辞：{title, section, author, content}
        return ((raw.get('author') or '').strip(),
                (raw.get('title') or '').strip(),
                raw.get('content') or [], '楚辞')
    if kind == 'caocao':  # 曹操诗集：{title, paragraphs}，无作者字段
        return ('曹操', (raw.get('title') or '').strip(),
                raw.get('paragraphs') or [], '')
    if kind == 'nalan':  # 纳兰性德：{title, para, author}
        title = (raw.get('title') or '').strip()
        form = '词' if '·' in title else ''
        return ((raw.get('author') or '').strip(), title,
                raw.get('para') or [], form)
    raise ValueError(f'unknown kind: {kind}')


def clean_record(raw: dict, meta: dict, rel_path: str) -> dict | None:
    ext = extract(raw, meta)
    if not ext:
        return None
    author, title, paragraphs, fixed_form = ext
    if not author or not title or not paragraphs:
        return None

    author_s = CC.convert(author)
    title_s = CC.convert(title)
    paras_s = [CC.convert(p.strip()) for p in paragraphs if p and p.strip()]
    if not paras_s:
        return None
    content = '\n'.join(paras_s)
    normalized = normalize(content)
    dedup_hash = hashlib.sha256(
        f'{author_s}\n{title_s}\n{normalized}'.encode('utf-8')).hexdigest()
    return {
        'title': title_s,
        'author_name': author_s,
        'dynasty': meta['dynasty'],
        'form': fixed_form or derive_form(paras_s),
        'content': content,
        'normalized_content': normalized,
        'dedup_hash': dedup_hash,
        'tags': auto_tags(title_s, content),
        'source': REPO,
        'source_url': f'https://github.com/{REPO}/blob/master/{rel_path}',
        'license': 'PD',
        'edition': '',
        'imported_at': TODAY,
    }


def parse_authors(source: dict, raw_dir: str, proxy_prefix: str = '') -> dict[tuple[str, str], str | None]:
    """返回 {(name, dynasty): bio}，简介已转简体。"""
    path = os.path.join(raw_dir, os.path.basename(source['authors_file']))
    download(f"{RAW_BASE}/{source['authors_file']}", path, proxy_prefix)
    data = json.load(open(path, encoding='utf-8'))
    out: dict[tuple[str, str], str | None] = {}
    for entry in data:
        if isinstance(entry, dict):  # 唐：{name, desc}
            name = CC.convert((entry.get('name') or '').strip())
            bio = (entry.get('desc') or '').strip()
        else:  # 宋词："苏轼：(1037-1101) 北宋文学家……"
            text = str(entry).strip()
            name, sep, bio = text.partition('：')
            name = CC.convert(name.strip())
            bio = bio.strip() if sep else ''
        if not name:
            continue
        out[(name, source['dynasty'])] = CC.convert(bio) if bio else None
    return out


def clean_source(key: str, args, raw_dir: str) -> tuple[list[dict], dict[tuple[str, str], str | None], dict]:
    meta = SOURCES[key]
    files = list_source_files(meta, args.proxy_prefix)
    print(f'[{key}] {len(files)} 个文件', flush=True)
    poems: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    stats = {'raw': 0, 'dropped': 0, 'dup': 0}
    for i, f in enumerate(files):
        fname = f['name']
        dest = os.path.join(raw_dir, key, fname)
        try:
            download(f['download_url'], dest, args.proxy_prefix)
        except Exception as e:
            print(f'  [警告] 跳过下载失败的文件 {fname}：{e}', flush=True)
            continue
        for raw in json.load(open(dest, encoding='utf-8')):
            stats['raw'] += 1
            rec = clean_record(raw, meta, f['rel_path'])
            if not rec:
                stats['dropped'] += 1
                continue
            dedup_key = rec['dedup_hash']
            if dedup_key in seen:
                stats['dup'] += 1
                continue
            seen.add(dedup_key)
            poems.append(rec)
            if args.limit and len(poems) >= args.limit:
                break
        if args.limit and len(poems) >= args.limit:
            break
        if (i + 1) % 10 == 0:
            print(f'  ... {i + 1}/{len(files)}', flush=True)
    authors = (parse_authors(meta, raw_dir, args.proxy_prefix)
               if 'authors_file' in meta else {})
    return poems, authors, stats


# ---------------------------------------------------------------- 入库（MySQL）
def parse_mysql_dsn(dsn: str) -> dict:
    p = urllib.parse.urlparse(dsn)
    if p.scheme not in ('mysql',):
        raise ValueError('DSN 形如 mysql://user:pass@host:3306/dbname')
    return {
        'host': p.hostname or '127.0.0.1',
        'port': p.port or 3306,
        'user': p.username or 'root',
        'password': p.password or '',
        'database': p.path.lstrip('/') or 'poetverse',
        'charset': 'utf8mb4',
    }


def load_mysql(dsn: str, schema_path: str, authors, poems) -> None:
    import pymysql
    schema = open(schema_path, encoding='utf-8').read()
    conn = pymysql.connect(**parse_mysql_dsn(dsn))
    try:
        with conn.cursor() as cur:
            for stmt in [x.strip() for x in schema.split(';') if x.strip()]:
                cur.execute(stmt)
            batch_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO import_batches (id, source, file_name, total, operator)"
                " VALUES (%s, %s, %s, %s, %s)",
                (batch_id, REPO, 'clean.py', len(poems), 'script'),
            )
            # 作者
            for (n, d), b in authors.items():
                cur.execute(
                    """INSERT INTO authors (id, name, dynasty, bio, source)
                       VALUES (%s, %s, %s, %s, %s)
                       ON DUPLICATE KEY UPDATE id = id""",
                    (str(uuid.uuid4()), n, d, b, REPO),
                )
            # id 映射只从 DB 取（防止异体字在 utf8mb4_unicode_ci 下
            # 触发唯一键冲突、导致 Python 侧预生成的 id 悬空）
            cur.execute("SELECT id, name, dynasty FROM authors")
            author_ids: dict[tuple[str, str], str | None] = {
                (n, d): i for i, n, d in cur.fetchall()
            }
            # 异体字作者名：用 DB 自己的 collation 做二次解析
            missing = {(p['author_name'], p['dynasty']) for p in poems} - set(author_ids)
            for n, d in missing:
                cur.execute(
                    "SELECT id FROM authors WHERE name = %s AND dynasty = %s",
                    (n, d),
                )
                row = cur.fetchone()
                author_ids[(n, d)] = row[0] if row else None
            if missing:
                print(f'  异体字作者名解析：{len(missing)} 个', flush=True)
            # 标签
            all_tags = sorted({t for p in poems for t in p['tags']})
            for t in all_tags:
                cur.execute(
                    "INSERT INTO tags (id, name, source) VALUES (%s, %s, 'auto')"
                    " ON DUPLICATE KEY UPDATE id = id",
                    (str(uuid.uuid4()), t),
                )
            cur.execute("SELECT id, name FROM tags")
            tag_ids = {n: i for i, n in cur.fetchall()}
            # 诗词
            poem_rows = []
            poem_ids: dict[str, str] = {}
            for p in poems:
                pid = str(uuid.uuid4())
                poem_ids[p['dedup_hash']] = pid
                poem_rows.append((
                    pid, p['title'], author_ids.get((p['author_name'], p['dynasty'])),
                    p['author_name'], p['dynasty'], p['form'], p['content'],
                    p['normalized_content'], p['dedup_hash'], p['source'],
                    p['source_url'], p['license'], p['edition'],
                    'published', p['imported_at']))
            poem_sql = (
                """INSERT INTO poems (id, title, author_id, author_name, dynasty,
                                      form, content, normalized_content, dedup_hash,
                                      source, source_url, license, edition,
                                      status, imported_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON DUPLICATE KEY UPDATE id = id""")
            for i in range(0, len(poem_rows), 1000):
                cur.executemany(poem_sql, poem_rows[i:i + 1000])
            # 已存在的诗词取回真实 id（用于补标签关联）
            hashes = list(poem_ids)
            for i in range(0, len(hashes), 1000):
                chunk = hashes[i:i + 1000]
                cur.execute(
                    "SELECT id, dedup_hash FROM poems WHERE dedup_hash IN ("
                    + ','.join(['%s'] * len(chunk)) + ")",
                    chunk,
                )
                for pid, h in cur.fetchall():
                    poem_ids[h] = pid
            # 关联标签
            links = []
            for p in poems:
                pid = poem_ids.get(p['dedup_hash'])
                if not pid:
                    continue
                for t in p['tags']:
                    links.append((pid, tag_ids[t], 'auto'))
            for i in range(0, len(links), 2000):
                cur.executemany(
                    "INSERT IGNORE INTO poem_tags (poem_id, tag_id, source)"
                    " VALUES (%s, %s, %s)",
                    links[i:i + 2000],
                )
            cur.execute(
                "UPDATE import_batches SET succeeded=%s, finished_at=NOW() WHERE id=%s",
                (len(poem_ids), batch_id),
            )
        conn.commit()
    finally:
        conn.close()
    print(f'入库完成：诗词 {len(poem_ids)} 条，标签关联 {len(links)} 条')


# ---------------------------------------------------------------- 主流程
def main() -> None:
    ap = argparse.ArgumentParser(description='PoetVerse 诗词数据清洗导入')
    ap.add_argument('--dirs', nargs='+', default=ALL_SOURCES,
                    choices=list(SOURCES), help='数据源（默认全部）')
    ap.add_argument('--limit', type=int, default=0, help='每个来源最多处理 N 条（调试用）')
    ap.add_argument('--no-download', action='store_true', help='只用本地 data/raw 缓存')
    ap.add_argument('--to-mysql', metavar='DSN', default='',
                    help='MySQL DSN，如 mysql://user:pass@localhost:3306/poetverse')
    ap.add_argument('--schema', default='../../db/schema.sql', help='schema.sql 路径')
    ap.add_argument('--proxy-prefix', default='',
                    help='下载代理前缀，如 https://gh-proxy.com（GitHub 直连被墙时用）')
    args = ap.parse_args()

    base = os.path.dirname(os.path.abspath(__file__))
    raw_dir = os.path.join(base, '..', '..', 'data', 'raw')
    clean_dir = os.path.join(base, '..', '..', 'data', 'clean')
    os.makedirs(clean_dir, exist_ok=True)

    if args.no_download and not os.path.isdir(raw_dir):
        sys.exit('data/raw 不存在，先正常运行一次以下载数据')

    all_poems: list[dict] = []
    all_authors: dict[tuple[str, str], str | None] = {}
    for key in args.dirs:
        poems, authors, stats = clean_source(key, args, raw_dir)
        print(f'[{key}] 原始 {stats["raw"]} → 清洗后 {len(poems)}'
              f'（丢弃 {stats["dropped"]}，去重 {stats["dup"]}）')
        all_poems.extend(poems)
        for k, v in authors.items():
            all_authors.setdefault(k, v)

    # 补上诗词作者缺失的简介（bio 为 NULL）
    for p in all_poems:
        all_authors.setdefault((p['author_name'], p['dynasty']), None)

    authors_out = [
        {'name': n, 'dynasty': d, 'bio': b, 'source': REPO,
         'source_url': f'https://github.com/{REPO}'}
        for (n, d), b in sorted(all_authors.items())
    ]
    json.dump(authors_out, open(os.path.join(clean_dir, 'authors.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    json.dump(all_poems, open(os.path.join(clean_dir, 'poems.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    json.dump(all_poems[:30], open(os.path.join(clean_dir, 'sample.poems.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)

    # 统计
    from collections import Counter
    print(f'\n合计：诗词 {len(all_poems)} 条，作者 {len(authors_out)} 位')
    print('体裁分布：', dict(Counter(p['form'] for p in all_poems)))
    tag_c = Counter(t for p in all_poems for t in p['tags'])
    print(f'标签覆盖：{sum(1 for p in all_poems if p["tags"])}/{len(all_poems)} 条有标签，'
          f'共 {len(tag_c)} 种')
    print('高频标签：', dict(tag_c.most_common(8)))
    print(f'输出目录：{clean_dir}')

    if args.to_mysql:
        load_mysql(args.to_mysql, os.path.join(base, args.schema),
                   all_authors, all_poems)


if __name__ == '__main__':
    main()
