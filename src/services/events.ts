/**
 * Event Service
 *
 * Handles business logic for event ingestion and retrieval.
 */

import { db } from "../db";
import { events, type Event, type NewEvent } from "../db/schema";
import type { EventAttributes } from "../validators/event.validator";
import { desc, count, gte, sql } from "drizzle-orm";

/**
 * Event statistics result
 */
export interface EventStatsResult {
  total: number;
  today: number;
  eventsPerMinute: number;
  byType: Array<{ eventType: string; count: number }>;
}

export class EventService {
  /**
   * Store event in database
   *
   * @param attributes - Event attributes from validated request
   * @returns Created event with generated ID and timestamp
   * @throws Error if database write fails
   */
  static async createEvent(attributes: EventAttributes): Promise<Event> {
    try {
      // Prepare event data for insertion
      const newEvent: NewEvent = {
        eventType: attributes.event_type,
        metadata: attributes.metadata,
        // Use provided timestamp or let database set default
        ...(attributes.timestamp && {
          timestamp: new Date(attributes.timestamp),
        }),
      };

      // Insert event and return the created record
      const [createdEvent] = await db.insert(events).values(newEvent).returning();

      return createdEvent;
    } catch (error) {
      // Log error for debugging (in production, use proper logging)
      console.error("Database error creating event:", error);
      throw new Error("Failed to create event");
    }
  }

  /**
   * Retrieve recent events
   *
   * @param limit - Maximum number of events to retrieve (default: 50)
   * @returns Array of events ordered by timestamp (most recent first)
   */
  static async getRecentEvents(limit: number = 50): Promise<Event[]> {
    try {
      const recentEvents = await db
        .select()
        .from(events)
        .orderBy(desc(events.timestamp))
        .limit(Math.min(limit, 100)); // Cap at 100 for performance

      return recentEvents;
    } catch (error) {
      console.error("Database error fetching recent events:", error);
      throw new Error("Failed to fetch recent events");
    }
  }

  /**
   * Get comprehensive event statistics
   *
   * @returns Statistics including total count, today's count, events/minute, and breakdown by type
   */
  static async getEventStats(): Promise<EventStatsResult> {
    try {
      // Query 1: Total events count
      const [totalResult] = await db
        .select({ count: count() })
        .from(events);

      // Query 2: Events today
      const [todayResult] = await db
        .select({ count: count() })
        .from(events)
        .where(gte(events.timestamp, sql`CURRENT_DATE`));

      // Query 3: Events in the last minute
      const [lastMinuteResult] = await db
        .select({ count: count() })
        .from(events)
        .where(gte(events.timestamp, sql`NOW() - INTERVAL '1 minute'`));

      // Query 4: Events by type (top 10)
      const byTypeResults = await db
        .select({
          eventType: events.eventType,
          count: count(),
        })
        .from(events)
        .groupBy(events.eventType)
        .orderBy(desc(count()))
        .limit(10);

      return {
        total: totalResult?.count || 0,
        today: todayResult?.count || 0,
        eventsPerMinute: lastMinuteResult?.count || 0,
        byType: byTypeResults.map((row) => ({
          eventType: row.eventType,
          count: Number(row.count),
        })),
      };
    } catch (error) {
      console.error("Database error fetching event stats:", error);
      throw new Error("Failed to fetch event statistics");
    }
  }
}
