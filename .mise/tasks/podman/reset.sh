#!/usr/bin/env bash
# mise description="Reset Postgres (stop, remove container and volume)"
set -euo pipefail

echo "🗑️  Resetting Postgres (this will delete all data)..."
read -p "Are you sure? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "❌ Reset cancelled"
  exit 0
fi

# Stop container if running
if podman ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
  echo "Stopping container..."
  podman stop "$POSTGRES_CONTAINER_NAME"
fi

# Remove container if exists
if podman ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
  echo "Removing container..."
  podman rm "$POSTGRES_CONTAINER_NAME"
fi

# Remove volume if exists
if podman volume ls --format '{{.Name}}' | grep -q "^${POSTGRES_VOLUME_NAME}$"; then
  echo "Removing volume (all data will be lost)..."
  podman volume rm "$POSTGRES_VOLUME_NAME"
fi

echo "✅ Reset complete. Run 'mise run podman:start' to create a fresh container."
