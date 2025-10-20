/**
 * Retention Processor Worker
 *
 * Background worker that manages data retention policies:
 * - Archives events older than retention period
 * - Cleans up expired aggregates
 * - Runs on a configurable schedule (default: daily)
 */

import {
  getRetentionService,
  type RetentionPolicy,
} from "../services/retention";
import { pubsub } from "../lib/redis";

// Configuration
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // Daily (24 hours)
const MIN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Minimum 1 hour between cleanups

/**
 * Main retention processor loop
 */
export async function startRetentionProcessor(
  workerId: string,
  policy?: Partial<RetentionPolicy>,
): Promise<void> {
  console.log(`[${workerId}] Starting retention processor`);

  const retentionService = getRetentionService(policy);
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;
  let lastCleanup = Date.now();

  // Main loop
  while (true) {
    try {
      const now = Date.now();
      const timeSinceLastCleanup = now - lastCleanup;

      // Check if it's time to run cleanup
      if (timeSinceLastCleanup >= CLEANUP_INTERVAL_MS) {
        console.log(`[${workerId}] Running retention cleanup...`);

        try {
          const stats = await retentionService.executeCleanup();

          // Publish cleanup stats
          await pubsub.publish("retention:stats", stats);

          lastCleanup = now;
          consecutiveErrors = 0;
        } catch (cleanupError) {
          consecutiveErrors++;
          console.error(`[${workerId}] Cleanup execution failed:`, cleanupError);

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            throw new Error(
              "Max cleanup errors exceeded, exiting worker",
            );
          }
        }
      }

      // Sleep until next cleanup is due
      const timeUntilNextCleanup = Math.max(
        MIN_CLEANUP_INTERVAL_MS,
        CLEANUP_INTERVAL_MS - timeSinceLastCleanup,
      );

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(timeUntilNextCleanup, 3600000)), // Check at most every hour
      );
    } catch (error) {
      consecutiveErrors++;

      console.error(
        `[${workerId}] Error in retention loop (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
        error,
      );

      // Back off exponentially on repeated errors
      const backoffTime = Math.min(
        1000 * Math.pow(2, consecutiveErrors - 1),
        30000, // Cap at 30 seconds
      );

      await new Promise((resolve) => setTimeout(resolve, backoffTime));

      // Exit if too many consecutive errors
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(
          `[${workerId}] Too many consecutive errors, exiting`,
        );
        throw new Error("Worker exceeded max consecutive errors");
      }
    }
  }
}

/**
 * Perform immediate cleanup (useful for testing)
 */
export async function executeImmediateCleanup(
  policy?: Partial<RetentionPolicy>,
): Promise<unknown> {
  const retentionService = getRetentionService(policy);
  return retentionService.executeCleanup();
}

export default startRetentionProcessor;
