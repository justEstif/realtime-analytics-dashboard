#!/usr/bin/env bash
# mise description="Check Postgres container status"
set -euo pipefail

echo "📊 Postgres Container Status"
echo "================================"

# Check if container exists and get status
if podman ps -a --filter "name=^${POSTGRES_CONTAINER_NAME}$" --format '{{.Status}}' | grep -q .; then
  STATUS=$(podman ps -a --filter "name=^${POSTGRES_CONTAINER_NAME}$" --format '{{.Status}}')

  if [[ "$STATUS" == Up* ]]; then
    echo "Status: ✅ Running"
    echo ""
    echo "Connection Info:"
    echo "  Host: $POSTGRES_HOST"
    echo "  Port: $POSTGRES_PORT"
    echo "  Database: $POSTGRES_DB"
    echo "  User: $POSTGRES_USER"
  else
    echo "Status: ⏸️  Stopped"
    echo ""
    echo "Run 'mise run podman:start' to start the container"
  fi
else
  echo "Status: ❌ Not created"
  echo ""
  echo "Run 'mise run podman:start' to create and start the container"
fi
