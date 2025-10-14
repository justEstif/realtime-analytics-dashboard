#!/usr/bin/env bash
# mise description="Restart Postgres container"
set -euo pipefail

echo "🔄 Restarting Postgres container: $POSTGRES_CONTAINER_NAME"

# Check if container exists
if podman ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
  podman restart "$POSTGRES_CONTAINER_NAME"
  echo "✅ Container restarted successfully"
else
  echo "⚠️  Container does not exist. Use 'mise run podman:start' to create it."
  exit 1
fi
