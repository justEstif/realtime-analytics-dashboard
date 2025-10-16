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
import { jsx } from "hono/jsx";
import { MetricsSection } from "../views/partials/metrics-section";
import { EventRow } from "../views/partials/event-row";

// Helper function to render JSX to HTML string
// BUG: Remove this
function renderJSXToString(element: JSX.Element): string {
  return element.toString();
}

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

// Server-Sent Events endpoint for real-time dashboard updates
api.get("/sse/dashboard", async (c) => {
  // Set SSE headers
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode("event: connected\ndata: {}\n\n")
      );

      // Interval-based updates (every 3 seconds)
      const interval = setInterval(async () => {
        try {
          // Fetch latest metrics
          const stats = await EventService.getEventStats();

          // Render metrics section to HTML
          const metricsHtml = renderJSXToString(
            jsx(MetricsSection, { stats })
          );

          // Send metrics update event
          controller.enqueue(
            encoder.encode(
              `event: metrics-update\ndata: ${metricsHtml}\n\n`
            )
          );

          // Fetch latest event
          const [latestEvent] = await EventService.getRecentEvents(1);
          if (latestEvent) {
            // Render event row to HTML
            const eventHtml = renderJSXToString(
              jsx(EventRow, { event: latestEvent })
            );

            // Send new event
            controller.enqueue(
              encoder.encode(`event: new-event\ndata: ${eventHtml}\n\n`)
            );
          }
        } catch (error) {
          console.error("SSE error:", error);
          // Send error event
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: {"message": "Failed to fetch updates"}\n\n`
            )
          );
        }
      }, 3000); // Update every 3 seconds

      // Cleanup on connection close
      const req = c.req.raw;
      if (req.signal) {
        req.signal.addEventListener("abort", () => {
          clearInterval(interval);
          controller.close();
        });
      }
    },
  });

  return new Response(stream);
});

export default api;
