# Phase 5 Quick Start Guide

## 30-Second Overview

Phase 5 adds a **queue-based event processing system** to handle high-volume analytics data. Instead of writing events directly to the database, they're queued in Redis and processed by background workers.

**Key insight**: The API returns instantly (202 Accepted), while workers process events asynchronously in the background.

## Setup (2 minutes)

### 1. Start Infrastructure
```bash
# Terminal 1: Start PostgreSQL
mise run postgres:start

# Terminal 2: Start Redis
mise run redis:start
```

### 2. Apply Database Migration
```bash
# Terminal 3: Apply the new aggregates table
bun drizzle-kit push
```

### 3. Start the Application
```bash
# Terminal 4: Start the server
bun run dev:js
```

You'll see:
```
🚀 Initializing background workers...
✅ Background workers initialized
[Worker event-worker-0] Starting event processor
[Worker event-worker-1] Starting event processor
[Worker event-worker-2] Starting event processor
[Worker event-worker-3] Starting event processor
[Worker aggregation-worker-0] Starting aggregation processor
[retention-worker] Starting retention processor
```

## Test It Out (2 minutes)

### Submit Events
```bash
# Submit 10 events rapidly
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/events \
    -H "Content-Type: application/json" \
    -d '{
      "data": {
        "type": "events",
        "attributes": {
          "event_type": "page_view",
          "metadata": {"page": "/home", "userId": "'$i'"}
        }
      }
    }'
  echo ""
done
```

You'll get **202 Accepted** responses instantly (not 201 Created like before).

### Watch Real-Time Updates
```bash
# Open in another terminal - you'll see events flowing
curl http://localhost:3000/api/sse/dashboard
```

### Check System Health
```bash
curl http://localhost:3000/api/health | jq .
```

Response shows:
- Queue metrics (total submitted, processed, failed)
- Redis status
- Processing rate

## How It Works

### The Event Journey

```
1. POST /api/events (your code)
   ↓
2. Enqueue in Redis (instant, returns 202)
   ↓
3. Event Worker picks it up
   ↓
4. Validate & store in PostgreSQL
   ↓
5. Publish "event-processed" to Redis pub/sub
   ↓
6. SSE endpoint sends update to dashboard
   ↓
7. Dashboard updates in real-time
```

### Three Key Components

#### 1. **Event Queue** (Redis)
- FIFO queue named `event_queue`
- Persists events if needed
- Survives server restarts

#### 2. **Event Workers** (4 by default)
- Pick up events from queue
- Process in batches (up to 100)
- Write to database
- Auto-restart if they crash

#### 3. **Real-Time Updates** (Pub/Sub)
- Workers publish events they process
- Dashboard listens and updates
- No more polling!

## Configuration

### Adjust Worker Count

In `src/index.tsx`:
```typescript
await startWorkers({
  eventWorkers: 8,        // ← Increase for higher throughput
  aggregationWorkers: 1,
  enableAutoRestart: true
});
```

### Tune Batch Size

In `src/workers/event-processor.ts`:
```typescript
const BATCH_SIZE = 100;        // ← Events per batch
const BATCH_INTERVAL_MS = 100; // ← Wait this long for batch
```

## Load Testing

### Run Built-in Tests

```bash
bun tests/load/bulk-ingestion.ts
```

This runs 3 tests:
- **Test 1**: 1000 events in 10 seconds (100 events/sec)
- **Test 2**: 1000 events in 30 seconds (33 events/sec)
- **Test 3**: 3000 events in 60 seconds (50 events/sec)

Shows:
- Throughput (events/sec)
- Latency (min, avg, p95, p99, max)
- Success rate
- Final queue depth

## Monitoring

### Watch Worker Status
```bash
# In node REPL
import { getPoolStatus } from './src/workers/pool';
console.log(getPoolStatus());

// Shows:
// {
//   totalWorkers: 5,
//   runningWorkers: 5,
//   workers: [
//     { id: 'event-worker-0', type: 'event', running: true, restarts: 0 },
//     ...
//   ]
// }
```

### Check Queue Depth
```bash
# Via health endpoint
curl http://localhost:3000/api/health | jq '.components.queueMetrics.currentQueueLength'
```

### Watch Logs
```bash
# Server will show all worker activity
# Look for:
# - "[Worker event-worker-X] Starting event processor"
# - "Event processed: X ms"
# - "Aggregates calculated"
# - "Retention cleanup completed"
```

## Common Tasks

### See What's in the Queue
```typescript
import { QueueService } from './src/services/queue';

const events = await QueueService.peekQueue(5);  // Peek at first 5
console.log(events);
```

### Manually Run Cleanup
```typescript
import { executeImmediateCleanup } from './src/workers/retention-processor';

const stats = await executeImmediateCleanup();
console.log('Deleted:', stats.rawEventsDeleted);
```

### Get Current Metrics
```typescript
import { QueueService } from './src/services/queue';

const metrics = await QueueService.getMetrics();
console.log('Processed this session:', metrics.totalProcessed);
console.log('Current queue length:', metrics.currentQueueLength);
console.log('Failures:', metrics.totalFailed);
```

## Troubleshooting

### Queue Not Processing
```bash
# 1. Check Redis is running
redis-cli ping  # Should return PONG

# 2. Check health endpoint
curl http://localhost:3000/api/health

# 3. Look for errors in logs
# Search for "Error" or "failed" in terminal output
```

### Slow Processing
```bash
# Check queue depth
curl http://localhost:3000/api/health | jq '.components.queueMetrics'

# If growing, increase workers:
# In src/index.tsx, change eventWorkers: 4 → 8
```

### Workers Not Starting
```bash
# Check for port conflicts
lsof -i :3000  # Should show only your bun process

# Check Redis/PostgreSQL connectivity
redis-cli ping
psql -U analytics_user -d analytics -c "SELECT 1"
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/lib/redis.ts` | Redis connection & operations |
| `src/services/queue.ts` | Event queuing logic |
| `src/workers/event-processor.ts` | Main event processing |
| `src/workers/pool.ts` | Worker lifecycle management |
| `src/workers/aggregation-processor.ts` | Metrics calculation |
| `src/routes/api.ts` | API endpoints |
| `tests/load/bulk-ingestion.ts` | Load testing suite |

## Performance Expectations

### With Default Config (4 workers)

| Metric | Value |
|--------|-------|
| API response time | 1-5ms |
| Event-to-database | 50-200ms |
| Dashboard update | <100ms |
| Success rate | >99% |
| Throughput | ~3000 events/min |

### Database

| Table | Rows | Purpose |
|-------|------|---------|
| events | ~1000s | Raw event data |
| event_aggregates | ~100s | Pre-calculated metrics |

## API Changes

### POST /api/events

**Before (Phase 4)**:
```javascript
// Request
POST /api/events
{ "data": { "type": "events", "attributes": {...} } }

// Response (201 Created)
{ "data": { "id": "...", "attributes": {...} } }
```

**After (Phase 5)**:
```javascript
// Request (same)
POST /api/events
{ "data": { "type": "events", "attributes": {...} } }

// Response (202 Accepted) - Event is QUEUED, not stored yet
{ "data": { "id": "...", "attributes": {...} } }
```

**Important**: Event ID is generated at submission time, but event is stored asynchronously.

### GET /api/health

**Enhanced with queue metrics**:
```json
{
  "status": "healthy",
  "components": {
    "redis": "ok",
    "queue": "ok",
    "queueMetrics": {
      "totalEnqueued": 1000,
      "totalProcessed": 950,
      "totalFailed": 2,
      "currentQueueLength": 48
    }
  }
}
```

### GET /api/sse/dashboard

**Now uses Redis pub/sub instead of polling**:
- Instant updates when events process
- No more 3-second polling delay
- Real-time metrics refresh

## Next Steps

1. **Read Full Docs**: `docs/phase-5-implementation.md` for complete details
2. **Run Tests**: `bun tests/load/bulk-ingestion.ts` to validate performance
3. **Monitor**: Watch worker logs during development
4. **Integrate**: Update your event submission code to handle 202 responses

## Need Help?

1. **Check logs** - Workers print detailed info with `[Worker X]` prefix
2. **Check health** - `curl http://localhost:3000/api/health`
3. **Review docs** - `docs/phase-5-implementation.md` has troubleshooting section
4. **Inspect queue** - Use QueueService to peek at queue contents

---

**TL;DR**: Events are now queued in Redis and processed asynchronously by workers. API returns instantly. Dashboard updates in real-time. Much faster and more scalable!
