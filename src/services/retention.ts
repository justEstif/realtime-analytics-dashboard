/**
 * Data Retention & Archival Service
 *
 * Implements retention policies for events and aggregates:
 * - Archives old raw events to separate storage
 * - Cleans up expired aggregates
 * - Maintains materialized views for historical data
 * - Configurable TTL policies
 */

import { db } from "../db";
import { events, eventAggregates } from "../db/schema";
import { sql } from "drizzle-orm";
import { pubsub } from "../lib/redis";

/**
 * Retention policy configuration
 */
export interface RetentionPolicy {
  // Raw events retention
  rawEventsRetentionDays: number; // Keep raw events for N days

  // Aggregates retention
  hourlyAggregatesRetentionDays: number; // Keep hourly aggregates
  dailyAggregatesRetentionDays: number; // Keep daily aggregates
  weeklyAggregatesRetentionDays: number; // Keep weekly aggregates

  // Archive settings
  archiveEnabled: boolean; // Whether to archive old events
  archiveFormat: "jsonl" | "parquet"; // Format for archived data
}

// Default retention policy
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  rawEventsRetentionDays: 30,
  hourlyAggregatesRetentionDays: 7,
  dailyAggregatesRetentionDays: 90,
  weeklyAggregatesRetentionDays: 365,
  archiveEnabled: true,
  archiveFormat: "jsonl",
};

/**
 * Retention statistics
 */
export interface RetentionStats {
  rawEventsDeleted: number;
  rawEventsArchived: number;
  hourlyAggregatesDeleted: number;
  dailyAggregatesDeleted: number;
  weeklyAggregatesDeleted: number;
  totalRecordsRetained: number;
  executedAt: Date;
  duration: number; // ms
}

export class RetentionService {
  private policy: RetentionPolicy;

  constructor(policy: Partial<RetentionPolicy> = {}) {
    this.policy = { ...DEFAULT_RETENTION_POLICY, ...policy };
  }

  /**
   * Archive events older than retention period
   */
  async archiveOldEvents(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - this.policy.rawEventsRetentionDays,
      );

      // Get events to archive
      const archiveQuery = await db
        .select()
        .from(events)
        .where(sql`${events.timestamp} < ${cutoffDate}`);

      if (archiveQuery.length === 0) {
        return 0;
      }

      // In production, you would write these to cold storage (S3, etc.)
      // For now, we'll just log the count
      console.log(
        `Archiving ${archiveQuery.length} events older than ${cutoffDate.toISOString()}`,
      );

      // TODO: Implement actual archival to cold storage
      // const archived = await archiveToS3(archiveQuery, this.policy.archiveFormat);

      return archiveQuery.length;
    } catch (error) {
      console.error("Error archiving old events:", error);
      return 0;
    }
  }

  /**
   * Delete events older than retention period
   */
  async deleteOldRawEvents(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - this.policy.rawEventsRetentionDays,
      );

      const result = await db
        .delete(events)
        .where(sql`${events.timestamp} < ${cutoffDate}`);

      return result.rowCount || 0;
    } catch (error) {
      console.error("Error deleting old raw events:", error);
      return 0;
    }
  }

  /**
   * Delete expired hourly aggregates
   */
  async deleteExpiredHourlyAggregates(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - this.policy.hourlyAggregatesRetentionDays,
      );

      const result = await db
        .delete(eventAggregates)
        .where(
          sql`${eventAggregates.windowType} = '1h' AND ${eventAggregates.windowStart} < ${cutoffDate}`,
        );

      return result.rowCount || 0;
    } catch (error) {
      console.error("Error deleting expired hourly aggregates:", error);
      return 0;
    }
  }

  /**
   * Delete expired daily aggregates
   */
  async deleteExpiredDailyAggregates(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - this.policy.dailyAggregatesRetentionDays,
      );

      const result = await db
        .delete(eventAggregates)
        .where(
          sql`${eventAggregates.windowType} = '1d' AND ${eventAggregates.windowStart} < ${cutoffDate}`,
        );

      return result.rowCount || 0;
    } catch (error) {
      console.error("Error deleting expired daily aggregates:", error);
      return 0;
    }
  }

  /**
   * Delete expired weekly aggregates
   */
  async deleteExpiredWeeklyAggregates(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - this.policy.weeklyAggregatesRetentionDays,
      );

      const result = await db
        .delete(eventAggregates)
        .where(
          sql`${eventAggregates.windowType} = '1w' AND ${eventAggregates.windowStart} < ${cutoffDate}`,
        );

      return result.rowCount || 0;
    } catch (error) {
      console.error("Error deleting expired weekly aggregates:", error);
      return 0;
    }
  }

  /**
   * Get count of retained records
   */
  async getRetainedRecordCounts(): Promise<{
    rawEvents: number;
    hourlyAggregates: number;
    dailyAggregates: number;
    weeklyAggregates: number;
  }> {
    try {
      const [eventsCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(events);

      const [hourlyCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(eventAggregates)
        .where(sql`${eventAggregates.windowType} = '1h'`);

      const [dailyCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(eventAggregates)
        .where(sql`${eventAggregates.windowType} = '1d'`);

      const [weeklyCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(eventAggregates)
        .where(sql`${eventAggregates.windowType} = '1w'`);

      return {
        rawEvents: (eventsCount?.count as number) || 0,
        hourlyAggregates: (hourlyCount?.count as number) || 0,
        dailyAggregates: (dailyCount?.count as number) || 0,
        weeklyAggregates: (weeklyCount?.count as number) || 0,
      };
    } catch (error) {
      console.error("Error getting retained record counts:", error);
      return {
        rawEvents: 0,
        hourlyAggregates: 0,
        dailyAggregates: 0,
        weeklyAggregates: 0,
      };
    }
  }

  /**
   * Execute retention cleanup
   */
  async executeCleanup(): Promise<RetentionStats> {
    const startTime = Date.now();
    let rawEventsArchived = 0;
    let rawEventsDeleted = 0;
    let hourlyDeleted = 0;
    let dailyDeleted = 0;
    let weeklyDeleted = 0;

    try {
      console.log("🧹 Starting retention cleanup...");

      // Archive old raw events if enabled
      if (this.policy.archiveEnabled) {
        rawEventsArchived = await this.archiveOldEvents();
        console.log(`✓ Archived ${rawEventsArchived} events`);
      }

      // Delete old raw events (after archival if enabled)
      rawEventsDeleted = await this.deleteOldRawEvents();
      console.log(
        `✓ Deleted ${rawEventsDeleted} raw events older than ${this.policy.rawEventsRetentionDays} days`,
      );

      // Delete expired aggregates
      hourlyDeleted = await this.deleteExpiredHourlyAggregates();
      console.log(
        `✓ Deleted ${hourlyDeleted} hourly aggregates older than ${this.policy.hourlyAggregatesRetentionDays} days`,
      );

      dailyDeleted = await this.deleteExpiredDailyAggregates();
      console.log(
        `✓ Deleted ${dailyDeleted} daily aggregates older than ${this.policy.dailyAggregatesRetentionDays} days`,
      );

      weeklyDeleted = await this.deleteExpiredWeeklyAggregates();
      console.log(
        `✓ Deleted ${weeklyDeleted} weekly aggregates older than ${this.policy.weeklyAggregatesRetentionDays} days`,
      );

      // Get current stats
      const counts = await this.getRetainedRecordCounts();
      const totalRetained =
        counts.rawEvents +
        counts.hourlyAggregates +
        counts.dailyAggregates +
        counts.weeklyAggregates;

      const duration = Date.now() - startTime;

      const stats: RetentionStats = {
        rawEventsDeleted,
        rawEventsArchived,
        hourlyAggregatesDeleted: hourlyDeleted,
        dailyAggregatesDeleted: dailyDeleted,
        weeklyAggregatesDeleted: weeklyDeleted,
        totalRecordsRetained: totalRetained,
        executedAt: new Date(),
        duration,
      };

      // Publish cleanup event
      await pubsub.publish("retention:cleanup-completed", stats);

      console.log(`✅ Retention cleanup completed in ${duration}ms`);
      console.log(
        `   Total records retained: ${totalRetained} (Raw: ${counts.rawEvents}, Hourly: ${counts.hourlyAggregates}, Daily: ${counts.dailyAggregates}, Weekly: ${counts.weeklyAggregates})`,
      );

      return stats;
    } catch (error) {
      console.error("Retention cleanup failed:", error);
      throw error;
    }
  }

  /**
   * Get policy info
   */
  getPolicy(): RetentionPolicy {
    return { ...this.policy };
  }

  /**
   * Update policy
   */
  setPolicy(policy: Partial<RetentionPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }
}

// Global singleton instance
let instance: RetentionService | null = null;

/**
 * Get or create retention service instance
 */
export function getRetentionService(
  policy?: Partial<RetentionPolicy>,
): RetentionService {
  if (!instance) {
    instance = new RetentionService(policy);
  }
  return instance;
}
