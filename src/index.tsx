import { Hono } from "hono";
import { logger } from "hono/logger";
import { jsxRenderer } from "hono/jsx-renderer";
import { BaseLayout } from "./views/layouts/base";
import { HomePage } from "./views/pages/index";
import { serveStatic } from "hono/bun";

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

// JSX Renderer with layout
app.use(
  "*",
  jsxRenderer(
    ({ children, title }) => <BaseLayout title={title}>{children}</BaseLayout>,
    { docType: true },
  ),
);

// Routes
app.get("/", (c) => {
  return c.render(<HomePage />, { title: "Home - Real-Time Analytics" });
});

// Start server
const port = 3000;
console.log(`Server running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
