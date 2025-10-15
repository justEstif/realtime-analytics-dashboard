/**
 * Event Service
 *
 * Handles business logic for event ingestion and retrieval.
 */

import { db } from "../db";
import { events, type Event, type NewEvent } from "../db/schema";
import type { EventAttributes } from "../validators/event.validator";

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
   */
  static async getRecentEvents(limit: number = 50): Promise<Event[]> {
    // TODO: Implement database query
    return [];
  }

  /**
   * Get event counts by type
   */
  static async getEventStats(): Promise<Record<string, number>> {
    // TODO: Implement aggregation query
    return {};
  }
}
