import { pgTable, uuid, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";

/**
 * Events table - stores all incoming analytics events
 *
 * Design considerations:
 * - UUID primary key for distributed systems and high-volume inserts
 * - Timestamp indexed for efficient time-range queries
 * - JSONB metadata for flexible event properties without schema changes
 * - Event type indexed for filtering by category
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    eventType: varchar("event_type", { length: 255 }).notNull(),
    metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>(),
  },
  (table) => ({
    // Time-range query optimization
    timestampIdx: index("timestamp_idx").on(table.timestamp),
    // Event type filtering optimization
    eventTypeIdx: index("event_type_idx").on(table.eventType),
    // Composite index for common query pattern: filter by type + time range
    eventTypeTimestampIdx: index("event_type_timestamp_idx").on(table.eventType, table.timestamp),
  })
);

/**
 * Type inference for selecting events from the database
 */
export type Event = typeof events.$inferSelect;

/**
 * Type inference for inserting events into the database
 */
export type NewEvent = typeof events.$inferInsert;
