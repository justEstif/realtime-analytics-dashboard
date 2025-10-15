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

/**
 * Middleware to validate Content-Type header for JSON:API compliance
 */
const validateJsonApiContentType = async (c: any, next: any) => {
  const contentType = c.req.header("content-type");

  // Only validate POST/PATCH/PUT requests
  if (["POST", "PATCH", "PUT"].includes(c.req.method)) {
    if (!contentType || !contentType.includes("application/vnd.api+json")) {
      return c.json(
        createErrorResponse([
          createError(
            "415",
            "Unsupported Media Type",
            'Content-Type must be "application/vnd.api+json"',
            { header: "Content-Type" },
          ),
        ]),
        415,
      );
    }
  }

  await next();
};

// Apply JSON:API Content-Type validation to all routes
api.use("*", validateJsonApiContentType);

/**
 * POST /api/events - Create a new event
 *
 * Accepts JSON:API formatted event data, validates it, stores in database,
 * and returns the created event with 201 status.
 *
 * Request body example:
 * {
 *   "data": {
 *     "type": "events",
 *     "attributes": {
 *       "event_type": "page_view",
 *       "metadata": { "page": "/home" },
 *       "timestamp": "2025-10-15T12:00:00Z" (optional)
 *     }
 *   }
 * }
 */
api.post(
  "/events",
  zValidator("json", createEventSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        createErrorResponse(zodErrorsToJsonApi(result.error.issues)),
        400,
        {
          "Content-Type": "application/vnd.api+json",
        },
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
        "Content-Type": "application/vnd.api+json",
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
        {
          "Content-Type": "application/vnd.api+json",
        },
      );
    }
  },
);

// Health check endpoint
api.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default api;
