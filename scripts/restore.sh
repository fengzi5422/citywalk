#!/usr/bin/env bash
# 从备份恢复数据库（会短暂停止 api 服务）
# 用法：bash scripts/restore.sh backups/citywalk-20261104-193000.db
set -euo pipefail
cd "$(dirname "$0")/.."

src="${1:-}"
if [ -z "$src" ] || [ ! -f "$src" ]; then
  echo "用法：bash scripts/restore.sh <备份文件路径>"
  echo "现有备份："
  ls -1t backups/citywalk-*.db 2>/dev/null || echo "  （无）"
  exit 1
fi

echo "⚠ 恢复会用备份覆盖当前数据库，请先确认要恢复的文件：$src"
mkdir -p data

echo "→ 停止 api"
docker compose stop api
rm -f data/citywalk.db-wal data/citywalk.db-shm
cp "$src" data/citywalk.db

echo "→ 启动 api"
docker compose start api

for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:8080/api/health
echo ""
echo "✓ 恢复完成，建议核对账号与行程数据"
