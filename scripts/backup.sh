#!/usr/bin/env bash
# 一致性备份：用 SQLite VACUUM INTO 在容器内生成快照，再拷到本机 backups/
# 用法：bash scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ts=$(date +%Y%m%d-%H%M%S)
mkdir -p backups

echo "→ 正在生成一致性快照（不会锁死在线服务）"
docker compose exec -T -e BACKUP_TS="$ts" api \
  node --experimental-sqlite --input-type=module -e '
    import { DatabaseSync } from "node:sqlite"
    const db = new DatabaseSync("/data/citywalk.db")
    const out = `/data/.backup-${process.env.BACKUP_TS}.db`
    db.exec(`VACUUM INTO "${out}"`)
    db.close()
    console.log("snapshot ok")
  '

docker compose cp "api:/data/.backup-${ts}.db" "backups/citywalk-${ts}.db"
docker compose exec -T api rm -f "/data/.backup-${ts}.db"

# 只保留最近 14 份
ls -1t backups/citywalk-*.db 2>/dev/null | tail -n +15 | while read -r old; do rm -f "$old"; done

echo "✓ 备份完成：backups/citywalk-${ts}.db"
ls -lh "backups/citywalk-${ts}.db"
