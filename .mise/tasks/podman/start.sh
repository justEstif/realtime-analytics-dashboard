#!/usr/bin/env bash
# mise description="Start Postgres container"
set -euo pipefail

echo "🚀 Starting Postgres container: $POSTGRES_CONTAINER_NAME"

# Check if container exists
if podman ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
  # Container exists, check if it's running
  if podman ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
    echo "✅ Container is already running"
    exit 0
  else
    echo "▶️  Starting existing container..."
    podman start "$POSTGRES_CONTAINER_NAME"
    echo "✅ Container started successfully"
  fi
else
  # Container doesn't exist, create and run it
  echo "📦 Creating new Postgres container..."
  podman run -d \
    --name "$POSTGRES_CONTAINER_NAME" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -p "${POSTGRES_PORT}:5432" \
    -v "${POSTGRES_VOLUME_NAME}:/var/lib/postgresql/data" \
    postgres:16

  echo "✅ Container created and started successfully"
  echo "📍 Connection details:"
  echo "   Host: $POSTGRES_HOST"
  echo "   Port: $POSTGRES_PORT"
  echo "   Database: $POSTGRES_DB"
  echo "   User: $POSTGRES_USER"
fi
