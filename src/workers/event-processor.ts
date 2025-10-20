/**
 * Event Processor Worker
 *
 * Background worker that processes queued events:
 * - Dequeues events from Redis queue
 * - Validates and stores them in database
 * - Publishes updates via Redis pub/sub
 * - Handles failures with retry logic
 */

import { QueueService, type QueuedEvent } from "../services/queue";
import { EventService } from "../services/events";
import { pubsub } from "../lib/redis";
import type { EventAttributes } from "../validators/event.validator";

// Configuration
const BATCH_SIZE = 100; // Process up to 100 events per batch
const BATCH_INTERVAL_MS = 100; // Wait this long to accumulate batch
const ERROR_BACKOFF_MS = 1000; // Wait before retrying on error

/**
 * Process a single queued event
 */
async function processEvent(queuedEvent: QueuedEvent): Promise<boolean> {
  try {
    const attributes = queuedEvent.attributes as EventAttributes;

    // Validate attributes are still valid (sanity check)
    if (!attributes.event_type || attributes.event_type.length === 0) {
      console.error("Invalid event attributes:", attributes);
      return false;
    }

    // Store event in database
    const createdEvent = await EventService.createEvent(attributes);

    // Mark as successfully processed
    await QueueService.markProcessed(queuedEvent.id);

    // Publish event-processed message for SSE subscribers
    await pubsub.publish("worker:event-processed", {
      eventId: queuedEvent.id,
      storedId: createdEvent.id,
      eventType: createdEvent.eventType,
      timestamp: createdEvent.timestamp.toISOString(),
      processingTime: Date.now() - queuedEvent.enqueuedAt,
    });

    return true;
  } catch (error) {
    console.error("Error processing event:", error);

    // Handle failure with retry logic
    const shouldRetry = await QueueService.handleProcessingFailure(
      queuedEvent,
    );

    if (!shouldRetry) {
      // Publish failure event for monitoring
      await pubsub.publish("worker:event-failed", {
        eventId: queuedEvent.id,
        reason: "max retries exceeded",
        timestamp: Date.now(),
      });
    }

    return false;
  }
}

/**
 * Process a batch of events
 */
async function processBatch(events: QueuedEvent[]): Promise<void> {
  if (events.length === 0) return;

  const results = await Promise.allSettled(
    events.map((event) => processEvent(event)),
  );

  // Log batch results
  const successful = results.filter((r) => r.status === "fulfilled" && r.value)
    .length;
  const failed = results.length - successful;

  if (failed > 0) {
    console.warn(`Batch processed: ${successful} success, ${failed} failures`);
  }

  // Publish batch metrics
  await pubsub.publish("worker:batch-processed", {
    batchSize: events.length,
    successful,
    failed,
    timestamp: Date.now(),
  });
}

/**
 * Main worker loop - continuously processes events from queue
 */
export async function startEventProcessor(workerId: string): Promise<void> {
  console.log(`[Worker ${workerId}] Starting event processor`);

  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10;

  // Main processing loop
  while (true) {
    try {
      // Get queue health status
      const health = await QueueService.getQueueHealth();

      if (!health.healthy) {
        console.warn(
          `[Worker ${workerId}] Queue unhealthy, metrics:`,
          health.metrics,
        );
      }

      // Dequeue batch of events
      const events = await QueueService.dequeueBatch(BATCH_SIZE);

      if (events.length > 0) {
        // Process the batch
        await processBatch(events);

        // Reset error counter on successful batch
        consecutiveErrors = 0;
      } else {
        // No events in queue, wait before checking again
        await new Promise((resolve) => setTimeout(resolve, BATCH_INTERVAL_MS));
      }
    } catch (error) {
      consecutiveErrors++;

      console.error(
        `[Worker ${workerId}] Error in processing loop (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
        error,
      );

      // Back off exponentially on repeated errors
      const backoffTime = Math.min(
        ERROR_BACKOFF_MS * Math.pow(2, consecutiveErrors - 1),
        30000, // Cap at 30 seconds
      );

      await new Promise((resolve) => setTimeout(resolve, backoffTime));

      // Exit if too many consecutive errors
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(
          `[Worker ${workerId}] Too many consecutive errors, exiting`,
        );
        throw new Error("Worker exceeded max consecutive errors");
      }
    }
  }
}

/**
 * Handle graceful shutdown
 */
export async function stopEventProcessor(): Promise<void> {
  console.log("Stopping event processor");
  // Worker will exit on next iteration
}

// Export for testing
export { processEvent, processBatch };
