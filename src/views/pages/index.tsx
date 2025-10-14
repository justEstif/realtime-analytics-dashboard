import type { FC } from "hono/jsx";

export const HomePage: FC = () => {
  return (
    <div class="min-h-screen bg-base-200">
      {/* Navbar */}
      <div class="navbar bg-base-100 shadow-lg">
        <div class="flex-1">
          <a class="btn btn-ghost text-xl">Real-Time Analytics</a>
        </div>
        <div class="flex-none">
          <button class="btn btn-square btn-ghost">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="inline-block w-5 h-5 stroke-current"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div class="container mx-auto p-8">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Stats Cards */}
          <div class="stats shadow">
            <div class="stat">
              <div class="stat-title">Total Events</div>
              <div class="stat-value">0</div>
              <div class="stat-desc">Today</div>
            </div>
          </div>

          <div class="stats shadow">
            <div class="stat">
              <div class="stat-title">Active Users</div>
              <div class="stat-value text-primary">0</div>
              <div class="stat-desc">Last 24 hours</div>
            </div>
          </div>

          <div class="stats shadow">
            <div class="stat">
              <div class="stat-title">Page Views</div>
              <div class="stat-value text-secondary">0</div>
              <div class="stat-desc">This week</div>
            </div>
          </div>

          <div class="stats shadow">
            <div class="stat">
              <div class="stat-title">Events/min</div>
              <div class="stat-value text-accent">0</div>
              <div class="stat-desc">Current rate</div>
            </div>
          </div>
        </div>

        {/* Alert */}
        <div class="alert alert-info mb-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-current shrink-0 w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span>
            Welcome to your Real-Time Analytics Dashboard! Start sending events
            to see live data.
          </span>
        </div>

        {/* Card */}
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title">Getting Started</h2>
            <p>
              This dashboard will display real-time analytics data powered by
              HTMX, Hono, and Bun.
            </p>
            <div class="card-actions justify-end">
              <button class="btn btn-primary">Learn More</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
