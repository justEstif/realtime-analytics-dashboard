import { Hono } from "hono";
import { HomePage } from "../views/pages/index";
import { DashboardPage } from "../views/pages/dashboard";
import { EventService } from "../services/events";

const routes = new Hono();

routes.get("/", (c) => {
  return c.render(<HomePage />, { title: "Home - Real-Time Analytics" });
});

routes.get("/dashboard", async (c) => {
  try {
    // Fetch initial data for server-side rendering
    const stats = await EventService.getEventStats();
    const recentEvents = await EventService.getRecentEvents(50);

    return c.render(<DashboardPage stats={stats} recentEvents={recentEvents} />, {
      title: "Dashboard - Real-Time Analytics",
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    // Return error page or redirect
    return c.text("Error loading dashboard. Please try again later.", 500);
  }
});

export default routes;
