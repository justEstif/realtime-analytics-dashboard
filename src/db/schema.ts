import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  jsonb,
  index,
  integer,
} from "drizzle-orm/pg-core";

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
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    eventType: varchar("event_type", { length: 255 }).notNull(),
    metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>(),
  },
  (table) => [
    // Time-range query optimization
    index("timestamp_idx").on(table.timestamp),
    // Event type filtering optimization
    index("event_type_idx").on(table.eventType),
    // Composite index for common query pattern: filter by type + time range
    index("event_type_timestamp_idx").on(table.eventType, table.timestamp),
  ],
);

/**
 * Type inference for selecting events from the database
 */
export type Event = typeof events.$inferSelect;

/**
 * Type inference for inserting events into the database
 */
export type NewEvent = typeof events.$inferInsert;

/**
 * Event Aggregates table - stores pre-calculated time-windowed event counts
 *
 * Design considerations:
 * - Materialized aggregates for fast dashboard queries
 * - Window type (1h, 1d, 1w) enables flexible time-range queries
 * - Event type breakdown for drill-down analytics
 * - TTL based on window (hourly = 24hrs, daily = 90 days, weekly = 1 year)
 */
export const eventAggregates = pgTable(
  "event_aggregates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    windowType: varchar("window_type", { length: 10 }).notNull(), // '1h', '1d', '1w'
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    eventType: varchar("event_type", { length: 255 }).notNull(),
    count: integer("count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Query by window type and time range
    index("aggregates_window_type_idx").on(table.windowType),
    // Query by event type
    index("aggregates_event_type_idx").on(table.eventType),
    // Composite for common query: specific window type + event type
    index("aggregates_window_event_idx").on(
      table.windowType,
      table.eventType,
      table.windowStart,
    ),
    // Query by time range
    index("aggregates_window_start_idx").on(table.windowStart),
  ],
);

/**
 * Type inference for selecting aggregates from the database
 */
export type EventAggregate = typeof eventAggregates.$inferSelect;

/**
 * Type inference for inserting aggregates into the database
 */
export type NewEventAggregate = typeof eventAggregates.$inferInsert;
