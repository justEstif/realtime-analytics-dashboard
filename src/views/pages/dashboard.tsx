import type { FC } from "hono/jsx";
import type { Event } from "../../db/schema";
import type { EventStatsResult } from "../../services/events";
import { MetricsSection } from "../partials/metrics-section";
import { EventList } from "../partials/event-list";

interface DashboardPageProps {
  stats: EventStatsResult;
  recentEvents: Event[];
}

export const DashboardPage: FC<DashboardPageProps> = ({
  stats,
  recentEvents,
}) => {
  return (
    <div class="min-h-screen bg-base-200">
      {/* Navbar */}
      <div class="navbar bg-base-100 shadow-lg">
        <div class="flex-1">
          <a href="/" class="btn btn-ghost text-xl">
            Real-Time Analytics Dashboard
          </a>
        </div>
        <div class="flex-none gap-2">
          <div class="badge badge-success gap-2">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            Live
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div class="container mx-auto p-4 md:p-8">
        {/* SSE Connection Container */}
        <div hx-ext="sse" sse-connect="/api/sse/dashboard">
          {/* Metrics Section */}
          <section class="mb-8">
            <h2 class="text-2xl font-bold mb-4">Metrics Overview</h2>
            <div sse-swap="metrics-update" hx-swap="innerHTML">
              <MetricsSection stats={stats} />
            </div>
          </section>

          {/* Recent Events Section */}
          <section>
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-2xl font-bold">Recent Events</h2>
              <div class="text-sm text-base-content/60">
                Last {recentEvents.length} events
              </div>
            </div>

            <div class="card bg-base-100 shadow-xl">
              <div class="card-body p-4 md:p-6">
                <div id="events-container">
                  {/* New events will be prepended here via SSE */}
                  <div
                    id="event-list"
                    sse-swap="new-event"
                    hx-swap="afterbegin"
                  >
                    <EventList events={recentEvents} showHeader={true} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Info */}
        <div class="mt-8 text-center text-sm text-base-content/60">
          <p>
            Dashboard updates automatically via Server-Sent Events. No refresh
            needed.
          </p>
        </div>
      </div>
    </div>
  );
};
