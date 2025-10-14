#!/usr/bin/env bash
# mise description="View Postgres container logs"
set -euo pipefail

# Check if container exists
if ! podman ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
  echo "❌ Container does not exist. Run 'mise run podman:start' first."
  exit 1
fi

echo "📝 Postgres logs (press Ctrl+C to exit):"
echo "========================================"
podman logs -f "$POSTGRES_CONTAINER_NAME"
