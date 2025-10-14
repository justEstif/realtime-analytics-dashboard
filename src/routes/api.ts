import { Hono } from "hono";

const api = new Hono();

// Placeholder for Phase 3: Event Ingestion Endpoint
// api.post("/events", async (c) => {
//   // Validate request body
//   // Store event in database
//   // Return success/error response
// });

// Health check endpoint
api.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default api;
