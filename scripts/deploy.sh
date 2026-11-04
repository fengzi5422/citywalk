#!/usr/bin/env bash
# 一键部署 / 升级：检查配置 → 构建 → 启动 → 健康检查
# 用法：bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "✗ 缺少 .env，请先：cp .env.example .env 并填写 JWT_SECRET"
  exit 1
fi

secret=$(grep -E '^JWT_SECRET=' .env | head -1 | sed 's/^JWT_SECRET=//' | tr -d "\"' \r")
if [ "${#secret}" -lt 32 ]; then
  echo "✗ JWT_SECRET 未设置或少于 32 字符（生产环境会拒绝启动）"
  echo "  生成方式：openssl rand -hex 32"
  exit 1
fi

echo "→ 构建镜像"
docker compose build

echo "→ 启动服务"
docker compose up -d

echo "→ 等待健康检查"
ok=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
if [ "$ok" -ne 1 ]; then
  echo "✗ 健康检查未通过，最近日志："
  docker compose logs --tail=40 api web
  exit 1
fi

echo "→ 服务状态"
docker compose ps
echo ""
curl -fsS http://127.0.0.1:8080/api/health
echo ""
echo "✓ 部署完成：http://127.0.0.1:8080"
echo "  建议随后执行一次备份：bash scripts/backup.sh"
