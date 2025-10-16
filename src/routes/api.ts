import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createEventSchema } from "../validators/event.validator";
import { EventService } from "../services/events";
import {
  createSuccessResponse,
  createErrorResponse,
  createError,
  zodErrorsToJsonApi,
} from "../utils/jsonapi";

const api = new Hono();

/** Middleware to set Content-Type header for all responses */
api.use(async (c, next) => {
  c.header("Content-Type", "application/json");
  await next();
});

api.post(
  "/events",
  zValidator("json", createEventSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        createErrorResponse(zodErrorsToJsonApi(result.error.issues)),
        400,
      );
    }
  }),
  async (c) => {
    try {
      // Extract validated event attributes
      const { data } = c.req.valid("json");
      const attributes = data.attributes;

      // Create event in database
      const createdEvent = await EventService.createEvent(attributes);

      // Build response URL
      const eventUrl = `/api/events/${createdEvent.id}`;

      // Format JSON:API success response
      const response = createSuccessResponse(
        "events",
        createdEvent.id,
        {
          event_type: createdEvent.eventType,
          timestamp: createdEvent.timestamp.toISOString(),
          metadata: createdEvent.metadata,
        },
        eventUrl,
      );

      // Return 201 Created with Location header
      return c.json(response, 201, {
        Location: eventUrl,
      });
    } catch (error) {
      console.error("Error creating event:", error);

      // Return 500 Internal Server Error
      return c.json(
        createErrorResponse([
          createError(
            "500",
            "Internal Server Error",
            "An error occurred while processing your request",
          ),
        ]),
        500,
      );
    }
  },
);

// Health check endpoint
api.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default api;
