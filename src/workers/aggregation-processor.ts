/**
 * Aggregation Processor Worker
 *
 * Background worker that calculates and maintains aggregated metrics:
 * - Hourly event counts by type
 * - Daily event counts by type
 * - Weekly event counts by type
 * - Publishes updates via Redis pub/sub
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { pubsub, cache } from "../lib/redis";

// Configuration
const HOURLY_INTERVAL_MS = 5 * 60 * 1000; // Calculate hourly aggregates every 5 minutes
const DAILY_INTERVAL_MS = 10 * 60 * 1000; // Calculate daily aggregates every 10 minutes
const WEEKLY_INTERVAL_MS = 30 * 60 * 1000; // Calculate weekly aggregates every 30 minutes

interface AggregateMetrics {
  timeWindow: "1h" | "1d" | "1w";
  timestamp: string;
  totalEvents: number;
  byType: Array<{ eventType: string; count: number }>;
  calculatedAt: number;
}

/**
 * Calculate hourly aggregates
 * Groups events from the last hour by event type
 */
async function calculateHourlyAggregates(): Promise<AggregateMetrics | null> {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const result = await db.execute(
      sql`
        SELECT
          event_type,
          COUNT(*) as count
        FROM events
        WHERE timestamp >= ${oneHourAgo}
          AND timestamp < ${now}
        GROUP BY event_type
        ORDER BY count DESC
      `,
    );

    const rows = result.rows as Array<{ event_type: string; count: number }>;
    const totalEvents = rows.reduce((sum, row) => sum + (row.count || 0), 0);

    const metrics: AggregateMetrics = {
      timeWindow: "1h",
      timestamp: now.toISOString(),
      totalEvents,
      byType: rows.map((row) => ({
        eventType: row.event_type,
        count: Number(row.count),
      })),
      calculatedAt: Date.now(),
    };

    // Cache the aggregates
    await cache.set("aggregates:1h:latest", metrics, 3600); // 1 hour TTL

    return metrics;
  } catch (error) {
    console.error("Error calculating hourly aggregates:", error);
    return null;
  }
}

/**
 * Calculate daily aggregates
 * Groups events from the current day by event type
 */
async function calculateDailyAggregates(): Promise<AggregateMetrics | null> {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const result = await db.execute(
      sql`
        SELECT
          event_type,
          COUNT(*) as count
        FROM events
        WHERE timestamp >= ${startOfDay}
          AND timestamp < ${now}
        GROUP BY event_type
        ORDER BY count DESC
      `,
    );

    const rows = result.rows as Array<{ event_type: string; count: number }>;
    const totalEvents = rows.reduce((sum, row) => sum + (row.count || 0), 0);

    const metrics: AggregateMetrics = {
      timeWindow: "1d",
      timestamp: now.toISOString(),
      totalEvents,
      byType: rows.map((row) => ({
        eventType: row.event_type,
        count: Number(row.count),
      })),
      calculatedAt: Date.now(),
    };

    // Cache the aggregates
    await cache.set("aggregates:1d:latest", metrics, 86400); // 24 hour TTL

    return metrics;
  } catch (error) {
    console.error("Error calculating daily aggregates:", error);
    return null;
  }
}

/**
 * Calculate weekly aggregates
 * Groups events from the last 7 days by event type
 */
async function calculateWeeklyAggregates(): Promise<AggregateMetrics | null> {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await db.execute(
      sql`
        SELECT
          event_type,
          COUNT(*) as count
        FROM events
        WHERE timestamp >= ${sevenDaysAgo}
          AND timestamp < ${now}
        GROUP BY event_type
        ORDER BY count DESC
      `,
    );

    const rows = result.rows as Array<{ event_type: string; count: number }>;
    const totalEvents = rows.reduce((sum, row) => sum + (row.count || 0), 0);

    const metrics: AggregateMetrics = {
      timeWindow: "1w",
      timestamp: now.toISOString(),
      totalEvents,
      byType: rows.map((row) => ({
        eventType: row.event_type,
        count: Number(row.count),
      })),
      calculatedAt: Date.now(),
    };

    // Cache the aggregates
    await cache.set("aggregates:1w:latest", metrics, 604800); // 7 day TTL

    return metrics;
  } catch (error) {
    console.error("Error calculating weekly aggregates:", error);
    return null;
  }
}

/**
 * Calculate all aggregates
 */
async function calculateAllAggregates(): Promise<void> {
  try {
    // Calculate aggregates in parallel
    const [hourly, daily, weekly] = await Promise.all([
      calculateHourlyAggregates(),
      calculateDailyAggregates(),
      calculateWeeklyAggregates(),
    ]);

    // Publish metrics-updated event for SSE subscribers
    await pubsub.publish("aggregation:metrics-calculated", {
      hourly,
      daily,
      weekly,
      timestamp: Date.now(),
    });

    if (hourly || daily || weekly) {
      console.log("Aggregates calculated successfully");
    }
  } catch (error) {
    console.error("Error calculating all aggregates:", error);
  }
}

/**
 * Main aggregation processor loop
 */
export async function startAggregationProcessor(
  workerId: string,
): Promise<void> {
  console.log(`[${workerId}] Starting aggregation processor`);

  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10;

  // Track when each aggregate was last calculated
  let lastHourlyCalc = Date.now();
  let lastDailyCalc = Date.now();
  let lastWeeklyCalc = Date.now();

  // Main loop
  while (true) {
    try {
      const now = Date.now();

      // Check if it's time to calculate each aggregate
      const shouldCalcHourly = now - lastHourlyCalc >= HOURLY_INTERVAL_MS;
      const shouldCalcDaily = now - lastDailyCalc >= DAILY_INTERVAL_MS;
      const shouldCalcWeekly = now - lastWeeklyCalc >= WEEKLY_INTERVAL_MS;

      if (shouldCalcHourly) {
        await calculateHourlyAggregates();
        lastHourlyCalc = now;
      }

      if (shouldCalcDaily) {
        await calculateDailyAggregates();
        lastDailyCalc = now;
      }

      if (shouldCalcWeekly) {
        await calculateWeeklyAggregates();
        lastWeeklyCalc = now;
      }

      if (!shouldCalcHourly && !shouldCalcDaily && !shouldCalcWeekly) {
        // Sleep until next calculation is due
        const timeUntilNext = Math.min(
          lastHourlyCalc + HOURLY_INTERVAL_MS - now,
          lastDailyCalc + DAILY_INTERVAL_MS - now,
          lastWeeklyCalc + WEEKLY_INTERVAL_MS - now,
        );

        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(timeUntilNext, 1000)),
        );
      }

      // Reset error counter on successful calculation
      consecutiveErrors = 0;
    } catch (error) {
      consecutiveErrors++;

      console.error(
        `[${workerId}] Error in aggregation loop (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
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
 * Get cached aggregates
 */
export async function getCachedAggregates(): Promise<{
  hourly: AggregateMetrics | null;
  daily: AggregateMetrics | null;
  weekly: AggregateMetrics | null;
}> {
  const [hourly, daily, weekly] = await Promise.all([
    cache.get("aggregates:1h:latest"),
    cache.get("aggregates:1d:latest"),
    cache.get("aggregates:1w:latest"),
  ]);

  return {
    hourly: (hourly as AggregateMetrics) || null,
    daily: (daily as AggregateMetrics) || null,
    weekly: (weekly as AggregateMetrics) || null,
  };
}

// Export for testing
export {
  calculateHourlyAggregates,
  calculateDailyAggregates,
  calculateWeeklyAggregates,
  calculateAllAggregates,
};
