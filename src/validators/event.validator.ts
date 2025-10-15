import { z } from "zod";

/**
 * Zod schema for event attributes
 */
const eventAttributesSchema = z.object({
  event_type: z
    .string()
    .min(1, "event_type is required")
    .max(255, "event_type must be 255 characters or less"),
  metadata: z.record(z.string(), z.unknown()).default({}),
  timestamp: z.iso.datetime().optional().describe("ISO 8601 datetime string"),
});

export const createEventSchema = z.object({
  data: z.object({
    type: z.literal("events", {
      error: 'Resource type must be "events"',
    }),
    attributes: eventAttributesSchema,
  }),
});

/**
 * Type for validated event creation request
 */
export type CreateEventRequest = z.infer<typeof createEventSchema>;

/**
 * Type for event attributes
 */
export type EventAttributes = z.infer<typeof eventAttributesSchema>;
