#!/usr/bin/env bash
# 一次性导入 PoetVerse 诗词数据。幂等：可以重复执行，已存在的行会跳过。
#
# 用法（在服务器上，仓库根目录）：
#   bash deploy/import-seed.sh
#   bash deploy/import-seed.sh /opt/PoetVerse/poetverse-seed.sql.gz /root/poetverse.dbpass
#
# 前置：poetverse-seed.sql.gz 已上传到 /opt/PoetVerse/，
#       MySQL 容器名为 mysql，应用库 poetverse，应用账号 poetverse，密码在 /root/poetverse.dbpass。

set -euo pipefail

SEED="${1:-$(cd "$(dirname "$0")/.." && pwd)/poetverse-seed.sql.gz}"
PASSFILE="${2:-/root/poetverse.dbpass}"
EXPECTED_SHA="f39bc35f8b0e137b7712c64f29229a926e86d160f98bceedc9f1acf5cd52f21b"
CONTAINER="mysql"
DB="poetverse"
DB_USER="poetverse"

[ -f "$SEED" ] || { echo "找不到种子文件：$SEED"; exit 1; }
[ -f "$PASSFILE" ] || { echo "找不到密码文件：$PASSFILE"; exit 1; }
docker inspect -f '{{.State.Running}}' "$CONTAINER" >/dev/null 2>&1 \
  || { echo "容器 $CONTAINER 不存在，先 docker compose up -d"; exit 1; }

echo "==> 1/4 校验文件完整性（防止上传被截断）"
ACTUAL_SHA="$(sha256sum "$SEED" | awk '{print $1}')"
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
  echo "sha256 不匹配，文件没传完整："
  echo "  实际 $ACTUAL_SHA"
  echo "  期望 $EXPECTED_SHA"
  echo "重新上传：scp -C poetverse-seed.sql.gz root@服务器:/opt/PoetVerse/"
  exit 1
fi
gunzip -t "$SEED" || { echo "gzip 校验失败，重新上传"; exit 1; }
echo "    文件完整（$(du -h "$SEED" | cut -f1)）"

DB_PASS="$(cat "$PASSFILE")"
run_sql() {
  docker exec -i "$CONTAINER" mysql -u"$DB_USER" -p"$DB_PASS" "$DB" "$@"
}

echo "==> 2/4 导入数据（约 3-5 分钟；中断也没关系，重跑会接着导）"
{
  echo "SET FOREIGN_KEY_CHECKS=0;"
  gunzip -c "$SEED"
} | docker exec -i "$CONTAINER" mysql -u"$DB_USER" -p"$DB_PASS" "$DB"

echo "==> 3/4 按 (作者名, 朝代) 回填 author_id"
run_sql -e "
UPDATE poems p JOIN authors a
   ON a.name = p.author_name AND a.dynasty = p.dynasty
   SET p.author_id = a.id
 WHERE p.author_id IS NULL;"

echo "==> 4/4 核对"
run_sql -e "
SELECT
  (SELECT COUNT(*) FROM poems)     AS poems,
  (SELECT COUNT(*) FROM authors)   AS authors,
  (SELECT COUNT(*) FROM tags)      AS tags,
  (SELECT COUNT(*) FROM poem_tags) AS poem_tags,
  (SELECT COUNT(*) FROM poems WHERE author_id IS NULL) AS no_author;"

echo
echo "期望：poems=344670  authors=13787  tags=19  poem_tags≈十万  no_author=0"
echo "若 poems 不足，说明导入被中断，直接重跑本脚本即可。"
