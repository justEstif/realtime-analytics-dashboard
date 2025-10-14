import { Hono } from "hono";
import { logger } from "hono/logger";
import { jsxRenderer } from "hono/jsx-renderer";
import { serveStatic } from "hono/bun";
import { BaseLayout } from "./views/layouts/base";
import routes from "./routes";
import api from "./routes/api";

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
console.log(`Server running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
