import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createEventSchema } from "../validators/event.validator";
import { EventService } from "../services/events";
import { QueueService } from "../services/queue";
import { checkRedisHealth } from "../lib/redis";
import {
  createSuccessResponse,
  createErrorResponse,
  createError,
  zodErrorsToJsonApi,
} from "../utils/jsonapi";
import { FC, jsx } from "hono/jsx";
import { MetricsSection } from "../views/partials/metrics-section";
import { EventRow } from "../views/partials/event-row";

// Helper function to render JSX to HTML string
function renderJSXToString(element: FC): string {
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

      // Enqueue event for async processing
      const eventId = await QueueService.enqueueEvent(attributes);

      // Build response URL
      const eventUrl = `/api/events/${eventId}`;

      // Format JSON:API success response
      const response = createSuccessResponse(
        "events",
        eventId,
        {
          event_type: attributes.event_type,
          metadata: attributes.metadata,
          // Include optional timestamp if provided
          ...(attributes.timestamp && {
            timestamp: attributes.timestamp,
          }),
        },
        eventUrl,
      );

      // Return 202 Accepted (event queued for processing)
      return c.json(response, 202, {
        Location: eventUrl,
      });
    } catch (error) {
      console.error("Error queuing event:", error);

      // Return 500 Internal Server Error
      return c.json(
        createErrorResponse([
          createError(
            "500",
            "Internal Server Error",
            "An error occurred while queuing your request",
          ),
        ]),
        500,
      );
    }
  },
);

// Health check endpoint
api.get("/health", async (c) => {
  try {
    const redisHealthy = await checkRedisHealth();
    const queueHealth = await QueueService.getQueueHealth();

    const health = {
      status: redisHealthy && queueHealth.healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      components: {
        redis: redisHealthy ? "ok" : "error",
        queue: queueHealth.healthy ? "ok" : "degraded",
        queueMetrics: queueHealth.metrics,
      },
    };

    const statusCode = health.status === "healthy" ? 200 : 503;
    return c.json(health, statusCode);
  } catch (error) {
    console.error("Health check failed:", error);
    return c.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      },
      500,
    );
  }
});

// Server-Sent Events endpoint for real-time dashboard updates
// Uses Redis pub/sub for efficient real-time updates from workers
api.get("/sse/dashboard", async (c) => {
  // Set SSE headers
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      const encoder = new TextEncoder();
      const clientId = crypto.randomUUID();

      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`,
        ),
      );

      try {
        // Subscribe to worker events via Redis pub/sub
        await pubsub.subscribe(
          [
            "worker:event-processed",
            "aggregation:metrics-calculated",
            "queue:event-failed",
          ],
          async (channel, message) => {
            try {
              const encoder = new TextEncoder();

              if (channel === "worker:event-processed") {
                // Fetch latest event to display
                const [latestEvent] = await EventService.getRecentEvents(1);
                if (latestEvent) {
                  const eventHtml = renderJSXToString(
                    jsx(EventRow, { event: latestEvent }),
                  );

                  controller.enqueue(
                    encoder.encode(
                      `event: new-event\ndata: ${eventHtml}\n\n`,
                    ),
                  );
                }

                // Fetch updated metrics
                const stats = await EventService.getEventStats();
                const metricsHtml = renderJSXToString(
                  jsx(MetricsSection, { stats }),
                );

                controller.enqueue(
                  encoder.encode(
                    `event: metrics-update\ndata: ${metricsHtml}\n\n`,
                  ),
                );
              } else if (channel === "aggregation:metrics-calculated") {
                // Send metrics update when aggregates are calculated
                const stats = await EventService.getEventStats();
                const metricsHtml = renderJSXToString(
                  jsx(MetricsSection, { stats }),
                );

                controller.enqueue(
                  encoder.encode(
                    `event: aggregates-updated\ndata: ${metricsHtml}\n\n`,
                  ),
                );
              } else if (channel === "queue:event-failed") {
                // Send warning about failed events
                const failureMessage = JSON.stringify({
                  type: "event-failure",
                  data: message,
                  timestamp: new Date().toISOString(),
                });

                controller.enqueue(
                  encoder.encode(
                    `event: warning\ndata: ${failureMessage}\n\n`,
                  ),
                );
              }
            } catch (error) {
              console.error("SSE pub/sub handler error:", error);
              const errorMsg = JSON.stringify({
                message: "Error processing update",
              });

              controller.enqueue(
                encoder.encode(`event: error\ndata: ${errorMsg}\n\n`),
              );
            }
          },
        );

        // Also send periodic metrics refreshes (every 5 seconds) as fallback
        // in case no worker updates are coming
        const fallbackInterval = setInterval(async () => {
          try {
            const stats = await EventService.getEventStats();
            const metricsHtml = renderJSXToString(
              jsx(MetricsSection, { stats }),
            );

            controller.enqueue(
              encoder.encode(
                `event: metrics-refresh\ndata: ${metricsHtml}\n\n`,
              ),
            );
          } catch (error) {
            console.error("SSE fallback interval error:", error);
          }
        }, 5000);

        // Cleanup on connection close
        const req = c.req.raw;
        if (req.signal) {
          req.signal.addEventListener("abort", () => {
            clearInterval(fallbackInterval);
            controller.close();
            console.log(`SSE client ${clientId} disconnected`);
          });
        }
      } catch (error) {
        console.error("SSE setup error:", error);
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: "Connection setup failed" })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream);
});

export default api;
