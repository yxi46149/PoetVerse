# 诗词数据清洗导入

把 `chinese-poetry/chinese-poetry` 的原始 JSON 清洗成 PoetVerse 标准记录，
可输出 JSON，也可直接写入 MySQL。

## 安装

```bash
pip install -r requirements.txt
# 需要直连 MySQL 时再加：
pip install pymysql
```

## 使用

```bash
# 清洗唐诗 + 宋词（默认），输出到 data/clean/
python clean.py

# 只看前 2000 条（调试）
python clean.py --limit 2000

# 直接写入 MySQL（先建库并执行 db/schema.sql，或让脚本自动建表）
python clean.py --to-mysql "mysql://root:123456@192.168.100.8:3306/poetverse"

# 断网复跑（用 data/raw/ 缓存）
python clean.py --no-download
```

## 清洗规则

| 项目 | 规则 |
| --- | --- |
| 繁简转换 | OpenCC `t2s`，标题 / 作者 / 正文 / 简介统一转简体 |
| 朝代 | 从来源推导：唐 / 宋 / 五代 / 元 / 先秦 / 汉末 / 清 |
| 诗体 | 宋词→宋词；五代词→词；元曲→元曲；诗经→诗经；楚辞→楚辞；其余按每句字数推导五言/七言绝句/律诗/古诗，杂言归古体诗 |
| 标题 | 词用词牌名（`rhythmic`），如"导引" |

## 数据源（默认全部，可用 `--dirs` 筛选）

| key | 目录 | 规模 | 说明 |
| --- | --- | --- | --- |
| `tang` | 全唐诗 `poet.tang.*` | ~5.8 万 | |
| `song` | 全唐诗 `poet.song.*` | ~25.4 万 | 宋诗，作者简介见 `authors.song.json` |
| `songci` | 宋词 `ci.song.*` | ~2.1 万 | |
| `yuanqu` | 元曲 `yuanqu.json` | ~1.1 万 | 自带朝代字段 |
| `huajianji` | 五代诗词 `huajianji-*-juan.json` | ~500 | 花间集，11 卷 |
| `nantang` | 五代诗词 `nantang/poetrys.json` | 45 | 南唐二主词 |
| `shijing` | 诗经 `shijing.json` | 305 | 无作者，记"佚名" |
| `chuci` | 楚辞 `chuci.json` | 65 | |
| `caocao` | 曹操诗集 `caocao.json` | 26 | 作者统一记"曹操" |
| `nalan` | 纳兰性德 `纳兰性德诗集.json` | 258 | 字段为 `para`；标题含词牌记"词" |

跳过：御定全唐诗（与唐诗同底本）、水墨唐诗（唐诗子集）、论语/四书五经/蒙学/幽梦影（非诗词）。
| 标签 | 关键词规则自动打标（`source='auto'`），人工可复核修改 |
| 去重 | 作者 + 标题 + 去空白标点的正文 |
| 作者简介 | 唐 `authors.tang.json` 的 `desc`；宋词解析 `author.song.json` 的"name：简介"格式；缺失记 NULL |

## 输出

- `data/clean/authors.json` — 作者（name/dynasty/bio）
- `data/clean/poems.json` — 诗词（含 tags 数组）
- `data/sample.poems.json` — 30 条样例

`data/raw/`（原始下载缓存）与 `data/clean/` 已加入 `.gitignore`，
不提交到仓库；样例文件可以提交。

## GitHub 直连被墙时

加  走代理下载。
