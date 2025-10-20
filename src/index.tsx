import { Hono } from "hono";
import { logger } from "hono/logger";
import { jsxRenderer } from "hono/jsx-renderer";
import { serveStatic } from "hono/bun";
import { BaseLayout } from "./views/layouts/base";
import routes from "./routes";
import api from "./routes/api";
import { startWorkers, stopWorkers } from "./workers/pool";
import { startRetentionProcessor } from "./workers/retention-processor";

// Extend ContextRenderer to support title prop
declare module "hono" {
  interface ContextRenderer {
    (
      content: string | Promise<string>,
      props?: { title?: string },
    ): Response | Promise<Response>;
  }
}

const app = new Hono();

// Middleware
app.use(logger());

// Serve static files
app.use("/styles/*", serveStatic({ root: "./src" }));

// JSX Renderer with layout (for page routes only)
app.use(
  "*",
  jsxRenderer(
    ({ children, title }) => <BaseLayout title={title}>{children}</BaseLayout>,
    { docType: true },
  ),
);

// Routes
app.route("/", routes);
app.route("/api", api);

// Start server
const port = 3000;

// Initialize workers and background tasks
async function initializeWorkers(): Promise<void> {
  try {
    console.log("🚀 Initializing background workers...");

    // Start worker pool (event processing + aggregation)
    await startWorkers({
      eventWorkers: 4,
      aggregationWorkers: 1,
      enableAutoRestart: true,
    });

    // Start retention processor (separate worker)
    // Run as a background task without awaiting
    startRetentionProcessor("retention-worker").catch((error) => {
      console.error("Retention processor error:", error);
    });

    console.log("✅ Background workers initialized");
  } catch (error) {
    console.error("❌ Failed to initialize workers:", error);
    // Don't exit, allow server to start with degraded functionality
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.log("\n📴 Received SIGTERM, shutting down gracefully...");
  try {
    await stopWorkers();
    console.log("✅ Workers stopped");
  } catch (error) {
    console.error("Error during shutdown:", error);
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\n📴 Received SIGINT, shutting down gracefully...");
  try {
    await stopWorkers();
    console.log("✅ Workers stopped");
  } catch (error) {
    console.error("Error during shutdown:", error);
  }
  process.exit(0);
});

// Initialize on startup
initializeWorkers().catch(console.error);

console.log(`Server running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
