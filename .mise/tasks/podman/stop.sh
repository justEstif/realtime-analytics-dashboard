#!/usr/bin/env bash
# mise description="Stop Postgres container"
set -euo pipefail

echo "🛑 Stopping Postgres container: $POSTGRES_CONTAINER_NAME"

# Check if container exists and is running
if podman ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
  podman stop "$POSTGRES_CONTAINER_NAME"
  echo "✅ Container stopped successfully"
else
  if podman ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
    echo "⚠️  Container already stopped"
  else
    echo "⚠️  Container does not exist"
  fi
fi
