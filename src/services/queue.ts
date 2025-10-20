/**
 * Queue Service
 *
 * Provides abstraction over Redis queue operations with business logic
 * for event ingestion and processing workflow.
 */

import { queue as redisQueue, pubsub, cache } from "../lib/redis";
import type { EventAttributes } from "../validators/event.validator";

const EVENT_QUEUE = "event_queue";
const MAX_RETRIES = 3;
const RETRY_PREFIX = "event_retry:";
const QUEUE_METRICS_KEY = "queue:metrics";

/**
 * Represents a queued event with metadata
 */
export interface QueuedEvent {
  id: string;
  attributes: EventAttributes;
  enqueuedAt: number;
  retryCount: number;
}

/**
 * Queue metrics tracking
 */
export interface QueueMetrics {
  totalEnqueued: number;
  totalProcessed: number;
  totalFailed: number;
  currentQueueLength: number;
  lastUpdated: number;
}

export class QueueService {
  /**
   * Enqueue an event for processing
   *
   * @param attributes - Validated event attributes
   * @returns Generated event ID
   */
  static async enqueueEvent(attributes: EventAttributes): Promise<string> {
    const eventId = crypto.randomUUID();

    const queuedEvent: QueuedEvent = {
      id: eventId,
      attributes,
      enqueuedAt: Date.now(),
      retryCount: 0,
    };

    try {
      await redisQueue.enqueue(EVENT_QUEUE, queuedEvent);

      // Update metrics
      await cache.increment(`${QUEUE_METRICS_KEY}:enqueued`);

      // Publish enqueue event for monitoring
      await pubsub.publish("queue:event-enqueued", {
        eventId,
        timestamp: Date.now(),
      });

      return eventId;
    } catch (error) {
      console.error("Failed to enqueue event:", error);
      throw new Error("Failed to queue event for processing");
    }
  }

  /**
   * Dequeue a single event for processing
   *
   * @returns Queued event or null if queue is empty
   */
  static async dequeueEvent(): Promise<QueuedEvent | null> {
    try {
      const event = await redisQueue.dequeue(EVENT_QUEUE);
      return event as QueuedEvent | null;
    } catch (error) {
      console.error("Failed to dequeue event:", error);
      return null;
    }
  }

  /**
   * Dequeue multiple events at once (for batch processing)
   *
   * @param count - Number of events to dequeue
   * @returns Array of queued events
   */
  static async dequeueBatch(count: number): Promise<QueuedEvent[]> {
    try {
      const events = await redisQueue.dequeueBatch(EVENT_QUEUE, count);
      return events as QueuedEvent[];
    } catch (error) {
      console.error("Failed to dequeue batch:", error);
      return [];
    }
  }

  /**
   * Mark event as successfully processed
   *
   * @param eventId - ID of processed event
   */
  static async markProcessed(eventId: string): Promise<void> {
    try {
      // Remove retry tracking if it exists
      await cache.delete(`${RETRY_PREFIX}${eventId}`);

      // Update metrics
      await cache.increment(`${QUEUE_METRICS_KEY}:processed`);

      // Publish success event
      await pubsub.publish("queue:event-processed", {
        eventId,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Failed to mark event as processed:", error);
    }
  }

  /**
   * Handle event processing failure with retry logic
   *
   * @param event - Event that failed to process
   * @returns true if event was re-queued, false if max retries exceeded
   */
  static async handleProcessingFailure(event: QueuedEvent): Promise<boolean> {
    try {
      const retryCount = event.retryCount + 1;

      if (retryCount > MAX_RETRIES) {
        // Max retries exceeded - move to dead letter queue
        await cache.set(
          `dead_letter:${event.id}`,
          { ...event, failedAt: Date.now() },
          86400, // 24 hour TTL
        );

        await cache.increment(`${QUEUE_METRICS_KEY}:failed`);

        // Publish failure event
        await pubsub.publish("queue:event-failed", {
          eventId: event.id,
          reason: "max retries exceeded",
          timestamp: Date.now(),
        });

        return false;
      }

      // Re-queue with incremented retry count
      const retriedEvent = { ...event, retryCount };
      await redisQueue.enqueue(EVENT_QUEUE, retriedEvent);

      // Track retry attempt
      await cache.set(`${RETRY_PREFIX}${event.id}`, retryCount);

      // Publish retry event
      await pubsub.publish("queue:event-retry", {
        eventId: event.id,
        retryCount,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      console.error("Failed to handle processing failure:", error);
      return false;
    }
  }

  /**
   * Get current queue length
   */
  static async getQueueLength(): Promise<number> {
    try {
      return await redisQueue.getLength(EVENT_QUEUE);
    } catch (error) {
      console.error("Failed to get queue length:", error);
      return 0;
    }
  }

  /**
   * Peek at queued events without removing them
   *
   * @param count - Number of events to peek at
   */
  static async peekQueue(count: number = 10): Promise<QueuedEvent[]> {
    try {
      const events = await redisQueue.peek(EVENT_QUEUE, count);
      return events as QueuedEvent[];
    } catch (error) {
      console.error("Failed to peek queue:", error);
      return [];
    }
  }

  /**
   * Get queue metrics
   */
  static async getMetrics(): Promise<QueueMetrics> {
    try {
      const [enqueued, processed, failed, length] = await Promise.all([
        cache.get(`${QUEUE_METRICS_KEY}:enqueued`),
        cache.get(`${QUEUE_METRICS_KEY}:processed`),
        cache.get(`${QUEUE_METRICS_KEY}:failed`),
        this.getQueueLength(),
      ]);

      return {
        totalEnqueued: (enqueued as number) || 0,
        totalProcessed: (processed as number) || 0,
        totalFailed: (failed as number) || 0,
        currentQueueLength: length,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error("Failed to get queue metrics:", error);
      return {
        totalEnqueued: 0,
        totalProcessed: 0,
        totalFailed: 0,
        currentQueueLength: 0,
        lastUpdated: Date.now(),
      };
    }
  }

  /**
   * Clear the entire queue (use with caution!)
   */
  static async clearQueue(): Promise<void> {
    try {
      await redisQueue.clear(EVENT_QUEUE);
      await pubsub.publish("queue:cleared", { timestamp: Date.now() });
    } catch (error) {
      console.error("Failed to clear queue:", error);
    }
  }

  /**
   * Get dead-lettered events (events that failed after max retries)
   */
  static async getDeadLetterEvents(): Promise<QueuedEvent[]> {
    try {
      // Note: This is a simplified implementation
      // In production, you'd want to scan all keys matching the pattern
      // For now, we'll return an empty array
      return [];
    } catch (error) {
      console.error("Failed to get dead letter events:", error);
      return [];
    }
  }

  /**
   * Subscribe to queue events
   */
  static async subscribeToQueueEvents(
    handler: (event: string, data: unknown) => void,
  ): Promise<void> {
    const channels = [
      "queue:event-enqueued",
      "queue:event-processed",
      "queue:event-failed",
      "queue:event-retry",
    ];

    await pubsub.subscribe(channels, (channel, message) => {
      handler(channel, message);
    });
  }

  /**
   * Get health status of queue
   */
  static async getQueueHealth(): Promise<{
    healthy: boolean;
    queueLength: number;
    metrics: QueueMetrics;
  }> {
    try {
      const queueLength = await this.getQueueLength();
      const metrics = await this.getMetrics();

      // Consider unhealthy if queue is growing faster than processing
      // or if too many failures
      const failureRate =
        metrics.totalProcessed > 0
          ? metrics.totalFailed / metrics.totalProcessed
          : 0;

      const healthy =
        queueLength < 10000 && // Reasonable queue threshold
        failureRate < 0.1; // Less than 10% failure rate

      return {
        healthy,
        queueLength,
        metrics,
      };
    } catch (error) {
      console.error("Failed to get queue health:", error);
      return {
        healthy: false,
        queueLength: 0,
        metrics: {
          totalEnqueued: 0,
          totalProcessed: 0,
          totalFailed: 0,
          currentQueueLength: 0,
          lastUpdated: Date.now(),
        },
      };
    }
  }
}
